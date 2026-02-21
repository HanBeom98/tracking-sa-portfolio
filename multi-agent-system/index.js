// multi-agent-system/index.js
const { orchestrator } = require('./orchestrator');

// Define the initial high-level goal from the user.
const userRequest = "Create a simple Node.js script that prints a hello message.";

// Start the orchestration process.
orchestrator(userRequest);
