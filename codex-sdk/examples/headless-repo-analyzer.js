// headless-repo-analyzer.js
// Demonstrates running a workflow without the Ink UI and without user input.
// The workflow asks the model to plan a quick repo analysis and then uses
// the native `shell` tool to gather facts, printing sequential logs to stdout.

import { run, createAgentWorkflow, AutoApprovalMode } from "../dist/lib.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const workflow = createAgentWorkflow(({ state, actions, tools, control }) => {
  return {
    initialize() {
      actions.say("🔎 Headless Repo Analyzer starting…");
      // Kick off the first turn from initialize — no `this`, no timers
      control.message({
        role: "user",
        content:
          "List top-level directories with `ls -1`. Then run `git status --porcelain` and count changed files. Summarize in 2 lines.",
      });
    },
    async message(input) {
      actions.addMessage(input);
      actions.setLoading(true);

      const result = await generateText({
        model: openai("gpt-4o"),
        messages: state.transcript,
        tools: tools.definitions, // headless: includes only shell/apply_patch
      });

      await actions.handleModelResult(result);
      actions.setLoading(false);
    },
    stop() {
      actions.setLoading(false);
    },
    terminate() {},
  };
});

// Export the workflow for use in multi-workflow demos (will run in UI mode there)
export const headlessRepoAnalyzerWorkflow = workflow;

// Run with conservative policy so the model must ask before performing edits.
// Headless omits interactive user_select, but shell/apply_patch are supported.
// Only run headless if this file is executed directly
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  run(workflow, {
    approvalPolicy: AutoApprovalMode.SUGGEST,
    log: { mode: "human" },
    headless: true,
  });
}
