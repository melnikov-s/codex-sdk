import type { ReviewDecision } from "./review.js";
import type { ApplyPatchCommand, ApprovalPolicy } from "../../approvals.js";
import type { AppConfig } from "../config.js";
import type { Model } from "../providers.js";
import type { ExecInput } from "./sandbox/interface.js";
import type { CoreMessage, LanguageModel, ToolCallPart } from "ai";

import { log } from "../logger/log.js";
import { getSessionId, setCurrentModel, setSessionId } from "../session.js";
import { handleExecCommand } from "./handle-exec-command.js";
import { getToolCall, isNativeTool } from "../ai.js";
import { MCPClientManager } from "../mcp/client-manager.js";
import { getLanguageModel } from "../providers.js";
import { tool, generateText } from "ai";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export type CommandConfirmation = {
  review: ReviewDecision;
  applyPatch?: ApplyPatchCommand | undefined;
  customDenyMessage?: string;
  explanation?: string;
};

type AgentLoopParams = {
  model: Model;
  config?: AppConfig;
  instructions?: string;
  approvalPolicy: ApprovalPolicy;
  onItem: (item: CoreMessage) => void;
  onLoading: (loading: boolean) => void;

  /** Extra writable roots to use with sandbox execution. */
  additionalWritableRoots: ReadonlyArray<string>;

  /** Called when the command is not auto-approved to request explicit user review. */
  getCommandConfirmation: (
    command: Array<string>,
    applyPatch: ApplyPatchCommand | undefined,
  ) => Promise<CommandConfirmation>;
};

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

export class AgentLoop {
  private model: LanguageModel;
  private instructions?: string;
  private approvalPolicy: ApprovalPolicy;
  private config: AppConfig;
  private additionalWritableRoots: ReadonlyArray<string>;
  private mcpClientManager: MCPClientManager;

  private onItem: (item: CoreMessage) => void;
  private onLoading: (loading: boolean) => void;
  private getCommandConfirmation: (
    command: Array<string>,
    applyPatch: ApplyPatchCommand | undefined,
  ) => Promise<CommandConfirmation>;

  /**
   * A reference to the currently active stream returned from the OpenAI
   * client. We keep this so that we can abort the request if the user decides
   * to interrupt the current task (e.g. via the escape hot‑key).
   */
  private currentStream:
    | (AsyncIterable<unknown> & ReadableStream<unknown>)
    | null = null;
  /** Incremented with every call to `run()`. Allows us to ignore stray events
   * from streams that belong to a previous run which might still be emitting
   * after the user has canceled and issued a new command. */
  private generation = 0;
  /** AbortController for in‑progress tool calls (e.g. shell commands). */
  private execAbortController: AbortController | null = null;
  /** Set to true when `cancel()` is called so `run()` can exit early. */
  private canceled = false;

  /**
   * Local conversation transcript
   * Holds all non‑system items exchanged so far so we can provide full context on
   * every request.
   */
  private transcript: Array<CoreMessage> = [];
  /** Set to true by `terminate()` – prevents any further use of the instance. */
  private terminated = false;
  /** Master abort controller – fires when terminate() is invoked. */
  private readonly hardAbort = new AbortController();

  /**
   * Abort the ongoing request/stream, if any. This allows callers (typically
   * the UI layer) to interrupt the current agent step so the user can issue
   * new instructions without waiting for the model to finish.
   */
  public cancel(): void {
    if (this.terminated) {
      return;
    }

    this.currentStream?.cancel();
    // Reset the current stream to allow new requests
    this.currentStream = null;
    log(
      `AgentLoop.cancel() invoked – currentStream=${Boolean(
        this.currentStream,
      )} execAbortController=${Boolean(this.execAbortController)} generation=${
        this.generation
      }`,
    );

    this.canceled = true;

    // Abort any in-progress tool calls
    this.execAbortController?.abort();

    // Create a new abort controller for future tool calls
    this.execAbortController = new AbortController();
    log("AgentLoop.cancel(): execAbortController.abort() called");

    this.onLoading(false);

    /* Inform the UI that the run was aborted by the user. */
    // const cancelNotice: ResponseItem = {
    //   id: `cancel-${Date.now()}`,
    //   type: "message",
    //   role: "system",
    //   content: [
    //     {
    //       type: "input_text",
    //       text: "⏹️  Execution canceled by user.",
    //     },
    //   ],
    // };
    // this.onItem(cancelNotice);

    this.generation += 1;
    log(`AgentLoop.cancel(): generation bumped to ${this.generation}`);
  }

  /**
   * Hard‑stop the agent loop. After calling this method the instance becomes
   * unusable: any in‑flight operations are aborted and subsequent invocations
   * of `run()` will throw.
   */
  public terminate(): void {
    if (this.terminated) {
      return;
    }
    this.terminated = true;

    this.hardAbort.abort();

    // Close MCP clients
    this.mcpClientManager.closeAll().catch((error) => {
      log(`Error closing MCP clients: ${error}`);
    });

    this.cancel();
  }

  public sessionId: string;

  constructor({
    model,
    instructions,
    approvalPolicy,
    config,
    onItem,
    onLoading,
    getCommandConfirmation,
    additionalWritableRoots,
  }: AgentLoopParams & { config?: AppConfig }) {
    this.model = getLanguageModel(model);
    this.instructions = instructions;
    this.approvalPolicy = approvalPolicy;

    this.config = config ?? {
      model,
      instructions: instructions ?? "",
    };

    this.additionalWritableRoots = additionalWritableRoots;
    this.onItem = onItem;
    this.onLoading = onLoading;
    this.getCommandConfirmation = getCommandConfirmation;

    this.sessionId = getSessionId() || randomUUID().replaceAll("-", "");
    setSessionId(this.sessionId);
    setCurrentModel(this.model);

    // Initialize MCP client manager
    this.mcpClientManager = new MCPClientManager(this.config);
    this.mcpClientManager.initialize().catch((error) => {
      log(`Error initializing MCP clients: ${error}`);
    });

    this.hardAbort = new AbortController();

    this.hardAbort.signal.addEventListener(
      "abort",
      () => this.execAbortController?.abort(),
      { once: true },
    );
  }

  private async handleFunctionCall(
    toolCall: ToolCallPart,
  ): Promise<Array<CoreMessage>> {
    // If the agent has been canceled in the meantime we should not perform any
    // additional work. Returning an empty array ensures that we neither execute
    // the requested tool call nor enqueue any follow‑up input items. This keeps
    // the cancellation semantics intuitive for users – once they interrupt a
    // task no further actions related to that task should be taken.

    if (this.canceled || toolCall == null) {
      return [];
    }
    // ---------------------------------------------------------------------
    // Normalise the function‑call item into a consistent shape regardless of
    // whether it originated from the `/responses` or the `/chat/completions`
    // endpoint – their JSON differs slightly.
    // ---------------------------------------------------------------------

    const name: string | undefined = toolCall.toolName;

    const args = toolCall.args;

    // The OpenAI "function_call" item may have either `call_id` (responses
    // endpoint) or `id` (chat endpoint).  Prefer `call_id` if present but fall
    // back to `id` to remain compatible.
    const callId: string = toolCall.toolCallId;

    log(
      `handleFunctionCall(): name=${
        name ?? "undefined"
      } callId=${callId} args=${JSON.stringify(args)}`,
    );

    if (args == null) {
      const result = `invalid arguments: ${JSON.stringify(args)}`;

      return [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: callId,
              result: result,
              toolName: name,
            },
          ],
        },
      ];
    }

    let result = "no function found";

    // We intentionally *do not* remove this `callId` from the `pendingAborts`
    // set right away.  The output produced below is only queued up for the
    // *next* request to the OpenAI API – it has not been delivered yet.  If
    // the user presses ESC‑ESC (i.e. invokes `cancel()`) in the small window
    // between queuing the result and the actual network call, we need to be
    // able to surface a synthetic `function_call_output` marked as
    // "aborted".  Keeping the ID in the set until the run concludes
    // successfully lets the next `run()` differentiate between an aborted
    // tool call (needs the synthetic output) and a completed one (cleared
    // below in the `flush()` helper).

    // used to tell model to stop if needed
    const additionalItems: Array<CoreMessage> = [];

    // TODO: allow arbitrary function calls (beyond shell/container.exec)
    if (isNativeTool(name)) {
      const {
        outputText,
        metadata,
        additionalItems: additionalItemsFromExec,
      } = await handleExecCommand(
        args as ExecInput,
        this.config,
        this.approvalPolicy,
        this.additionalWritableRoots,
        this.getCommandConfirmation,
        this.execAbortController?.signal,
      );

      result = JSON.stringify({ output: outputText, metadata });

      if (additionalItemsFromExec) {
        additionalItems.push(...additionalItemsFromExec);
      }
    }

    return [
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: callId,
            result: result,
            toolName: name,
          },
        ],
      },
      ...additionalItems,
    ];
  }

  public async run(input: Array<CoreMessage>): Promise<void> {
    // Add input messages to transcript
    this.transcript.push(...input);
    // Set up loop control variables
    let isRunning = true;
    this.onLoading(true);
    const maxTurns = 30; // Safety limit to prevent infinite loops
    let currentTurn = 0;

    // Keep calling the model until we get a finish reason of 'stop' or hit max turns
    while (isRunning && currentTurn < maxTurns) {
      currentTurn++;

      try {
        // Get MCP tools
        const mcpTools = await this.mcpClientManager.getAllTools();

        // Call the language model with current messages and tools
        const response = await generateText({
          maxSteps: 1,
          model: this.model,
          messages: [
            { role: "system", content: prefix },
            { role: "user", content: this.instructions ?? "" },
            ...this.transcript,
          ],
          tools: {
            shell: shellTool,
            apply_patch: shellTool,
            ...mcpTools,
          },
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
            // Add to transcript
            this.transcript.push(message);
            // Send to UI
            this.onItem(message);

            // Check for tool calls
            const toolCall = getToolCall(message);
            if (toolCall && isNativeTool(toolCall.toolName)) {
              hasToolCalls = true;

              // Execute the tool call
              const toolResults = await this.handleFunctionCall(toolCall);

              // Add tool results to transcript
              for (const toolResult of toolResults) {
                this.transcript.push(toolResult);
                this.onItem(toolResult);
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

        this.onItem({
          role: "assistant",
          content: `Error: ${(error as Error).message}`,
        });

        isRunning = false;
      }
    }
    this.onLoading(false);
  }
}

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
