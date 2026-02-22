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

  try {
    const apiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: fullPrompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          topP: 1,
          topK: 1,
          maxOutputTokens: 2048,
        }
      })
    });

    const responseData = await apiResponse.json();

    if (apiResponse.ok && responseData.candidates && responseData.candidates.length > 0) {
      const responseText = responseData.candidates[0].content.parts[0].text;
      console.log('Output (Raw):', responseText);
      
      if (isJsonAgent) {
        const cleanedText = responseText.replace(/```json\n/g, '').replace(/```/g, '');
        return JSON.parse(cleanedText);
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
