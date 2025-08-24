import { workflow as codebaseQuiz } from "./codebase-quiz.js";
import { workflow as codingAgent } from "./coding-agent.js";
import { workflow as deployDashboard } from "./deploy-dashboard.js";
import { workflow as headlessRepoAnalyzer } from "./headless-repo-analyzer.js";
import { workflow as projectSetupAssistant } from "./project-setup-assistant.js";
import { workflow as queueDemo } from "./queue-demo.js";
import { workflow as researchAssistant } from "./research-assistant.js";
import { workflow as simpleAgent } from "./simple-agent.js";
import { workflow as taskListDemo } from "./task-list-demo.js";
import { workflow as textAdventureGame } from "./text-adventure-game.js";
import { runMultiWorkflows } from "../dist/lib.js";

// Available workflows from all examples - just pass the factories directly!
const workflows = [
  simpleAgent,
  researchAssistant,
  codingAgent,
  queueDemo,
  taskListDemo,
  textAdventureGame,
  codebaseQuiz,
  deployDashboard,
  projectSetupAssistant,
  headlessRepoAnalyzer,
];

// Run multi-workflow environment
// No initial workflows specified - starts with workflow selector
runMultiWorkflows(workflows, {
  approvalPolicy: "suggest",
  additionalWritableRoots: [],
  fullStdout: false,
  config: {
    notify: true,
    title: "Multi-Workflow Demo",
  },
  onController: (_controller) => {
    // Workflow controller created
  },
});
