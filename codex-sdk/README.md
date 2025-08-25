# Codex SDK

A powerful TypeScript SDK for building AI-powered terminal applications with rich interactive workflows.

## 🚀 Key Features

### **Multi-Workflow Environment** ⭐ _Primary Feature_

Run multiple AI assistants simultaneously with seamless switching and state management:

- **Concurrent Workflows**: Multiple AI assistants running in parallel, each with independent state
- **Instant Switching**: Use `Ctrl+]` / `Ctrl+[` or `/switch` command to navigate between workflows
- **Persistent State**: Each workflow maintains its own conversation history and context
- **Tabbed Interface**: Visual tabs at the bottom show all active workflows
- **Dynamic Creation**: Create new workflow instances on-the-fly with `/new` command
- **Hotkey Navigation**: `Ctrl+1-9` for direct workflow access

### **Rich Terminal UI**

- Beautiful command-line interface with syntax highlighting
- Real-time message streaming and typing indicators
- Interactive command approval system with multiple policies
- File system integration with secure sandbox execution
- Queue management and task list visualization

### **Flexible Architecture**

- TypeScript-first with full type safety
- Extensible workflow system with custom tools
- Headless mode for programmatic usage
- Comprehensive state management with hooks
- Built-in approval modes: `suggest`, `auto-edit`, `full-auto`

## 📦 Installation

```bash
npm install codex-sdk
```

## 🎯 Quick Start

### Single Workflow

```javascript
import { createAgentWorkflow, run } from "codex-sdk";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const workflow = createAgentWorkflow("My Assistant", ({ actions, tools }) => {
  return {
    async initialize() {
      actions.say("Hello! I'm your AI assistant. How can I help?");
    },

    async message(input) {
      actions.setLoading(true);

      const result = await generateText({
        model: openai("gpt-4o"),
        system: "You are a helpful assistant.",
        messages: state.transcript,
        tools: tools.definitions,
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

// Run single workflow
run(workflow);
```

### **Multi-Workflow Environment** 🌟

```javascript
import { createAgentWorkflow, runMultiWorkflows } from "codex-sdk";

// Define your AI assistants
const codeAssistant = createAgentWorkflow(
  "Code Assistant",
  ({ actions, tools }) => ({
    async initialize() {
      actions.say("Ready to help with coding tasks!");
    },

    async message(input) {
      // Your coding-focused AI logic here
    },

    stop() {},
    terminate() {},
  }),
);

const researchAssistant = createAgentWorkflow(
  "Research Assistant",
  ({ actions, tools }) => ({
    async initialize() {
      actions.say("I can help you research any topic!");
    },

    async message(input) {
      // Your research-focused AI logic here
    },

    stop() {},
    terminate() {},
  }),
);

// Run multiple workflows with seamless switching
runMultiWorkflows([codeAssistant, researchAssistant], {
  // Start with both workflows active
  initialWorkflows: [{ id: "code-assistant" }, { id: "research-assistant" }],

  // Optional configuration
  approvalPolicy: "suggest",
  config: {
    notify: true,
    title: "My AI Workspace",
  },
});
```

## 🎮 Multi-Workflow Controls

| Command    | Description                  |
| ---------- | ---------------------------- |
| `/switch`  | Show workflow picker         |
| `/new`     | Create new workflow instance |
| `Ctrl+]`   | Switch to next workflow      |
| `Ctrl+[`   | Switch to previous workflow  |
| `Ctrl+1-9` | Jump to workflow by number   |

## 🛠️ Workflow API

### Core Hooks

```typescript
const workflow = createAgentWorkflow(
  "My Workflow",
  ({ actions, state, tools, control }) => {
    // State management
    actions.setLoading(true);
    actions.say("Status message");
    actions.addMessage({ role: "assistant", content: "Response" });

    // Queue management
    actions.addToQueue("Task 1", "Task 2");
    const next = actions.removeFromQueue();

    // Task lists
    actions.addTask("Complete documentation");
    actions.toggleTask(0); // Mark first task as done

    // Tool execution
    const toolResponses = await actions.handleModelResult(result);

    return {
      initialize: async () => {
        /* Setup logic */
      },
      message: async (input) => {
        /* Handle user input */
      },
      stop: () => {
        /* Pause workflow */
      },
      terminate: () => {
        /* Cleanup and exit */
      },
    };
  },
);
```

### Advanced Features

#### Custom Display Configuration

```typescript
const workflow = createAgentWorkflow("Custom UI", ({ actions }) => ({
  displayConfig: {
    header: <Text bold color="blue">🤖 My AI</Text>,
    formatRoleHeader: (message) => {
      return message.role === "user"
        ? <Text color="blue">👤 You</Text>
        : <Text color="blueBright">🤖 AI</Text>;
    },
    tabs: {
      // Custom header for workflow tabs (null to hide)
      header: "My Workflows",

            // Styling for active tabs
      activeTab: {
        color: "black",
        backgroundColor: "green",
        bold: true
      },

      // Styling for inactive tabs
      inactiveTab: {
        color: "gray",
        dimColor: true
      },

      // Header styling
      headerStyle: {
        color: "white",
        bold: true,
        marginBottom: 1
      },

      // Container layout
      containerProps: {
        marginBottom: 2,
        paddingX: 1
      }
    }
  },
  // ... workflow logic
}));
```

#### Tab Configuration Options

The `tabs` section in `displayConfig` provides complete customization of workflow tabs:

**Header Configuration:**

- `header?: string | null` - Custom header text. Defaults to "Active Workflows". Set to `null` to hide header.

**Styling Options:**

- `activeTab` - Colors and styling for the currently selected tab
- `inactiveTab` - Colors and styling for non-selected tabs
- `headerStyle` - Styling for the section header text
- `instructionStyle` - Styling for the "Press Ctrl+[...]" instruction text
- `containerProps` - Layout properties for the tabs container

**Available Style Properties:**

- `color` - Text color (e.g., "blue", "green", "red", "gray", "white")
- `backgroundColor` - Background color for tabs
- `bold` - Bold text styling
- `dimColor` - Dimmed text appearance
- `marginTop/marginBottom` - Spacing around elements
- `paddingX/paddingY` - Internal padding

**Recommended Color Scheme:**

- **Highlight**: "blue" (main emphasis color)
- **Selected**: "green" (active/current selections)
- **Muted**: "gray" (de-emphasized text)
- **Normal**: "white" (regular text)
- **Error**: "red" (errors only)

#### Slot System for Custom UI Elements

```typescript
actions.setSlot("aboveInput", <Text>Hint: Try asking about...</Text>);
actions.setSlot("belowHistory", <ProgressBar percent={75} />);
```

#### Custom Commands

```typescript
const workflow = createAgentWorkflow("With Commands", ({ actions }) => ({
  commands: {
    reset: {
      description: "Reset conversation",
      handler: () => actions.say("Conversation reset!"),
    },
    analyze: {
      description: "Analyze current context",
      handler: (args) => {
        /* Custom logic */
      },
    },
  },
  // ... workflow logic
}));
```

## 🔒 Security & Approval Modes

Control how your AI assistants execute commands:

- **`suggest`** (default): Ask for approval before executing commands
- **`auto-edit`**: Auto-approve file edits, ask for other commands
- **`full-auto`**: Auto-approve all commands (use with caution)

```javascript
runMultiWorkflows(workflows, {
  approvalPolicy: "suggest", // Safe default
  additionalWritableRoots: ["/safe/directory"], // Limit file access
});
```

## 📚 Examples

The SDK includes comprehensive examples:

- **Simple Agent**: Basic AI assistant
- **Research Assistant**: Specialized research workflows with sources
- **Coding Agent**: Code analysis and editing workflows
- **Text Adventure Game**: Interactive storytelling with choices
- **Deploy Dashboard**: DevOps workflows with progress tracking
- **Queue Demo**: Task queue management
- **Codebase Quiz**: Interactive code learning
- **Multi-Workflow Demo**: Complete multi-assistant setup

Run any example:

```bash
node examples/multi-workflow-demo.js
```

## 🏗️ Architecture

### Single vs Multi-Workflow

| Feature            | Single (`run`) | Multi (`runMultiWorkflows`)  |
| ------------------ | -------------- | ---------------------------- |
| Concurrent AIs     | ❌             | ✅ Multiple assistants       |
| State Isolation    | N/A            | ✅ Independent contexts      |
| Workflow Switching | ❌             | ✅ Instant switching         |
| Dynamic Creation   | ❌             | ✅ Runtime workflow creation |
| Visual Tabs        | ❌             | ✅ Tab-based navigation      |

### Performance

- **Mount-All Strategy**: All workflows stay mounted for instant switching
- **Selective Rendering**: Hidden workflows return `null` (no layout cost)
- **React.memo Optimization**: Prevents unnecessary re-renders
- **State Persistence**: No data loss when switching between workflows

## 🔧 Advanced Configuration

### Headless Mode

```javascript
import { runMultiWorkflows } from "codex-sdk";

const controllers = runMultiWorkflows(workflows, {
  headless: true, // No terminal UI
  approvalPolicy: "auto-edit",
});

// Programmatic control
controllers.getControllers().forEach((controller) => {
  controller.message("Analyze the codebase");
});
```

### Custom Tool Integration

```typescript
const workflow = createAgentWorkflow("With Tools", ({ tools }) => {
  // Access built-in tools
  const { shell, apply_patch, user_select } = tools.definitions;

  // Execute tools directly
  await tools.execute(toolCalls, { abortSignal });

  return {
    /* workflow implementation */
  };
});
```

### TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import {
  WorkflowFactory,
  WorkflowHooks,
  MultiWorkflowOptions,
  AvailableWorkflow,
} from "codex-sdk";

const typedWorkflow: WorkflowFactory = createAgentWorkflow(/* ... */);
```

## 📄 License

Apache-2.0

## 🤝 Contributing

We welcome contributions! The multi-workflow system is designed to be extensible - add your own workflow types, UI components, and tools.

---

**⭐ Star this repository if you find Codex SDK useful!**

_Build the next generation of AI-powered terminal applications with seamless multi-workflow management._
