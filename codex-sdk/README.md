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
- **Hotkey Navigation**: Quick workflow switching with keyboard shortcuts

### **Rich Terminal UI**

- Beautiful command-line interface with syntax highlighting
- Real-time message streaming and typing indicators
- Interactive command approval system with multiple policies
- File system integration with secure sandbox execution
- Queue management and task list visualization
- **File System Autocompletion**: Smart `@filename` syntax with Tab completion
- **Desktop Notifications**: Optional system notifications for AI responses
- **Multi-Modal Overlays**: History, help, approval, selection, and prompt interfaces

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

| Command         | Description                  |
| --------------- | ---------------------------- |
| `/switch`       | Show workflow picker         |
| `/new`          | Create new workflow instance |
| `/help`         | Show available commands      |
| `/history`      | View command history         |
| `/approval`     | Change approval mode         |
| `/clearhistory` | Clear command history        |
| `Ctrl+]`        | Switch to next workflow      |
| `Ctrl+[`        | Switch to previous workflow  |

### **Interactive Overlays**

The SDK provides several interactive overlay modes:

- **History Overlay** (`/history`): Browse command history with `j/k` navigation
- **Help Overlay** (`/help`): View all available slash commands
- **Approval Overlay** (`/approval`): Switch between approval policies
- **Selection Overlay**: Multi-choice selections with arrow key navigation
- **Prompt Overlay**: Text input dialogs with validation
- **Confirmation Overlay**: Yes/No confirmation dialogs

## 💡 **File System Integration**

### **Smart File Autocompletion**

The SDK provides intelligent file system autocompletion with `@filename` syntax:

```typescript
// In your message input, type:
@src/components/    // Press Tab to see completions
@package.json       // Auto-completes to exact file
@./README.md        // Relative path completion
```

**Features:**

- **Prefix Matching**: Type `@src/` and Tab to see all files in `src/`
- **Directory Navigation**: Navigate directories with Tab completion
- **Relative Paths**: Support for `./` and `../` path patterns
- **Smart Filtering**: Real-time filtering as you type
- **Keyboard Navigation**: Use arrow keys to select from completions

### **Desktop Notifications**

Get system notifications when AI assistants complete responses:

```javascript
runMultiWorkflows(workflows, {
  config: {
    notify: true, // Enable desktop notifications
  },
});
```

**Configuration:**

- Notifications appear when workflows finish processing
- Includes workflow name and response preview
- Respects system notification settings
- Can be enabled/disabled per session

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

The slot system allows you to inject custom UI components at specific locations:

```typescript
// Available slot positions
actions.setSlot("aboveHeader", <EnvBanner env="prod" />);
actions.setSlot("belowHeader", <ReleaseSummary version="v1.2.3" />);
actions.setSlot("aboveHistory", <ProgressBar percent={75} />);
actions.setSlot("belowHistory", <StatusIndicator />);
actions.setSlot("aboveInput", <Text>Hint: Try asking about...</Text>);
actions.setSlot("belowInput", <HelpText />);
```

**Available Slot Positions:**

- `aboveHeader` - Content above the terminal header
- `belowHeader` - Content below the terminal header
- `aboveHistory` - Content above the conversation history
- `belowHistory` - Content below the conversation history
- `aboveInput` - Content above the input field
- `belowInput` - Content below the input field

**Use Cases:**

- Progress indicators and status displays
- Environment banners and build information
- Contextual hints and help text
- Custom toolbars and action buttons

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

## ⚙️ Configuration Reference

### **Workflow Configuration**

Configure tools and security at the workflow level:

```javascript
run(workflow, {
  approvalPolicy: "suggest",
  config: {
    // Tool configuration
    tools: {
      shell: {
        maxBytes: 1024 * 1024, // 1MB max shell output
        maxLines: 1000, // 1000 lines max shell output
      },
    },

    // User-defined safe commands (no approval required)
    safeCommands: [
      "git status",
      "npm test",
      "npm run build",
      "docker ps",
      "kubectl get pods",
    ],

    // Custom headers in terminal
    headers: [
      { label: "Environment", value: "production" },
      { label: "Version", value: "1.2.3" },
    ],

    // Custom status line
    statusLine: "Ready for deployment",
  },
});
```

### **Multi-Workflow Configuration**

Apply configuration across multiple workflows:

```javascript
runMultiWorkflows(workflows, {
  approvalPolicy: "auto-edit", // Default policy for all workflows
  config: {
    tools: {
      shell: {
        maxBytes: 512 * 1024, // 512KB limit
        maxLines: 500, // 500 lines limit
      },
    },
    safeCommands: ["git status", "npm test"],
    headers: [{ label: "Mode", value: "Multi-Workflow" }],
  },
});
```

### **Safe Commands**

Define commands that don't require approval for automatic execution:

```javascript
config: {
  safeCommands: [
    // Exact command matches
    "git status",           // Matches exactly "git status"
    "npm test",            // Matches exactly "npm test"

    // Command name matches (any arguments allowed)
    "ls",                  // Matches "ls", "ls -la", "ls /path", etc.
    "pwd",                 // Matches "pwd" with any arguments
    "kubectl",             // Matches any kubectl command
  ],
}
```

**How Safe Commands Work:**

- Commands in `safeCommands` bypass approval dialogs
- Supports both exact command matching and command name matching
- Built-in safe commands: `cd`, `ls`, `pwd`, `cat`, `grep`, `git status`, etc.
- User-defined safe commands are checked alongside built-in ones
- Useful for frequently used read-only or safe operations

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
