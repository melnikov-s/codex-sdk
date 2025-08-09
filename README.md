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

**Timeout Functionality Example:**

```javascript
// Manual hook calls with timeout in your agent logic
const confirmation = await hooks.onSelect(
  [
    { label: "Yes", value: "yes" },
    { label: "No", value: "no" },
  ],
  {
    label: "Continue with this action?",
    timeout: 10,
    defaultValue: "no",
  },
);

const framework = await hooks.onSelect(
  [
    { label: "React", value: "react" },
    { label: "Vue", value: "vue" },
    { label: "Angular", value: "angular" },
  ],
  {
    label: "What's your preferred framework?",
    timeout: 30,
    defaultValue: "react",
  },
);

// LLM can also initiate user interactions autonomously via user_select tool
// (timeout/defaultValue automatically included with 45s default)
const response = await generateText({
  model: openai("gpt-4o"),
  messages: [...state.transcript],
  tools, // Includes user_select for confirmations, prompts, and selections
});
```

```javascript
// my-custom-agent.js
import { run, createAgentWorkflow } from "codex-sdk";
import { generateText } from "ai"; // Example: Using Vercel AI SDK
import { openai } from "@ai-sdk/openai"; // Example: OpenAI provider

const customWorkflow = createAgentWorkflow(
  ({ setState, state, appendMessage, handleToolCall, tools, onConfirm }) => {
    let agentState = "idle"; // 'idle', 'running', 'paused'

    async function processLoop() {
      setState({ loading: true });
      agentState = "running";

      while (agentState === "running" && state.loading) {
        try {
          const response = await generateText({
            model: openai("gpt-4o"), // Your chosen model
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              ...state.transcript, // Use filtered transcript (no UI messages)
            ],
            tools, // Pass the library's tools to the LLM
          });

          const aiResponseMessage = response.response.messages[0];

          if (aiResponseMessage) {
            // Add AI response to state (automatically appears in state.transcript)
            appendMessage(aiResponseMessage);

            const toolCallResult = await handleToolCall(aiResponseMessage); // Library handles tool execution

            if (toolCallResult) {
              appendMessage(toolCallResult);
            } else if (response.finishReason === "stop") {
              agentState = "paused";
            }
          } else {
            agentState = "paused";
          }
        } catch (error) {
          appendMessage({
            role: "ui",
            content: `Error: ${error.message || "Unknown agent error"}`,
          });
          agentState = "paused";
        }
      }
      setState({ loading: false });
    }

    return {
      initialize: async () => {
        setState({
          messages: [
            {
              role: "ui",
              content: "Custom Agent initialized. How can I assist you?",
            },
          ],
        });
      },
      message: async (userInput) => {
        appendMessage(userInput); // Add to state (auto-appears in state.transcript)
        if (agentState === "idle" || agentState === "paused") {
          processLoop();
        } else {
          // Agent is already running, show queued status
          appendMessage({
            role: "ui",
            content: "Input queued for processing...",
          });
        }
      },
      stop: () => {
        agentState = "paused";
        setState({ loading: false });
        appendMessage({ role: "ui", content: "Agent paused." });
      },
      terminate: () => {
        agentState = "idle";
        setState({ loading: false, messages: [] }); // Clears transcript automatically
      },
    };
  },
);

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

### User Interaction Tools for LLMs

The Codex SDK automatically provides one powerful user interaction tool that LLMs can call autonomously to create human-in-the-loop workflows:

**`user_select`** - Universal user interaction tool

Handles **confirmations**:

```json
{
  "toolName": "user_select",
  "parameters": {
    "message": "Should I delete the old backup files?",
    "options": [
      { "label": "Yes", "value": "yes" },
      { "label": "No", "value": "no" }
    ],
    "timeout": 45,
    "defaultValue": "no"
  }
}
```

Handles **prompted input with suggestions**:

```json
{
  "toolName": "user_select",
  "parameters": {
    "message": "What testing framework should I use?",
    "options": [
      { "label": "Jest", "value": "jest" },
      { "label": "Vitest", "value": "vitest" },
      { "label": "Mocha", "value": "mocha" }
    ],
    "timeout": 45,
    "defaultValue": "jest"
  }
}
```

Handles **pure selections**:

```json
{
  "toolName": "user_select",
  "parameters": {
    "message": "Which deployment strategy?",
    "options": [
      { "label": "Blue-green deployment", "value": "blue-green" },
      { "label": "Rolling deployment", "value": "rolling" },
      { "label": "Canary deployment", "value": "canary" }
    ],
    "timeout": 45,
    "defaultValue": "rolling"
  }
}
```

**Important**: `user_select` automatically adds a "None of the above (enter custom option)" choice. When selected:

- `handleToolCall` returns `null` (no tool response)
- Agent naturally stops processing (finishReason="stop")
- User gets normal chat input to provide custom response
- Perfect for when LLM options don't match user needs

**Normal selections** return: `{"userResponse": "jest"}`
**"None of the above"** returns: `null` (enables custom input flow)

All interactions include automatic timeout handling (default 45 seconds) and return the user's response in the tool result:

```json
{"userResponse": "yes"}        // confirmation result
{"userResponse": "jest"}       // selection result
{"userResponse": "custom"}     // any selected value
```

**Example LLM Workflow:**

```javascript
// The LLM can autonomously create interactive workflows using just one tool:
const response = await generateText({
  model: openai("gpt-4o"),
  messages: [...state.transcript],
  tools, // Automatically includes user_select for all interaction types
});

// Examples of what the LLM might call:
// Confirmation: user_select with Yes/No options
// Prompted input: user_select with suggestions + "None of the above"
// Pure selection: user_select with provided options + "None of the above"

// Handle tool calls with natural flow control
const toolResponse = await handleToolCall(response.toolCalls[0]);
if (toolResponse) {
  appendMessage(toolResponse); // Normal tool response - continue processing
} else if (response.finishReason === "stop") {
  // User selected "None of the above" - naturally breaks agent loop
  setState({ loading: false });
  // User can now provide custom input via normal chat interface
}
```

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
    - `options.displayConfig` (`object`, optional): Display customization configuration. Controls how messages, headers, and UI elements are styled. See [Display Customization](#display-customization) section for details.
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

## Display Customization

The Codex SDK provides powerful display customization through the `displayConfig` system, allowing you to customize headers, message labels, colors, borders, and content transformations.

### Display Configuration Options

```typescript
interface DisplayConfig {
  /** Function to transform the entire message display based on message role */
  onMessage?: (message: UIMessage) => string;

  /** Custom header for the workflow */
  header?: string;

  /** Message type customization */
  messageTypes?: {
    toolCall?: MessageDisplayOptions;
    assistant?: MessageDisplayOptions;
    user?: MessageDisplayOptions;
    toolResponse?: MessageDisplayOptions;
    ui?: MessageDisplayOptions;
  };

  /** Global theme overrides */
  theme?: ThemeOptions;
}
```

### Message Display Options

```typescript
interface MessageDisplayOptions {
  /** Simple string label for the message type */
  label?: string;

  /** Text color (chalk color name, hex, or theme reference) */
  color?: string;

  /** Whether to display as bold */
  bold?: boolean;

  /** Container styling */
  border?: {
    style?: "single" | "double" | "round" | "bold";
    color?: string;
  };

  /** Background color */
  backgroundColor?: string;

  /** Text color override */
  textColor?: string;

  /** Margin/padding adjustments */
  spacing?: {
    marginLeft?: number;
    marginTop?: number;
    marginBottom?: number;
  };
}
```

### Theme System

Define reusable colors that can be referenced throughout your display configuration:

```typescript
interface ThemeOptions {
  primary?: string; // Main brand color
  accent?: string; // Secondary accent color
  success?: string; // Success/positive color
  warning?: string; // Warning color
  error?: string; // Error/danger color
  muted?: string; // Muted/secondary text color
}
```

### Display Customization Examples

**Basic Customization with Custom Header:**

```javascript
const workflow = createAgentWorkflow((hooks) => {
  // ... your agent logic

  return {
    displayConfig: {
      header: "My Custom Agent",
      messageTypes: {
        assistant: {
          label: "🤖 AI Assistant",
          color: "magentaBright",
          bold: true,
        },
        user: {
          label: "👤 You",
          color: "blueBright",
        },
      },
    },
    // ... other workflow methods
  };
});
```

**Advanced Theming with Content Transformation:**

```javascript
const workflow = createAgentWorkflow((hooks) => {
  // ... your agent logic

  return {
    displayConfig: {
      header: "Let's play 20 questions!",
      theme: {
        primary: "#00ff88",
        accent: "#ff6b35",
        success: "#28a745",
      },
      onMessage: (message) => {
        // Transform messages based on their role and content
        const content = Array.isArray(message.content)
          ? message.content.find((part) => part.type === "text")?.text || ""
          : message.content;

        if (message.role === "assistant") {
          // Check if this is a tool call message
          if (Array.isArray(message.content)) {
            const toolCall = message.content.find(
              (part) => part.type === "tool-call",
            );
            if (toolCall?.toolName === "user_select") {
              const args = toolCall.args;
              return `❓ ${args.message}\\n📝 Options: ${args.options.map((opt) => opt.label).join(" | ")}`;
            }
            if (toolCall) {
              return "Processing your selection...";
            }
          }

          // Regular assistant messages - add game-specific formatting
          if (content.includes("?")) {
            return `🎯 ${content}`;
          }
          return content;
        }

        if (message.role === "tool") {
          // Parse and display user selections clearly
          if (Array.isArray(message.content)) {
            const result = message.content.find(
              (part) => part.type === "tool-result",
            );
            if (result?.result) {
              try {
                const parsed = JSON.parse(result.result);
                if (parsed.output) {
                  return `🎯 You selected: "${parsed.output}"`;
                }
              } catch (e) {
                // fallback
              }
            }
          }
          return message.content;
        }

        // Default fallback
        return content;
      },
      messageTypes: {
        assistant: {
          label: "🎮 Game Master",
          color: "primary", // References theme.primary
        },
        toolCall: {
          label: "🎮 Interactive Question",
          color: "success",
          border: { style: "round", color: "accent" },
        },
        toolResponse: {
          label: "✅ Your Choice",
          color: "success",
        },
      },
    },
    // ... other workflow methods
  };
});
```

**Using with Default Workflow:**

```javascript
const workflow = createDefaultWorkflow({
  model: "openai/gpt-4o",
  displayConfig: {
    header: "Custom Code Assistant",
    theme: {
      primary: "#007acc",
      accent: "#f39c12",
    },
    messageTypes: {
      assistant: {
        label: "💻 Code Assistant",
        color: "primary",
      },
      user: {
        label: "👨‍💻 Developer",
        color: "accent",
      },
    },
  },
});
```

### Message Types

The system recognizes 5 distinct message types:

- **`assistant`**: Regular AI responses without tool calls
- **`toolCall`**: AI messages that contain tool calls (detected automatically from content array)
- **`user`**: User input messages
- **`toolResponse`**: Results from tool executions
- **`ui`**: System/status messages from the library

### Color System

Colors can be specified as:

- **Chalk color names**: `"red"`, `"blueBright"`, `"magentaBright"`, etc.
- **Hex codes**: `"#ff0000"`, `"#00ff88"`, etc.
- **Theme references**: `"primary"`, `"accent"`, `"success"`, etc. (references your theme colors)

---

### WorkflowState Structure

The state managed by your workflow has the following structure:

```typescript
interface WorkflowState {
  loading: boolean; // Whether the agent is currently processing
  messages: Array<UIMessage>; // Array of all messages (user, assistant, tool, ui)
  inputDisabled: boolean; // Whether user input should be disabled
  queue?: Array<string>; // Optional queue of pending messages for display
  transcript?: Array<UIMessage>; // Derived: messages filtered to exclude UI messages
}
```

Message types in the `messages` array include:

- **"user"** - User input messages
- **"assistant"** - AI responses
- **"tool"** - Tool execution results
- **"ui"** - Status/system messages

### Queue System

The SDK includes a queue system for displaying pending messages while the agent is processing. This is useful for showing users what requests are queued up during loading states.

- **Visual Display**: The queue appears as a bordered box above the loading indicator, showing numbered items
- **Consumer-Managed**: Queue contents are entirely managed by your workflow logic
- **User Flow**: When users type during loading, `message()` is called normally - your workflow decides whether to queue the input

Example usage:

```javascript
// In your agent workflow - add items to queue
hooks.setState({ loading: true });
hooks.addToQueue(["Analyze the data", "Generate report"]);

// Later, process queue items
const nextItem = hooks.unshiftQueue();
if (nextItem) {
  // Process the next item...
  console.log(`Processing: ${nextItem}`);
}
```

### Clean LLM Integration with `state.transcript`

The `state.transcript` property provides a filtered view of messages perfect for LLM calls:

```javascript
const workflow = createAgentWorkflow(({ state, appendMessage, ... }) => {
  // Your conversation includes UI messages for user feedback
  console.log(state.messages.length);     // 8 messages (includes UI status)
  console.log(state.transcript.length);   // 5 messages (clean LLM input)

  // Perfect for LLM calls - automatically excludes UI messages
  const response = await generateText({
    model: openai("gpt-4o"),
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      ...state.transcript, // Clean conversation history
    ],
    tools,
  });
});
```

### The `agentLogicFunction(hooks)`

This is the function you provide to `createAgentWorkflow`. It's where your custom agent's intelligence and main processing loop reside. The SDK calls this function, providing it with a `hooks` object to interact with the UI and tools.

- **Parameters (provided by the SDK to your function):**

  - `hooks` (`object`): An object containing functions and data to interact with the SDK:
    - `hooks.setState(state)` (`function`): Updates the workflow state declaratively.
      - **Input:** `state` (`Partial<WorkflowState> | ((prev: WorkflowState) => WorkflowState)`): Either a partial state object to merge or an updater function.
      - **Returns:** `Promise<void>`: Promise that resolves when UI has been updated (for compatibility).
      - **Synchronous behavior:** State changes are applied immediately and are visible via `state.loading` without awaiting.
      - **Merging behavior:** Like React's setState, only top-level properties are merged. Arrays and nested objects are replaced entirely. To append messages, use `appendMessage()` or the function form: `setState(prev => ({ ...prev, messages: [...prev.messages, newMsg] }))`.
    - `hooks.state` (`object`): Current workflow state with getter properties.
      - **Synchronous access:** Properties reflect current state immediately, including any changes made by recent `setState()` calls.
      - **Properties:**
        - `state.loading` - Whether the agent is currently processing
        - `state.messages` - Array of all messages (user, assistant, tool, ui)
        - `state.inputDisabled` - Whether user input should be disabled
        - `state.queue` - Array of queued messages for display
        - `state.transcript` - **Derived property:** Messages filtered to exclude UI messages (perfect for LLM calls)
      - **Usage:** Access via `hooks.state.loading` instead of `hooks.getState().loading`.
    - `hooks.appendMessage(message)` (`function`): Appends message(s) to the current messages array.
      - **Input:** `message` (`UIMessage | Array<UIMessage>`): A single message or array of messages to append.
      - **Returns:** `void`.
      - **Usage:** This is a convenience method for the common operation of appending messages. Equivalent to `setState(prev => ({ ...prev, messages: [...prev.messages, ...messages] }))`.
    - `hooks.addToQueue(item)` (`function`): Adds item(s) to the end of the queue.
      - **Input:** `item` (`string | Array<string>`): Single string or array of strings to add to the queue.
      - **Returns:** `void`.
      - **Usage:** Convenience method for adding items to the queue. Equivalent to `setState(prev => ({ ...prev, queue: [...(prev.queue || []), ...items] }))`.
    - `hooks.unshiftQueue()` (`function`): Removes and returns the first item from the queue.
      - **Returns:** `string | undefined`: The first queue item, or `undefined` if queue is empty.
      - **Usage:** Convenience method for consuming queue items. Equivalent to manually checking queue length, getting first item, and updating state to remove it.
    - `hooks.handleToolCall(aiMessageWithToolCall)` (`function`): Executes tool calls requested by the AI.
      - **Input:** `aiMessageWithToolCall` (`object`): The AI's message object that includes a `tool_calls` array.
      - **Returns:** `Promise<object | null>`: A promise that resolves to a tool response message (for the AI and UI) or `null` if no specific response is needed beyond the tool's side effects.
    - `hooks.tools` (`Array<object>`): An array of tool definitions that the library supports (e.g., for shell commands, file operations, and user interactions). You should pass these to your AI model so it knows what tools it can request.
    - `hooks.onConfirm(prompt, options?)` (`function`): **Deprecated** - Use `onSelect` with Yes/No options instead.
    - `hooks.onPrompt(message, options?)` (`function`): **Deprecated** - Use `onSelect` with suggested options instead.
    - `hooks.onSelect(items, options?)` (`function`): Shows a selection dialog to the user.
      - **Input:** `items` (`Array<{label: string, value: string}>`): Items to choose from.
      - **Input:** `options` (`object`, optional): Selection options.
        - `options.required` (`boolean`, optional): Whether selection is required.
        - `options.default` (`string`, optional): Default value for escape key.
        - `options.label` (`string`, optional): Custom label for the selection.
        - `options.timeout` (`number`, optional): Timeout in seconds after which default value is automatically selected.
        - `options.defaultValue` (`string`, required if timeout specified): Default value to use when timeout expires (must match one of the item values).
      - **Returns:** `Promise<string>`: The selected value.
    - `hooks.logger(message)` (`function`): Logs debug messages.
      - **Input:** `message` (`string`): The message to log.
      - **Returns:** `void`.
    - `hooks.onError(error)` (`function`, optional): Error handler callback.
      - **Input:** `error` (`unknown`): The error that occurred.
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
