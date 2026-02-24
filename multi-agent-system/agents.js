// multi-agent-system/agents.js
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import prompts from './prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Construct an absolute path to the .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Calls the Gemini REST API directly using fetch.
 * @param {string} agentName - The name of the agent.
 * @param {string} inputPrompt - The specific input prompt for this agent turn.
 * @param {string} projectContext - The project structure context.
 * @returns {Promise<any>} - The output from the AI.
 */
async function runAgent(agentName, inputPrompt, projectContext = '') {
  console.log(`\n----- Running ${agentName.toUpperCase()} Agent -----`);
  
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY') {
    console.error("GEMINI_API_KEY is not set. Please add it to your .env file.");
    throw new Error("API key not configured.");
  }
  
  const modelName = 'gemini-2.0-flash';
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent`;

  const agentPrompts = prompts[agentName];
  if (!agentPrompts) throw new Error(`Agent prompt for ${agentName} not found.`);

  const isJsonAgent = agentName === 'planner' || agentName === 'reviewer';

  const fullPrompt = `
${agentPrompts.persona}

${agentPrompts.instructions}

${isJsonAgent ? 'IMPORTANT: YOU MUST RETURN ONLY A VALID JSON OBJECT OR ARRAY. NO PROSE, NO EXPLANATION.' : ''}

### Project Context (Current Root Directory Structure):
${projectContext}

### Input:
${inputPrompt}
`.trim();
  
  const parseJsonFromText = (text) => {
    let cleaned = text.replace(/```json\n?/gi, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      const firstBracket = cleaned.indexOf('[');
      const lastBracket = cleaned.lastIndexOf(']');

      let jsonCandidate = "";
      if (firstBrace !== -1 && (firstBracket === -1 || (firstBrace < firstBracket && firstBrace !== -1))) {
        jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
      } else if (firstBracket !== -1) {
        jsonCandidate = cleaned.substring(firstBracket, lastBracket + 1);
      }

      if (jsonCandidate) {
        try {
          return JSON.parse(jsonCandidate);
        } catch (innerError) {
          throw new Error(`JSON parsing failed: ${innerError.message}`);
        }
      }
      throw new Error(`JSON payload not found in model response.`);
    }
  };

  const extractResponseText = (responseData) => {
    const text = responseData?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('\n')
      .trim();
    if (!text) throw new Error(`Empty model response.`);
    return text;
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); 

    const body = {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: isJsonAgent ? 0.1 : 0.7, 
        topP: 1, topK: 1,
        maxOutputTokens: 8192,
      }
    };

    const apiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(body)
    });
    clearTimeout(timeout);

    const responseData = await apiResponse.json();
    if (apiResponse.ok && responseData.candidates && responseData.candidates.length > 0) {
      const responseText = extractResponseText(responseData);
      if (isJsonAgent) return parseJsonFromText(responseText);
      console.log('Output (Prose Preview):', responseText.substring(0, 100) + '...');
      return responseText;
    } else {
      throw new Error(responseData.error?.message || 'API call failed.');
    }
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`Agent ${agentName} timed out.`);
    throw error;
  }
}

export const runPlanner = (state, request, context) => runAgent('planner', request, context);
export const runUIArchitect = (state, context) => runAgent('ui_architect', `Plan: ${JSON.stringify(state.plan)}`, context);
export const runLogicEngineer = (state, context) => runAgent('logic_engineer', `Plan: ${JSON.stringify(state.plan)}\nUI Concept: ${state.uiCode}`, context);
export const runIntegrator = (state, context) => runAgent('integrator', `Plan: ${JSON.stringify(state.plan)}\nUI: ${state.uiCode}\nLogic: ${state.logicCode}`, context);
export const runReviewer = (code, context) => runAgent('reviewer', code, context);
