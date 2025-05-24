import type { Workflow, WorkflowHooks } from "./index.js";
import type { AppConfig } from "../utils/config.js";
import type { CoreMessage } from "ai";

import { getToolCall } from "../utils/ai.js";
import {
  MCPClientManager,
  type MCPServerConfig,
} from "../utils/mcp/client-manager.js";
import { getLanguageModel, type Model } from "../utils/providers.js";
import { generateText, tool } from "ai";
import { z } from "zod";

// Define Zod schema for shellTool parameters
const ShellToolParametersSchema = z.object({
  cmd: z
    .array(z.string())
    .describe("The command and its arguments to execute."),
  workdir: z.string().describe("The working directory for the command."),
  timeout: z
    .number()
    .describe(
      "The maximum time to wait for the command to complete in milliseconds.",
    ),
});

// Vercel AI SDK compatible tool definition
const shellTool = tool({
  description: "Runs a shell command, and returns its output.",
  parameters: ShellToolParametersSchema,
});

// System prompt used by the default agent
const prefix = `You are operating as and within the Codex CLI, a terminal-based agentic coding assistant built by OpenAI. It wraps OpenAI models to enable natural language interaction with a local codebase. You are expected to be precise, safe, and helpful.

You can:
- Receive user prompts, project context, and files.
- Stream responses and emit function calls (e.g., shell commands, code edits).
- Apply patches, run commands, and manage user approvals based on policy.
- Work inside a sandboxed, git-backed workspace with rollback support.
- Log telemetry so sessions can be replayed or inspected later.
- More details on your functionality are available at \`codex --help\`

The Codex CLI is open-sourced. Don't confuse yourself with the old Codex language model built by OpenAI many moons ago (this is understandably top of mind for you!). Within this context, Codex refers to the open-source agentic coding interface.

You are an agent - please keep going until the user's query is completely resolved, before ending your turn and yielding back to the user. Only terminate your turn when you are sure that the problem is solved. If you are not sure about file content or codebase structure pertaining to the user's request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.

Please resolve the user's task by editing and testing the code files in your current code execution session. You are a deployed coding agent. Your session allows for you to modify and run code. The repo(s) are already cloned in your working directory, and you must fully solve the problem for your answer to be considered correct.

You MUST adhere to the following criteria when executing the task:
- Working on the repo(s) in the current environment is allowed, even if they are proprietary.
- Analyzing code for vulnerabilities is allowed.
- Showing user code and tool call details is allowed.
- User instructions may overwrite the *CODING GUIDELINES* section in this developer message.
- Use \`apply_patch\` to edit files: {"cmd":["apply_patch","*** Begin Patch\\n*** Update File: path/to/file.py\\n@@ def example():\\n-  pass\\n+  return 123\\n*** End Patch"]}
- If completing the user's task requires writing or modifying files:
    - Your code and final answer should follow these *CODING GUIDELINES*:
        - Fix the problem at the root cause rather than applying surface-level patches, when possible.
        - Avoid unneeded complexity in your solution.
            - Ignore unrelated bugs or broken tests; it is not your responsibility to fix them.
        - Update documentation as necessary.
        - Keep changes consistent with the style of the existing codebase. Changes should be minimal and focused on the task.
            - Use \`git log\` and \`git blame\` to search the history of the codebase if additional context is required; internet access is disabled.
        - NEVER add copyright or license headers unless specifically requested.
        - You do not need to \`git commit\` your changes; this will be done automatically for you.
        - If there is a .pre-commit-config.yaml, use \`pre-commit run --files ...\` to check that your changes pass the pre-commit checks. However, do not fix pre-existing errors on lines you didn't touch.
            - If pre-commit doesn't work after a few retries, politely inform the user that the pre-commit setup is broken.
        - Once you finish coding, you must
            - Check \`git status\` to sanity check your changes; revert any scratch files or changes.
            - Remove all inline comments you added as much as possible, even if they look normal. Check using \`git diff\`. Inline comments must be generally avoided, unless active maintainers of the repo, after long careful study of the code and the issue, will still misinterpret the code without the comments.
            - Check if you accidentally add copyright or license headers. If so, remove them.
            - Try to run pre-commit if it is available.
            - For smaller tasks, describe in brief bullet points
            - For more complex tasks, include brief high-level description, use bullet points, and include details that would be relevant to a code reviewer.
- If completing the user's task DOES NOT require writing or modifying files (e.g., the user asks a question about the code base):
    - Respond in a friendly tone as a remote teammate, who is knowledgeable, capable and eager to help with coding.
- When your task involves writing or modifying files:
    - Do NOT tell the user to "save the file" or "copy the code into a file" if you already created or modified the file using \`apply_patch\`. Instead, reference the file as already saved.
    - Do NOT show the full contents of large files you have already written, unless the user explicitly asks for them.`;

/**
 * Configuration for the Default Agent Workflow.
 */
export interface DefaultAgentWorkflowConfig {
  mcp?: Record<string, Omit<MCPServerConfig, "name"> & { enabled?: boolean }>;
  model?: Model;
  instructions?: string;
}

/**
 * Default workflow implementation that mimics the original AgentLoop functionality
 */
export function defaultWorkflow(
  hooks: WorkflowHooks,
  agentConfig?: DefaultAgentWorkflowConfig,
): Workflow {
  // Implementation details
  const transcript: Array<CoreMessage> = [];
  const config: AppConfig = {
    model: agentConfig?.model || ("openai/gpt-4o" as Model),
    instructions: agentConfig?.instructions || hooks.toolPrompt,
    // Integrate MCP config if provided
    mcp: agentConfig?.mcp,
  };

  const model = getLanguageModel(config.model);
  const instructions = config.instructions;
  // Create controllers for workflow execution
  let execAbortController: AbortController | null = null;
  let terminated = false;
  let canceled = false;

  // MCP client management
  let mcpClientManager: MCPClientManager | null = null;
  let mcpTools: Record<string, unknown> = {};
  let mcpInitialized = false;

  if (config.mcp) {
    mcpClientManager = new MCPClientManager(config);
  }

  // Create a master abort controller
  const hardAbort = new AbortController();
  hardAbort.signal.addEventListener(
    "abort",
    () => execAbortController?.abort(),
    { once: true },
  );

  // Helper to initialize MCP and fetch tools
  async function initializeMcp() {
    if (mcpClientManager && !mcpInitialized) {
      try {
        hooks.logger("Initializing MCP Client Manager...");
        hooks.onSystemMessage("Initializing MCP Client Manager...");
        await mcpClientManager.initialize();
        mcpTools = await mcpClientManager.getAllTools();
        mcpInitialized = true;
        const msg = `MCP Client Manager initialized. Tools found: ${Object.keys(mcpTools).join(", ") || "None"}`;
        hooks.logger(msg);
        hooks.onSystemMessage(msg);
      } catch (error) {
        const errorMsg = `Error initializing MCP Client Manager: ${error instanceof Error ? error.message : String(error)}`;
        hooks.logger(errorMsg);
        hooks.onSystemMessage(errorMsg);
        // Optionally, handle this error more gracefully, e.g., by notifying the user
      }
    }
  }

  /**
   * Implements the Workflow interface
   */
  return {
    initialize(): void {
      // Optional initialization - default implementation does nothing
    },

    stop(): void {
      // If already terminated, stop might have been called as part of termination.
      // Still, ensure the current execution abort controller is handled.
      if (execAbortController && !execAbortController.signal.aborted) {
        execAbortController.abort();
        hooks.logger("Workflow.stop(): execAbortController.abort() called");
      }
      // Re-initialize for potential future runs if not fully terminated.
      if (!terminated) {
        execAbortController = new AbortController();
      }

      hooks.onSystemMessage("Workflow execution stopped.");
      hooks.setLoading(false);
      canceled = true;
    },

    async terminate(): Promise<void> {
      if (terminated) {
        return;
      }
      terminated = true;
      hooks.logger("Workflow.terminate(): Terminating workflow.");

      // Abort any ongoing operations managed by hardAbort first
      if (!hardAbort.signal.aborted) {
        hardAbort.abort();
        hooks.logger("Workflow.terminate(): hardAbort.abort() called");
      }

      // Then call stop to ensure execAbortController is also handled
      // and other stop-related cleanup occurs.
      this.stop();

      if (mcpClientManager) {
        hooks.logger("Closing MCP Client Manager...");
        hooks.onSystemMessage("Closing MCP Client Manager connections...");
        await mcpClientManager.closeAll();
        hooks.logger("MCP Client Manager closed.");
        hooks.onSystemMessage("MCP Client Manager connections closed.");
      }
    },

    async run(input: Array<CoreMessage>): Promise<Array<CoreMessage>> {
      // Reset canceled state for new run
      canceled = false;

      // Initialize MCP if not already done
      if (mcpClientManager && !mcpInitialized) {
        await initializeMcp();
      }

      // Add input messages to transcript
      transcript.push(...input);

      // Set up loop control variables
      let isRunning = true;
      hooks.setLoading(true);
      const maxTurns = 30; // Safety limit to prevent infinite loops
      let currentTurn = 0;

      // Create an AbortController for this run
      execAbortController = new AbortController();

      // Store new messages generated during this run
      const newMessages: Array<CoreMessage> = [];

      // Keep calling the model until we get a finish reason of 'stop' or hit max turns
      while (isRunning && currentTurn < maxTurns && !canceled) {
        currentTurn++;

        try {
          // Call the language model with current messages and tools
          const response = await generateText({
            maxSteps: 1,
            model,
            messages: [
              { role: "system", content: prefix },
              { role: "user", content: instructions ?? "" },
              ...transcript,
            ],
            tools: {
              shell: shellTool,
              apply_patch: shellTool,
              ...hooks.tools,
              ...mcpTools, // Add MCP tools here
            },
            ...(execAbortController?.signal
              ? { signal: execAbortController.signal }
              : {}),
          });

          // Get new messages and finish reason directly from the response
          const {
            response: { messages },
            finishReason,
          } = response;

          // Process each new message
          if (messages && messages.length > 0) {
            // Track if any tool calls were made in this turn
            let hasToolCalls = false;

            // Add new messages to transcript and process them
            for (const message of messages) {
              // Track new messages for the return value
              newMessages.push(message);

              // Add to transcript
              transcript.push(message);
              // Send to UI
              hooks.onMessage(message);

              // Check for tool calls
              const toolCall = getToolCall(message);
              if (toolCall) {
                hasToolCalls = true;

                // Use the hook to handle tool calls
                // Check if it's an MCP tool first
                if (
                  mcpClientManager &&
                  mcpClientManager.hasToolWithName(toolCall.toolName)
                ) {
                  try {
                    const result = await mcpClientManager.callTool({
                      name: toolCall.toolName,
                      args: toolCall.args,
                      toolCallId: toolCall.toolCallId,
                      messages: [...transcript], // Pass current transcript
                    });
                    const toolResponseMessage: CoreMessage = {
                      role: "tool",
                      content: [
                        {
                          type: "tool-result",
                          toolCallId: toolCall.toolCallId,
                          toolName: toolCall.toolName,
                          result,
                        },
                      ],
                    };
                    transcript.push(toolResponseMessage);
                    hooks.onMessage(toolResponseMessage);
                    newMessages.push(toolResponseMessage);
                  } catch (mcpError) {
                    const errorText = `Error calling MCP tool ${toolCall.toolName}: ${mcpError}`;
                    hooks.logger(errorText);
                    hooks.onSystemMessage(errorText);
                    const errorResult: CoreMessage = {
                      role: "tool",
                      content: [
                        {
                          type: "tool-result",
                          toolCallId: toolCall.toolCallId,
                          toolName: toolCall.toolName,
                          result: `Error executing tool: ${mcpError}`,
                        },
                      ],
                    };
                    transcript.push(errorResult);
                    hooks.onMessage(errorResult);
                    newMessages.push(errorResult);
                  }
                } else {
                  // Handle as a local tool
                  const toolResult = await hooks.handleToolCall(message);
                  if (toolResult) {
                    transcript.push(toolResult);
                    hooks.onMessage(toolResult);
                    newMessages.push(toolResult);
                  }
                }
              }
            }

            // If finish reason is 'stop' and no tools were called, end the loop
            if (finishReason === "stop" && !hasToolCalls) {
              isRunning = false;
            }
          } else {
            // No messages returned is unusual, end the loop
            isRunning = false;
          }
        } catch (error) {
          // Log the error and end the loop
          const runErrorMsg = `Error in workflow run: ${(error as Error).message}`;
          hooks.logger(runErrorMsg);
          hooks.onSystemMessage(runErrorMsg);

          // Call the error handler if provided
          if (hooks.onError) {
            hooks.onError(error);
          }

          const errorMessage: CoreMessage = {
            role: "assistant",
            content: `Error: ${(error as Error).message}`,
          };

          hooks.onMessage(errorMessage);
          transcript.push(errorMessage);
          newMessages.push(errorMessage);

          isRunning = false;
        }
      }

      hooks.setLoading(false);
      return newMessages;
    },

    commands: {
      compact: {
        description:
          "Clear conversation history but keep a summary in context. Optional: /compact [instructions for summarization]",
        handler: async (args?: string) => {
          try {
            hooks.logger("Executing /compact command");
            hooks.setLoading(true);

            const customInstructions = args?.trim();

            // Create system message for compact operation
            const summaryRequest = customInstructions
              ? `Create a concise summary of the conversation following these instructions: ${customInstructions}`
              : "Create a concise summary of the conversation focusing on key decisions, outcomes, and current state.";

            // Generate summary using the model
            const response = await generateText({
              maxSteps: 1,
              model,
              messages: [
                {
                  role: "system",
                  content: `You are tasked with creating a concise summary of a coding conversation. ${summaryRequest} Focus on:
1. Main objectives and goals
2. Key decisions made
3. Current progress/state
4. Important technical details
5. Any outstanding issues

Keep the summary concise but comprehensive.`,
                },
                ...transcript,
                {
                  role: "user",
                  content:
                    "Please provide a summary of our conversation so far.",
                },
              ],
            });

            const summary = response.text;

            // Clear the transcript but keep the summary
            transcript.length = 0;
            transcript.push({
              role: "system",
              content: `[Context Summary] ${summary}`,
            });

            // Notify the hooks
            hooks.onSystemMessage(
              "Conversation context compacted successfully.",
            );
            hooks.onCommandExecuted?.(
              "compact",
              "Context summarized and conversation history cleared",
            );

            hooks.setLoading(false);
          } catch (error) {
            const errorMsg = `Error executing /compact command: ${(error as Error).message}`;
            hooks.logger(errorMsg);
            hooks.onSystemMessage(errorMsg);
            hooks.setLoading(false);
          }
        },
      },
      select: {
        description: "Demo command to test selection functionality",
        handler: async () => {
          try {
            hooks.logger("Executing /select demo command");

            const items = [
              { label: "Option A - First choice", value: "a" },
              { label: "Option B - Second choice", value: "b" },
              { label: "Option C - Third choice", value: "c" },
            ];

            const selected = await hooks.onSelect(items, { default: "b" });

            hooks.onSystemMessage(`You selected: ${selected}`);
            hooks.onCommandExecuted?.("select", `Selected option: ${selected}`);
          } catch (error) {
            const errorMsg = `Error executing /select command: ${(error as Error).message}`;
            hooks.logger(errorMsg);
            hooks.onSystemMessage(errorMsg);
          }
        },
      },
      disable: {
        description: "Demo command to test input disable/enable functionality",
        handler: async (args?: string) => {
          try {
            hooks.logger("Executing /disable demo command");

            const action = args?.trim() || "toggle";

            if (action === "true" || action === "on") {
              hooks.setInputDisabled(true);
              hooks.onSystemMessage("Input disabled by workflow");
              hooks.onCommandExecuted?.("disable", "Input disabled");
            } else if (action === "false" || action === "off") {
              hooks.setInputDisabled(false);
              hooks.onSystemMessage("Input enabled by workflow");
              hooks.onCommandExecuted?.("disable", "Input enabled");
            } else {
              // Toggle demo: disable for 3 seconds then re-enable
              hooks.setInputDisabled(true);
              hooks.onSystemMessage("Input disabled for 3 seconds...");

              setTimeout(() => {
                hooks.setInputDisabled(false);
                hooks.onSystemMessage("Input re-enabled!");
              }, 3000);

              hooks.onCommandExecuted?.(
                "disable",
                "Input disabled temporarily",
              );
            }
          } catch (error) {
            const errorMsg = `Error executing /disable command: ${(error as Error).message}`;
            hooks.logger(errorMsg);
            hooks.onSystemMessage(errorMsg);
          }
        },
      },
    },
  };
}

/**
 * The default workflow factory
 */
export const createDefaultWorkflow = (
  agentConfig?: DefaultAgentWorkflowConfig,
): ((hooks: WorkflowHooks) => Workflow) => {
  return (hooks: WorkflowHooks) => defaultWorkflow(hooks, agentConfig);
};
