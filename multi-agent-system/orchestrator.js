// multi-agent-system/orchestrator.js
import { runPlanner, runUIArchitect, runLogicEngineer, runIntegrator, runReviewer } from './agents.js';

export async function executeWorkflow(userRequest, projectContext) {
  let state = {
    request: userRequest,
    plan: null,
    uiCode: '',
    logicCode: '',
    finalCode: '',
    review: null,
    history: []
  };

  try {
    // 1. Planning Stage
    state.plan = await runPlanner(state, userRequest, projectContext);
    console.log('✅ Plan Created:', state.plan);

    // 2. Specialized Coding Stage (The Team)
    
    // 2a. UI/UX Architect
    state.uiCode = await runUIArchitect(state, projectContext);
    console.log('✅ UI/UX Architecture Completed.');

    // 2b. Logic Engineer
    state.logicCode = await runLogicEngineer(state, projectContext);
    console.log('✅ Logic Engineering Completed.');

    // 2c. System Integrator
    state.finalCode = await runIntegrator(state, projectContext);
    console.log('✅ System Integration Completed.');

    // 3. Review Stage
    state.review = await runReviewer(state.finalCode, projectContext);
    console.log('✅ Review Completed:', state.review.approved ? 'APPROVED' : 'REJECTED');

    return state;
  } catch (error) {
    console.error('❌ Workflow Error:', error);
    throw error;
  }
}
