// multi-agent-system/orchestrator.js
const { runPlanner, runDeveloper, runReviewer } = require('./agents');

/**
 * The main orchestrator for the multi-agent system.
 * Manages the state and flow of control between agents.
 * @param {string} initialRequest - The user's initial request.
 */
async function orchestrator(initialRequest) {
  console.log(`
=========================================
STARTING ORCHESTRATION
=========================================
Initial Request: "${initialRequest}"
`);

  // 1. Initialize State
  const state = {
    initialRequest,
    plan: null,
    code: null,
    review: null,
    history: [],
  };

  try {
    // 2. Run Planner Agent
    state.plan = await runPlanner(state, initialRequest);
    state.history.push({ agent: 'planner', status: 'success' });

    // 3. Run Developer Agent
    state.code = await runDeveloper(state);
    state.history.push({ agent: 'developer', status: 'success' });

    // 4. Run Reviewer Agent
    state.review = await runReviewer(state);
    state.history.push({ agent: 'reviewer', status: 'success' });

    // 5. Final Output
    console.log(`\n=========================================\nORCHESTRATION COMPLETE\n=========================================`);
    if (state.review.approved) {
      console.log("✅ Final Result: Code approved!");
      console.log("\n--- Final Code ---");
      console.log(state.code);
      console.log("\n--- Review Comments ---");
      console.log(state.review.comments);
    } else {
      console.log("❌ Final Result: Code rejected.");
      console.log("\n--- Review Comments ---");
      console.log(state.review.comments);
    }

    console.log("\n--- Full State ---");
    console.log(JSON.stringify(state, null, 2));

  } catch (error) {
    console.error("\n❌ ORCHESTRATION FAILED ❌");
    console.error(error);
    state.history.push({ agent: 'orchestrator', status: 'failed', error: error.message });
    console.log("\n--- Final State ---");
    console.log(JSON.stringify(state, null, 2));
  }
}

module.exports = { orchestrator };
