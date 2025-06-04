<h1 align="center">Codex SDK</h1>
<p align="center">A flexible library for building powerful, interactive coding agents with pre-built UI and system tool integrations. This project is a fork of OpenAI's original <a href="https://github.com/openai/codex">Codex CLI</a>, refactored into a library to provide a foundation for custom agent development.</p>

---

## Core Concept

The Codex SDK provides the foundational components—UI, system tool integrations, and an agent workflow framework—to create bespoke coding agents. Unlike a standalone CLI, this library empowers you to embed agent capabilities into your own applications or build highly customized agent experiences.

You, the developer, provide the core agent logic (e.g., Large Language Model interaction, prompting strategies, and decision-making), and the library handles the interactive terminal UI, secure tool execution, and message orchestration.

## Quickstart

### Installation

Add the Codex SDK to your project:

```shell
npm install codex-sdk
# or
yarn add codex-sdk
# or
pnpm add codex-sdk
```

### Example 1: Running the Default Agent

For a quick start with an experience similar to the original Codex CLI, you can use the `createDefaultWorkflow`. This sets up a pre-configured agent.

```javascript
// my-default-agent.js
import { run, createDefaultWorkflow, AutoApprovalMode } from "codex-sdk";

const defaultWorkflow = createDefaultWorkflow({
  approvalPolicy: AutoApprovalMode.SUGGEST,
  model: "openai/gpt-4o",
});

// Launch the agent UI with the default workflow
run(defaultWorkflow);
```

### Example 2: Building a Custom Agent

Create your own agent logic by providing a function to `createAgentWorkflow`. This function defines how your agent initializes, processes messages, and interacts with the UI and tools.

```javascript
// my-custom-agent.js
import { run, createAgentWorkflow } from "codex-sdk";
import { generateText } from "ai"; // Example: Using Vercel AI SDK
import { openai } from "@ai-sdk/openai"; // Example: OpenAI provider

const customWorkflow = createAgentWorkflow({
  onMessage,
  setLoading,
  handleToolCall,
  tools,
  onUIMessage,
}) => {
  const transcript = [{ role: 'system', content: 'You are a helpful assistant.' }];
  let agentState = "idle"; // 'idle', 'running', 'paused'

  async function processLoop() {
    setLoading(true);
    agentState = "running";

    while (agentState === "running") {
      try {
        const response = await generateText({
          model: openai("gpt-4o"), // Your chosen model
          messages: transcript,
          tools, // Pass the library's tools to the LLM
        });

        const aiResponseMessage = response.response.messages[0];

        if (aiResponseMessage) {
          transcript.push(aiResponseMessage);
          onMessage(aiResponseMessage); // Send AI response to UI

          const toolCallResult = await handleToolCall(aiResponseMessage); // Library handles tool execution

          if (toolCallResult) {
            transcript.push(toolCallResult);
            onMessage(toolCallResult); // Send tool result to UI
          } else if (response.finishReason === "stop") {
            agentState = "paused";
          }
        } else {
          agentState = "paused";
        }
      } catch (error) {
        onUIMessage(`Error: ${error.message || "Unknown agent error"}`);
        agentState = "paused";
      }
    }
    setLoading(false);
  }

  return {
    initialize: async () => {
      onUIMessage("Custom Agent initialized. How can I assist you?");
    },
    message: async (userInput) => {
      transcript.push(userInput);
      if (agentState === "idle" || agentState === "paused") {
        processLoop();
      } else {
        // Agent is already running, input is added to transcript for next turn
        onUIMessage("Input added to ongoing conversation.");
      }
    },
    stop: () => {
      agentState = "paused";
      setLoading(false);
      onUIMessage("Agent paused.");
    },
    terminate: () => {
      agentState = "idle";
      transcript.length = 0; // Clear transcript
      setLoading(false);
      onUIMessage("Agent terminated and reset.");
    },
  };
};

run(customWorkflow);
```

## Why the Codex SDK?

- **Reusable UI:** Leverage a polished, interactive terminal interface designed for agent workflows, saving you significant development time.
- **Secure Tool Integration:** Provides a secure sandbox for executing shell commands and interacting with the file system, managed via the `handleToolCall` mechanism.
- **Flexible Agent Design:** Bring your own AI models (from any provider like OpenAI, Anthropic, Mistral, or local models via Ollama), prompting strategies, and complex agent logic. The library doesn't impose a specific AI provider.
- **Built on Vercel AI SDK:** Leverages the robust and extensible [Vercel AI SDK](https://ai-sdk.dev/docs/introduction) for core AI model interactions, providing a standardized way to work with various LLMs.
- **Focus on Core Logic:** Abstract away the complexities of UI rendering, state management for interactions, and secure tool execution. You concentrate on what makes your agent unique.

## Key Library Components & Usage

The Codex SDK revolves around a few core exports and concepts for building your agent.

---

### `run(workflow)`

Starts the interactive terminal UI, using the provided `workflow` object. This function typically runs until the user exits the UI.

- **Parameters:**
  - `workflow` (`object`): The workflow object obtained from either `createDefaultWorkflow` or `createAgentWorkflow`.
- **Returns:**
  - `void`

---

### `createDefaultWorkflow(options)`

Creates a pre-configured workflow with a default agent, offering an experience similar to the original Codex CLI.

- **Parameters:**
  - `options` (`object`): Configuration for the default agent.
    - `options.approvalPolicy` (`AutoApprovalMode` enum: `SUGGEST`, `AUTO_EDIT`, `FULL_AUTO`): Sets the permission mode for the agent.
    - `options.config` (`object`): UI and tool-specific settings.
      - `options.config.model` (`string`, optional): The identifier for the AI model to be used (e.g., `"gpt-4o"`, `"o4-mini"`).
      - `options.config.notify` (`boolean`, optional, default: `true`): Enables/disables desktop notifications.
      - `options.config.tools` (`object`, optional): Configuration for specific tools.
        - `options.config.tools.shell` (`object`, optional): Settings for the shell tool.
          - `options.config.tools.shell.maxBytes` (`number`, optional): Maximum bytes for shell output.
          - `options.config.tools.shell.maxLines` (`number`, optional): Maximum lines for shell output.
      - `options.config.fullAutoErrorMode` (`string`, optional, default: `'ask-user'`): Defines error handling behavior in `FULL_AUTO` mode (e.g., `'ask-user'`, `'ignore-and-continue'`).
- **Returns:**
  - `object`: A workflow object to be passed to the `run` function.

---

### `createAgentWorkflow(agentLogicFunction)`

The primary function for building custom agents. It takes your agent's core logic as a function and returns a workflow object.

- **Parameters:**
  - `agentLogicFunction` (`function`): A function you define that contains your agent's intelligence and interaction loop. See details below.
- **Returns:**
  - `object`: A workflow object to be passed to the `run` function.

---

### The `agentLogicFunction(hooks)`

This is the function you provide to `createAgentWorkflow`. It's where your custom agent's intelligence and main processing loop reside. The SDK calls this function, providing it with a `hooks` object to interact with the UI and tools.

- **Parameters (provided by the SDK to your function):**

  - `hooks` (`object`): An object containing functions and data to interact with the SDK:
    - `hooks.onMessage(messageObject)` (`function`): Sends a message to be displayed in the UI.
      - **Input:** `messageObject` (`CoreMessage` from Vercel AI SDK): A message object, typically `{ role: 'assistant', content: '...', tool_calls: [...] }` or `{ role: 'tool', content: '...', tool_call_id: '...' }`. This should conform to the Vercel AI SDK's `CoreMessage` type.
      - **Returns:** `void`.
    - `hooks.setLoading(isLoading)` (`function`): Toggles the loading indicator in the UI.
      - **Input:** `isLoading` (`boolean`): `true` to show loading, `false` to hide.
      - **Returns:** `void`.
    - `hooks.handleToolCall(aiMessageWithToolCall)` (`function`): Executes tool calls requested by the AI.
      - **Input:** `aiMessageWithToolCall` (`object`): The AI's message object that includes a `tool_calls` array.
      - **Returns:** `Promise<object | null>`: A promise that resolves to a tool response message (for the AI and UI) or `null` if no specific response is needed beyond the tool's side effects.
    - `hooks.tools` (`Array<object>`): An array of tool definitions that the library supports (e.g., for shell commands, file operations). You should pass these to your AI model so it knows what tools it can request.
    - `hooks.onUIMessage(messageText)` (`function`): Displays general status messages or instructions in the UI, separate from the main chat transcript.
      - **Input:** `messageText` (`string`): The text to display.
      - **Returns:** `void`.

- **Returns (your function must return this):**
  - `AgentObject` (`object`): An object that defines the interface the SDK will use to interact with and control your agent. See details below.

---

### The `AgentObject` (returned by your `agentLogicFunction`)

This is the object your `agentLogicFunction` must return. It defines the lifecycle and interaction methods for your custom agent.

- **Properties (all are methods you implement):**
  - `initialize()`:
    - **Purpose:** Called once when the agent workflow starts. Use for setup, sending initial greetings (via `hooks.onUIMessage`), or preparing system prompts.
    - **Parameters:** None.
    - **Returns:** `Promise<void>`.
  - `message(userInputMessage)`:
    - **Purpose:** Called whenever the user submits new input. This is the entry point for your agent to process user requests.
    - **Parameters:**
      - `userInputMessage` (`object`): The user's input, typically `{ role: 'user', content: '...' }`.
    - **Returns:** `Promise<void>`.
  - `stop()`:
    - **Purpose:** Called if the user requests to pause or interrupt the agent (e.g., by pressing `Escape` twice). Your agent should halt its current processing loop and preserve its state if possible.
    - **Parameters:** None.
    - **Returns:** `void`.
  - `terminate()`:
    - **Purpose:** Called if the user requests to end the session or reset the agent (e.g., by pressing `Ctrl+C`). Your agent should stop all processing, clear its state and transcript, and prepare for a potential new session or full shutdown.
    - **Parameters:** None.
    - **Returns:** `void`.

---

## Security Model & Permissions

The Codex SDK helps you build agents that can interact with the system, such as running shell commands or modifying files. The security model is designed to provide safety and control.

When using `handleToolCall` for operations like shell commands, these are executed with restrictions:
| Mode | What the agent may do without asking (via `handleToolCall`) | Still requires approval (managed by library's UI/tool handler) |
| ------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Suggest** <br>(default with `createDefaultWorkflow`) | <li>Read any file in the repo | <li>**All** file writes/patches<li> **Any** arbitrary shell commands (aside from reading files) |
| **Auto Edit** | <li>Read **and** apply-patch writes to files | <li>**All** shell commands |
| **Full Auto** | <li>Read/write files <li> Execute shell commands (network disabled, writes limited to your workdir) | - |

For custom agents built with `createAgentWorkflow`, how `approvalMode` (or a similar concept) is handled depends on your implementation. The `handleToolCall` function will respect the sandboxing rules, but your agent logic determines when and what tools are called. You can implement custom approval flows using `onUIMessage` and user responses.

By default, in modes like **Full Auto**, commands are run **network-disabled** and confined to the current working directory (plus temporary files) for defense-in-depth.

### Platform Sandboxing Details

The hardening mechanism used by the Codex SDK's tool execution depends on your OS:

- **macOS 12+** - commands are wrapped with **Apple Seatbelt** (`sandbox-exec`).
  - Everything is placed in a read-only jail except for a small set of writable roots (`$PWD`, `$TMPDIR`, etc.).
  - Outbound network is _fully blocked_ by default.
- **Linux** - Sandboxing might require user-side setup (e.g., Docker).
  The Codex SDK itself does not enforce Linux sandboxing beyond what Node.js child_process offers. For stronger isolation, consider running your Node.js application that uses this library within a containerized environment like Docker, similar to the recommendations for the original CLI.

## License

This repository is licensed under the [Apache-2.0 License](LICENSE).
