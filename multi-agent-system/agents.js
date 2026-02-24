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
 * @param {string} agentName - The name of the agent (e.g., 'planner', 'developer').
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
  const fullPrompt = `
${agentPrompts.persona}

${agentPrompts.instructions}

### Project Context (Current Root Directory Structure):
${projectContext}

### Input:
${inputPrompt}
`.trim();
  
  const isJsonAgent = agentName === 'planner' || agentName === 'reviewer';

  const parseJsonFromText = (text) => {
    const cleaned = text.replace(/```json\n?/gi, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          return JSON.parse(arrayMatch[0]);
        } catch {
          // Continue to object fallback when bracketed prose (e.g. [a11y]) is present.
        }
      }
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objectMatch) return JSON.parse(objectMatch[0]);
      throw new Error('JSON payload not found in model response.');
    }
  };

  const extractResponseText = (responseData) => {
    const text = responseData?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('\n')
      .trim();

    if (!text) {
      const blockReason = responseData?.promptFeedback?.blockReason || 'UNKNOWN';
      throw new Error(`Empty model response. Block reason: ${blockReason}`);
    }

    return text;
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const apiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [{ text: fullPrompt }]
        }],
        generationConfig: {
          temperature: isJsonAgent ? 0.2 : 0.7,
          topP: 1,
          topK: 1,
          maxOutputTokens: 2048,
        }
      })
    });
    clearTimeout(timeout);

    const responseData = await apiResponse.json();

    if (apiResponse.ok && responseData.candidates && responseData.candidates.length > 0) {
      const responseText = extractResponseText(responseData);
      console.log('Output (Raw):', responseText);
      
      if (isJsonAgent) {
        return parseJsonFromText(responseText);
      } else {
        return responseText;
      }
    } else {
      const errorMessage = responseData.error?.message || 'API call failed with no error message.';
      console.error('Gemini API Error:', errorMessage);
      throw new Error(errorMessage);
    }

  } catch (error) {
    console.error(`Error during ${agentName} agent execution:`, error);
    throw new Error(`Agent ${agentName} failed.`);
  }
}

export const runPlanner = (state, request, context) => runAgent('planner', request, context);
export const runDeveloper = (state, context) => runAgent('developer', JSON.stringify(state.plan, null, 2), context);
export const runReviewer = (code, context) => runAgent('reviewer', code, context);
