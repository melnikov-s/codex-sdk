import { run, createDefaultWorkflow, AutoApprovalMode } from "../dist/lib.js";

const defaultWorkflow = createDefaultWorkflow({
  // Set approval policy (suggest, auto-edit, or full-auto)
  approvalPolicy: AutoApprovalMode.SUGGEST,
  model: "openai/gpt-4o",

  // Configure UI settings
  config: {
    // Enable desktop notifications
    notify: true,

    // Configure shell tool
    tools: {
      shell: {
        // Limit output size to prevent excessive output
        maxBytes: 100000,
        maxLines: 1000,
      },
    },

    // Error mode for handling sandbox errors
    fullAutoErrorMode: "ask-user",
  },
});

// Launch the CLI with the default workflow
run(defaultWorkflow);

// Note: The defaultWorkflow will:
// 1. Handle user input and agent responses
// 2. Execute tool calls and display results
// 3. Manage the approval flow based on the configured policy
