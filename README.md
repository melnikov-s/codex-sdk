<h1 align="center">Codex SDK</h1>
<p align="center"><b>Build powerful, human-in-the-loop terminal AI workflows.</b></p>

---

## What is Codex SDK?

While simple agent loops can run uninterrupted, the most powerful workflows involve collaboration. Codex SDK is designed specifically for building **human-in-the-loop** terminal agents that can ask questions, get feedback, and work alongside the user.

**Codex SDK handles the hard parts of interactive terminal UI, so you can focus on your agent's logic.**

It's a lightweight framework for creating bespoke agents using the Vercel AI SDK v5. It provides a polished terminal UI, secure tool execution, and a minimal workflow API that makes building interactive, collaborative agents simple.

Originally a fork of the OpenAI Codex CLI, this SDK has been refactored into a reusable library for building custom agentic workflows.

### Core Features

- **Human-in-the-Loop Interaction**: Build agents that can pause to ask questions, present options, and request confirmation from the user before proceeding.
- **Secure Tool Execution**: Safely allow the agent to run terminal commands and modify files with a multi-level approval system that keeps the user in control.
- **Advanced Terminal UI**: A polished, Ink-based interface for message history, multi-line input, status indicators, and more.
- **Display Customization**: Tailor the look and feel of your agent with a powerful theming system, custom message rendering, and configurable headers and borders.
- **Task Queue System**: Manage and display a queue of pending tasks to the user, providing transparency while the agent is processing.
- **Flexible Agent Loop**: You own the agent logic. Plug into Vercel AI SDK v5 and any supported model provider (OpenAI, Anthropic, Google, etc.).

### Requirements

- Node >= 22
- Vercel AI SDK v5 (`ai@^5`)
- A model provider package (e.g., `@ai-sdk/openai`)

### Installation

```shell
pnpm add codex-sdk ai@^5
# Add your preferred model provider
pnpm add @ai-sdk/openai@^2
```

## Quickstart: A Simple Agent in 20 Lines

This example creates a helpful assistant that can use tools.

```javascript
// minimal-agent.js
import { run, createAgentWorkflow } from "codex-sdk";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const workflow = createAgentWorkflow(
  ({ state, setState, addMessage, handleModelResult, tools }) => {
    return {
      // Set an initial "Ready" message
      initialize: async () => {
        setState({ messages: [{ role: "ui", content: "Ready." }] });
      },
      // This is the core loop, called on every user input
      message: async (userInput) => {
        addMessage(userInput);
        setState({ loading: true });

        const result = await generateText({
          model: openai("gpt-4o"),
          system: "You are a helpful assistant.",
          messages: state.transcript, // transcript conveniently excludes UI messages
          tools,
        });

        // handleModelResult adds the AI response, executes tools,
        // and adds tool results to the message history automatically.
        await handleModelResult(result);

        setState({ loading: false });
      },
      // Cleanup methods for user interruption
      stop: () => setState({ loading: false }),
      terminate: () => setState({ loading: false, messages: [] }),
    };
  },
);

run(workflow);
```

## Why Codex SDK vs. Other Agents?

Tools like GitHub Copilot, Cursor, and Claude Code are powerful, integrated assistants. They excel at general-purpose coding tasks but operate within their own fixed systems. You work around their limitations.

**Codex SDK gives you ultimate control.**

This is a framework for developers who need to build specialized agents with precise control over the entire workflow. Because you own the agent loop, you can:

- **Engineer the Perfect Context:** Craft the exact history and system prompts sent to the model. You aren't limited by the context window or prompting strategy of a third-party tool. This precision is key to solving complex, domain-specific problems.
- **Integrate Custom Tools:** Go beyond simple shell commands. Build any tool you can express in code and integrate it seamlessly into your agent's capabilities.
- **Define Unique Workflows:** Implement multi-step chains, custom human-in-the-loop approval gates, or complex logic that commercial assistants don't support.

If you need a highly tailored, powerful, and flexible terminal agent, Codex SDK provides the foundation.

## How It Works

Codex SDK divides the work of building an agent between the library and your code, letting you focus on the agent's unique logic.

**What the SDK Handles:**

- **Terminal UI:** Renders the entire interactive experience, including message history, user input, status indicators, and interactive prompts.
- **State Management:** Orchestrates the application state and ensures the UI always reflects the current status.
- **Tool Execution & Security:** Manages the secure execution of tools, handling user approvals and sandboxing for file modifications and shell commands.

**What You Provide:**

- **The Agent Logic:** You define the core intelligence of your agent. This is where you decide when to call an LLM, what to say, which tools to use, and how to respond to user input.

This relationship is managed through a simple event-driven loop. The SDK listens for user input and lifecycle events (like starting or stopping) and calls the corresponding functions in your agent logic. Your code then uses hooks provided by the SDK to update the UI, add messages to the history, and request that tools be executed.

For example, when a user sends a message:

1.  The SDK captures the input and calls your `message` handler.
2.  Your code receives the input, calls your preferred LLM with the conversation history, and gets a response.
3.  Your code uses an SDK hook to add the AI's response to the UI.
4.  If the AI requested a tool, your code uses another hook to ask the SDK to execute it. The SDK handles the security and approval flow, then returns the result to your logic to continue the loop.

This model gives you full control over the agent's brain while the SDK manages the body.

## Examples

For more advanced use cases, check out the examples directory:

- `examples/simple-agent.js`: The minimal agent from the Quickstart, ready to run.
- `examples/codebase-quiz.js`: An agent that quizzes you on your own codebase.
- `examples/text-adventure-game.js`: A mini D&D-style text adventure that shows off advanced display customization and human-in-the-loop interaction.
- `examples/project-setup-assistant.js`: A multi-step agent that helps set up a new project.

## Security & Approvals

The SDK is designed for safety. When the agent wants to run a shell command or modify files using `handleToolCall`, its capabilities are restricted by an `approvalPolicy`.

| Mode          | What the agent may do without asking                        | Still requires approval (managed by the library)                   |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| **Suggest**   | <li>Read any file in the repo                               | <li>**All** file writes/patches<li>**Any** arbitrary shell command |
| **Auto Edit** | <li>Read **and** apply patches to files                     | <li>**All** shell commands                                         |
| **Full Auto** | <li>Read/write files <li>Execute shell commands (sandboxed) | -                                                                  |

By default, even in **Full Auto**, commands are run **network-disabled** and confined to the current working directory for defense-in-depth using platform-specific sandboxing (Apple Seatbelt on macOS).

## API Reference

This section provides detailed documentation for the core APIs, display customization, and state management.

---

### `run(workflowFactory, options?)`

Starts the terminal UI using your workflow factory.

- **`workflowFactory`**: The object returned by `createAgentWorkflow`.
- **`options.approvalPolicy`** (optional): Controls tool approvals (`AutoApprovalMode.SUGGEST`, `AutoApprovalMode.AUTO_EDIT`, `AutoApprovalMode.FULL_AUTO`).

---

### `createAgentWorkflow(agentLogicFunction)`

Wraps your function into a `WorkflowFactory` the UI can execute. This is the primary helper for building your custom agent. Your function receives a `hooks` object and must return an `AgentObject`.

---

### Display Customization

You can provide a `displayConfig` object from your `agentLogicFunction`'s return value to customize the look and feel of your agent with full React component control.

**Example:**

```javascript
import { Text, Box } from "ink";
import React from "react";

// In your agentLogicFunction
return {
  displayConfig: {
    // Custom header as ReactNode
    header: (
      <Text bold color="#d4af37">
        🤖 My Custom Agent
      </Text>
    ),

    // Format role headers for each message
    formatRoleHeader: (message) => {
      if (message.role === "assistant") {
        return (
          <Text bold color="magentaBright">
            🤖 AI Assistant
          </Text>
        );
      }
      if (message.role === "user") {
        return (
          <Text bold color="blueBright">
            👤 You
          </Text>
        );
      }
      return <Text bold>{message.role}</Text>;
    },

    // Format message content with full React control
    formatMessage: (message) => {
      const content = Array.isArray(message.content)
        ? message.content.find((part) => part.type === "text")?.text || ""
        : message.content;

      if (message.role === "assistant" && content.includes("error")) {
        return <Text color="red">❌ {content}</Text>;
      }

      return (
        <Box borderStyle="round" paddingX={1}>
          <Text>{content}</Text>
        </Box>
      );
    },
  },
  // ... other workflow methods
};
```

#### `DisplayConfig` Object

- **`header`**: A `ReactNode` to display as a custom header for the workflow. Use Ink components like `<Text>` and `<Box>` for styling.
- **`formatRoleHeader`**: A function `(message: UIMessage) => ReactNode` that renders the role/label for each message. Return any React component with full control over styling, colors, and layout.
- **`formatMessage`**: A function `(message: UIMessage) => ReactNode` that renders the message content. Use this for complete customization of message appearance, including conditional styling, borders, colors, and complex layouts.

The ReactNode approach gives you complete control over styling with Ink's `<Text>`, `<Box>`, and other components, allowing for dynamic colors, borders, conditional formatting, and complex layouts that weren't possible with the previous string-based API.

---

### The `agentLogicFunction(hooks)`

This is the function you provide to `createAgentWorkflow`. It's where your agent's intelligence resides. It receives a `hooks` object with the following properties:

- **`state`**: A read-only object containing the current workflow state:
  - `loading`: `boolean` - Whether the agent is currently processing.
  - `messages`: `Array<UIMessage>` - The complete history of all message types.
  - `inputDisabled`: `boolean` - Whether the user input is currently disabled.
  - `queue`: `Array<string>` - The current queue of pending tasks for display.
  - `transcript`: `Array<UIMessage>` - A clean version of `messages` excluding "ui" messages, perfect for sending to an LLM.
- **`setState(newState)`**: Updates the workflow state. It merges top-level properties, like React's `setState`.
- **`addMessage(message)`**: A convenience method to append one or more messages to the history.
- **`tools`**: An array of tool definitions that the library supports. Pass these to your AI model so it knows what tools it can call.
- **`handleModelResult(result)`**: A powerful convenience function that takes the raw result from an AI model call and orchestrates the next steps: it adds the AI's response messages to the history, securely executes any requested tool calls, and then adds the tool results back to the history, returning the tool responses.
- **`handleToolCall(messages)`**: The underlying function to execute tool calls requested by the AI. `handleModelResult` uses this internally.
- **`onSelect(items, options?)`**: Prompts the user to choose from a list of options. Returns a promise with the selected value.
- **`onConfirm(message, options?)`**: Prompts the user with a yes/no question. Returns a promise with the boolean result.
- **`onPrompt(message, options?)`**: Prompts the user for freeform text input. Returns a promise with the string result.
- **`addToQueue(items)` / `unshiftQueue()`**: Methods to manage the task queue displayed in the UI.
- **`logger(message)`**: A function to log debug messages.
- **`onError(error)`**: An optional error handler callback for the workflow.

---

### The `AgentObject` (returned by your `agentLogicFunction`)

This is the object your `agentLogicFunction` must return. It defines the lifecycle methods for your agent.

- **`initialize()`**: Called once when the agent starts. Use for setup or sending a welcome message.
- **`message(userInputMessage)`**: Called whenever the user submits input. This is the main entry point for your agent's processing loop.
- **`stop()`**: Called when the user interrupts the agent (e.g., `Esc`). Your agent should halt processing.
- **`terminate()`**: Called when the user quits (e.g., `Ctrl+C`). Your agent should stop and clear its state.
- **`commands`**: An object defining custom slash commands (e.g., `/compact`) that can be triggered by the user from the input line.
- **`displayConfig`**: The display configuration object described above.

---

### `WorkflowState` Structure

The `state` object managed by your workflow has the following structure:

```typescript
interface WorkflowState {
  loading: boolean;
  messages: Array<UIMessage>;
  inputDisabled: boolean;
  queue?: Array<string>; // Optional queue of pending messages
  transcript?: Array<UIMessage>; // Derived: messages filtered to exclude UI messages
  statusLine?: ReactNode; // Optional status line displayed above the input
}
```

The `state.transcript` property provides a clean message history (excluding "ui" messages) that is perfect for sending to an LLM.

The `state.statusLine` property allows you to display custom status information above the terminal input. You can set it to any React component or simple text using `setState({statusLine: "Processing..."})` or `setState({statusLine: <Text color="green">✓ Ready</Text>})`.

---

## License

This repository is licensed under the [Apache-2.0 License](LICENSE).
