# Codex SDK

A TypeScript SDK for building AI-powered terminal applications with interactive workflows.

## 🚀 Key Features

### Multi-Workflow Environment

Run multiple AI assistants simultaneously with seamless switching and state management:

- Multiple AI assistants running in parallel, each with independent state
- Use `Ctrl+P` / `Ctrl+O` or `Ctrl+K` command palette to navigate between workflows
- Each workflow maintains its own conversation history and context
- Visual tabs at the bottom show all active workflows
- Create workflow instances on-the-fly with `Ctrl+K` command palette
- Quick workflow switching with keyboard shortcuts

### Terminal UI

- Command-line interface with syntax highlighting
- Real-time message streaming and typing indicators
- Interactive command approval system with multiple policies
- File system integration with secure sandbox execution
- Queue management and task list visualization
- File system autocompletion with `@filename` syntax and Tab completion
- Optional system notifications for AI responses
- History, help, approval, selection, and prompt interfaces

### Architecture

- TypeScript-first with full type safety
- Extensible workflow system with custom tools
- Headless mode for programmatic usage
- State management with hooks
- Built-in approval modes: `suggest`, `auto-edit`, `full-auto`

## 📦 Installation

```bash
npm install codex-sdk
```

## 🎯 Quick Start

### Simple API

The SDK provides a single `run` function that handles both single and multiple workflows:

```javascript
import { createAgentWorkflow, run } from "codex-sdk";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const workflow = createAgentWorkflow("My Assistant", ({ tools }) => {
  return {
    async run({ state, actions }) {
      // Handle user input with AI
      const result = await generateText({
        model: openai("gpt-4o"),
        system: "You are a helpful assistant.",
        messages: state.transcript,
        tools: tools.definitions,
      });

      await actions.say(result.text);
      await tools.execute(result.toolCalls);
    },
  };
});

// Single workflow
const manager = run(workflow, {
  title: "My Personal AI Assistant",
});

// Multiple workflows - pass Array<WorkflowFactory>
const multiManager = run([codeAssistant, researchAssistant], {
  title: "🚀 My Development Environment",
});
```

### Multi-Workflow Setup

```javascript
import { createAgentWorkflow, run } from "codex-sdk";

// Define your AI assistants
const codeAssistant = createAgentWorkflow("Code Assistant", ({ tools }) => ({
  async run({ state, actions }) {
    // AI logic for coding tasks
  },
}));

const researchAssistant = createAgentWorkflow(
  "Research Assistant",
  ({ tools }) => ({
    async run({ state, actions }) {
      // AI logic for research tasks
    },
  }),
);

// Run multiple workflows with seamless switching
const manager = run([codeAssistant, researchAssistant], {
  // Start with both workflows active
  initialWorkflows: [{ id: "code-assistant" }, { id: "research-assistant" }],
  approvalPolicy: "suggest",
  title: "🚀 My AI Development Environment",
  config: {
    safeCommands: ["git status", "npm test"],
    headers: [
      { label: "Environment", value: "Development" },
      { label: "Project", value: "My App" },
    ],
  },
});

// Listen to workflow events
manager.on("workflow:switch", (event) => {
  console.log(`Switched to: ${event.workflow.title}`);
});
```

## 🎮 Multi-Workflow Controls

### Default Keyboard Shortcuts

| Command  | Description                                              |
| -------- | -------------------------------------------------------- |
| `Ctrl+P` | Switch to next workflow                                  |
| `Ctrl+O` | Switch to previous workflow                              |
| `Ctrl+N` | Switch to next non-loading workflow                      |
| `Ctrl+K` | Open app command palette (switch/create/close workflows) |

Workflow tabs appear at the bottom showing all active assistants.

### Customizable Controls

You can now customize keyboard shortcuts and see them displayed permanently in overlays:

```javascript
import { run, createAgentWorkflow } from "codex-sdk";

const customHotkeyConfig = {
  previousWorkflow: { key: "h", ctrl: true }, // Ctrl+H instead of Ctrl+O
  nextWorkflow: { key: "l", ctrl: true }, // Ctrl+L instead of Ctrl+P
  nextNonLoading: { key: "j", ctrl: true }, // Ctrl+J instead of Ctrl+N
  appCommands: { key: "k", ctrl: true, shift: true }, // Ctrl+Shift+K instead of Ctrl+K
};

run([myWorkflow], {
  title: "Custom Controls Demo",
  hotkeyConfig: customHotkeyConfig,
});
```

**Features:**

- **Always visible controls**: Keyboard shortcuts are displayed at the bottom of selection overlays
- **Full customization**: Configure any combination of `ctrl`, `shift`, `meta`, and `key`
- **Type safety**: Full TypeScript support for hotkey configuration
- **Per-session**: Different hotkey configurations for different workflow sessions

### Interactive Overlays

- History Overlay (`/history`): Browse command history with `j/k` navigation
- Help Overlay (`/help`): View all available slash commands
- Approval Overlay (`/approval`): Switch between approval policies
- Selection Overlay: Multi-choice selections with arrow key navigation
- Prompt Overlay: Text input dialogs with validation
- Confirmation Overlay: Yes/No confirmation dialogs

## File System Integration

### File Autocompletion

The SDK provides intelligent file system autocompletion with `@filename` syntax:

```typescript
// In your message input, type:
@src/components/    // Press Tab to see completions
@package.json       // Auto-completes to exact file
@./README.md        // Relative path completion
```

**Features:**

- Prefix Matching: Type `@src/` and Tab to see all files in `src/`
- Directory Navigation: Navigate directories with Tab completion
- Relative Paths: Support for `./` and `../` path patterns
- Smart Filtering: Real-time filtering as you type
- Keyboard Navigation: Use arrow keys to select from completions

### Desktop Notifications

Get system notifications when AI assistants complete responses:

```javascript
run(workflows, {
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

## 🛠️ API Reference

### WorkflowManager

The `run` function returns an event-driven `WorkflowManager`:

```typescript
const manager = run(workflows);

// Access workflow instances
manager.getWorkflows().forEach((workflow) => {
  console.log(workflow.title, workflow.isActive);
});

// Listen to events
manager.on("workflow:create", (event) => {
  console.log(`Created: ${event.workflow.title}`);
});

manager.on("workflow:switch", (event) => {
  console.log(
    `Switched from ${event.previousWorkflow?.title} to ${event.workflow.title}`,
  );
});

// Clean shutdown
manager.terminate();
```

### WorkflowOptions

Configuration options for single vs. multi-workflow execution:

```typescript
interface SingleWorkflowOptions {
  prompt?: string;
  imagePaths?: Array<string>;
  headless?: boolean;
  title?: React.ReactNode;
  hotkeyConfig?: Partial<CustomizableHotkeyConfig>;
}

interface MultiWorkflowOptions {
  initialWorkflows?: Array<InitialWorkflowRef>;
  title?: React.ReactNode;
  hotkeyConfig?: Partial<CustomizableHotkeyConfig>;
}

interface CustomizableHotkeyConfig {
  previousWorkflow: Partial<{
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
  }>;
  nextWorkflow: Partial<{
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
  }>;
  appCommands: Partial<{
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
  }>;
}

type WorkflowOptions = SingleWorkflowOptions | MultiWorkflowOptions;
```

Headless mode is only supported for single workflows.

### Event Usage Examples

```typescript
const manager = run([codeAssistant, researchAssistant], {
  title: "🛠️ AI Development Workspace",
});

// Track workflow lifecycle
manager.on("workflow:create", (event) => {
  console.log(`Created new workflow: ${event.workflow.title}`);
  addTabToUI(event.workflow);
});

manager.on("workflow:close", (event) => {
  console.log(`Closed workflow: ${event.workflow.title}`);
  removeTabFromUI(event.workflow);
});

// Monitor active workflow changes
manager.on("workflow:switch", (event) => {
  updateActiveTab(event.workflow);
  loadWorkflowContext(event.workflow);
});

// Handle workflow state changes
manager.on("workflow:loading", (event) => {
  showSpinner(event.workflow);
});

manager.on("workflow:ready", (event) => {
  hideSpinner(event.workflow);
});
```

**Available Events:**

- `"workflow:create"` - New workflow instance created
- `"workflow:close"` - Workflow instance closed
- `"workflow:switch"` - Active workflow changed
- `"workflow:loading"` - Workflow is processing
- `"workflow:ready"` - Workflow finished processing

**Event Data:**

```typescript
interface WorkflowEvent {
  workflow: WorkflowInstance;
  previousWorkflow?: WorkflowInstance; // for switch events
}

interface WorkflowInstance {
  title: string;
  factory: WorkflowFactory;
  isActive: boolean;
  state: WorkflowState; // Access loading, messages, etc.
  displayConfig?: DisplayConfig;
}
```

## Programmatic Workflow Management

The `WorkflowManager` returned by `run()` provides complete programmatic control over workflows and manager properties, equivalent to all Ctrl+K menu functionality.

### Manager Properties

Access and update all manager-level settings programmatically:

```typescript
const manager = run([codeAssistant, researchAssistant], {
  title: "🛠️ AI Development Workspace",
  approvalPolicy: "suggest",
});

// Read current properties
console.log(manager.title); // "🛠️ AI Development Workspace"
console.log(manager.approvalPolicy); // "suggest"
console.log(manager.config); // LibraryConfig object
console.log(manager.hotkeyConfig); // CustomizableHotkeyConfig object

// Update properties (triggers immediate UI re-renders)
manager.setTitle("🚀 Updated Development Environment");
manager.setApprovalPolicy("auto-edit");
manager.setConfig({
  safeCommands: ["git status", "npm test", "ls -la"],
  tools: {
    shell: { maxBytes: 2048 * 1024 },
  },
});
manager.setHotkeyConfig({
  nextWorkflow: { key: "l", ctrl: true },
  previousWorkflow: { key: "h", ctrl: true },
});
```

### Workflow Lifecycle Management

Programmatically create, close, and switch between workflows:

```typescript
const manager = run([codeAssistant, researchAssistant], {
  title: "🛠️ AI Development Workspace",
});

// Create new workflow instances
const newAssistant = await manager.createWorkflow(codeAssistant, {
  activate: true, // Switch to this workflow immediately
});
const backgroundResearcher = await manager.createWorkflow(researchAssistant);

// Get all workflows and active workflow
const allWorkflows = manager.getWorkflows();
const activeWorkflow = manager.getActiveWorkflow();

// Switch between workflows
await manager.switchToWorkflow(backgroundResearcher);

// Close workflows
await manager.closeWorkflow(newAssistant);
```

### Workflow Navigation

Navigate between workflows programmatically:

```typescript
// Navigate workflows (equivalent to Ctrl+P, Ctrl+O, Ctrl+N)
manager.switchToNextWorkflow();
manager.switchToPreviousWorkflow();
manager.switchToNextNonLoadingWorkflow();
```

### Direct Workflow Control

Each workflow instance provides direct access to its state and control methods:

```typescript
const activeWorkflow = manager.getActiveWorkflow();
if (activeWorkflow) {
  // Direct state management
  await activeWorkflow.setState({
    statusLine: "Processing request...",
    loading: true,
  });

  const currentState = activeWorkflow.getState();
  console.log(currentState.messages.length);

  // Direct workflow control
  activeWorkflow.message({ role: "user", content: "Hello!" });
  activeWorkflow.stop();

  // Check workflow status
  console.log(activeWorkflow.isLoading);
  console.log(activeWorkflow.isActive);
}
```

### Workflow Iteration and Management

Loop over workflows and manage them programmatically:

```typescript
// Iterate over all workflows
manager.getWorkflows().forEach((workflow) => {
  console.log(`Workflow: ${workflow.title}`);
  console.log(`Active: ${workflow.isActive}`);
  console.log(`Loading: ${workflow.isLoading}`);

  if (workflow.isActive) {
    workflow.message({ role: "user", content: "Status update" });
  }
});

// Find specific workflows
const codeWorkflows = manager
  .getWorkflows()
  .filter((w) => w.title.includes("Code"));

// Bulk operations
const loadingWorkflows = manager.getWorkflows().filter((w) => w.isLoading);
loadingWorkflows.forEach((w) => w.stop());
```

### Event-Driven Management

Combine programmatic control with event handling:

```typescript
const manager = run([codeAssistant, researchAssistant], {
  title: "🛠️ AI Development Workspace",
});

// Automatically switch to new workflows
manager.on("workflow:create", async ({ workflow }) => {
  console.log(`New workflow created: ${workflow.title}`);
  await manager.switchToWorkflow(workflow);
});

// Auto-restart failed workflows
manager.on("workflow:error", async ({ workflow }) => {
  console.log(`Workflow ${workflow.title} encountered an error, restarting...`);
  await manager.closeWorkflow(workflow);
  await manager.createWorkflow(workflow.factory, { activate: true });
});

// Dynamic property updates based on workflow state
manager.on("workflow:switch", ({ workflow }) => {
  if (workflow.title.includes("Research")) {
    manager.setApprovalPolicy("suggest"); // More careful for research
  } else {
    manager.setApprovalPolicy("auto-edit"); // Faster for coding
  }
});
```

### Complete Example

Here's a comprehensive example showing all programmatic capabilities:

```typescript
import { run, createAgentWorkflow } from "codex-sdk";

const codeAssistant = createAgentWorkflow("Code Assistant", /* ... */);
const researchAssistant = createAgentWorkflow("Research Assistant", /* ... */);

const manager = run([codeAssistant, researchAssistant], {
  title: "🛠️ Development Workspace",
  approvalPolicy: "suggest",
});

// Set up event handlers
manager.on("workflow:create", ({ workflow }) => {
  console.log(`✅ Created: ${workflow.title}`);
});

manager.on("workflow:switch", ({ workflow, previousWorkflow }) => {
  console.log(`🔄 Switched from ${previousWorkflow?.title} to ${workflow.title}`);
});

// Programmatic workflow management
async function setupWorkspace() {
  // Update manager properties
  manager.setTitle("🚀 Active Development Session");
  manager.setHotkeyConfig({
    nextWorkflow: { key: "j", ctrl: true },
    previousWorkflow: { key: "k", ctrl: true }
  });

  // Create additional workflows
  const debugger = await manager.createWorkflow(codeAssistant);
  const analyzer = await manager.createWorkflow(researchAssistant, { activate: true });

  // Set up workflow states
  await debugger.setState({
    statusLine: "Ready for debugging",
    queue: ["Check logs", "Analyze stack trace"]
  });

  await analyzer.setState({
    statusLine: "Analyzing codebase...",
    loading: true
  });

  // Send messages to specific workflows
  debugger.message({ role: "user", content: "Debug the login issue" });
  analyzer.message({ role: "user", content: "Analyze performance bottlenecks" });

  console.log(`Total workflows: ${manager.getWorkflows().length}`);
}

setupWorkspace();
```

This programmatic API provides complete control over the workflow environment, allowing you to build sophisticated multi-agent systems, automated workflow orchestration, and dynamic user interfaces.

## 🛠️ Workflow API

### Workflow Creation

```javascript
import { createAgentWorkflow } from "codex-sdk";

const workflow = createAgentWorkflow("My Assistant", (context) => {
  const { tools, actions } = context;

  return {
    async run({ state, actions }) {
      // Your workflow logic here
      await actions.say("Hello! How can I help?");
    },
  };
});
```

### Additional Features

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
  async run({ state, actions, tools }) {
    // Workflow implementation
  },
}));
```

#### Message Metadata

Attach custom metadata to any message for enhanced context tracking, analytics, or custom display formatting:

```typescript
const workflow = createAgentWorkflow("Smart Assistant", ({ actions }) => ({
  async run({ state, actions }) {
    // Add metadata to UI messages
    actions.say("Processing your request...", {
      priority: "high",
      source: "user_request",
      timestamp: new Date().toISOString(),
      userId: "user_123",
    });

    // Add metadata to user messages
    const enrichedMessage = {
      ...userInput,
      metadata: {
        confidence: 0.95,
        intent: "code_review",
        sessionId: "session_456",
      },
    };
    actions.addMessage(enrichedMessage);
  },
}));
```

**Why use metadata?**

- **Analytics**: Track message types, user interactions, and workflow performance
- **Context**: Store additional information like timestamps, user IDs, or confidence scores
- **Custom Display**: Build custom UI components that respond to metadata properties
- **Debugging**: Add debugging information that doesn't appear in AI conversations
- **Integration**: Store data needed for external systems or APIs

## 📚 Examples

The SDK includes examples:

- Simple Agent: Basic AI assistant
- Research Assistant: Specialized research workflows with sources
- Coding Agent: Code analysis and editing workflows
- Text Adventure Game: Interactive storytelling with choices
- Deploy Dashboard: DevOps workflows with progress tracking
- Queue Demo: Task queue management
- Codebase Quiz: Interactive code learning
- Multi-Workflow Demo: Complete multi-assistant setup
- Customizable Controls Demo: Shows customizable keyboard shortcuts and always-visible controls

**Run any example:**

```bash
node examples/multi-workflow-demo.js
```

## Configuration

### Workflow Configuration

Configure tools and security for any workflow setup:

```javascript
// Single workflow configuration
run(workflow, {
  approvalPolicy: "suggest",
  config: {
    // Tool configuration
    tools: {
      shell: {
        maxBytes: 1024 * 1024, // 1MB output limit
        maxLines: 1000,
      },
    },
    // User-defined safe commands (auto-approved)
    safeCommands: ["git status", "npm test", "ls -la"],

    // Custom headers in terminal
    headers: [
      { label: "Project", value: "MyApp" },
      { label: "Env", value: "Development" },
    ],

    // Custom status line
    statusLine: "Ready for deployment",

    // Command history settings
    history: {
      maxSize: 100,
      saveHistory: true,
      sensitivePatterns: ["password", "token", "key"],
    },
  },
});

// Multi-workflow configuration
run([workflow1, workflow2], {
  approvalPolicy: "auto-edit", // Default policy for all workflows
  initialWorkflows: [{ id: "primary" }], // Start with specific workflows
  title: "Development Environment",

  // Customize keyboard shortcuts
  hotkeyConfig: {
    previousWorkflow: { key: "h", ctrl: true }, // Ctrl+H
    nextWorkflow: { key: "l", ctrl: true }, // Ctrl+L
    appCommands: { key: "k", ctrl: true, shift: true }, // Ctrl+Shift+K
  },
});
```

### Approval Policies

Control command execution safety:

- **`suggest`** (default): Ask for approval before executing commands
- **`auto-edit`**: Auto-approve file edits, ask for other commands
- **`full-auto`**: Auto-approve all commands (use with caution)

```javascript
run(workflows, {
  approvalPolicy: "suggest", // Safe default
  additionalWritableRoots: ["/safe/directory"], // Limit file access
});
```

### Safe Commands

Pre-approved commands that bypass approval prompts:

```javascript
run(workflow, {
  config: {
    safeCommands: ["git status", "npm test", "ls -la", "pwd", "docker ps"],
  },
});
```

**How Safe Commands Work:**

- Commands are matched exactly or by command name only
- Built-in safe commands: `cd`, `ls`, `pwd`, `cat`, `grep`, `git status`, `find`, `wc`, `head`, `tail`
- Supports both exact command matching and command name matching
- Built-in safe commands: `cd`, `ls`, `pwd`, `cat`, `grep`, `git status`, etc.
- User-defined safe commands are checked alongside built-in ones
- Useful for frequently used read-only or safe operations

### Headless Mode

Headless mode runs workflows without a terminal UI for programmatic usage. **Only available for single workflows.**

```javascript
import { run } from "codex-sdk";

// ✅ Single workflow headless - works
const manager = run(myWorkflow, {
  headless: true, // No terminal UI
  approvalPolicy: "auto-edit",
  onController: (controller) => {
    // Programmatic access to workflow
    controller.message("Hello AI!");
  },
});

// ❌ Multi-workflow headless - throws error
try {
  run([workflow1, workflow2], {
    headless: true, // Error: not supported for multi-workflows
  });
} catch (error) {
  console.log(error.message);
  // "Headless mode is not supported for multi-workflow execution..."
}
```

### Tool Integration

```typescript
const workflow = createAgentWorkflow("With Tools", ({ tools }) => {
  // Access built-in tools
  const { shell, apply_patch, user_select } = tools.definitions;

  return {
    async run({ state, actions, tools }) {
      // Execute shell commands
      const result = await shell.execute({ command: "ls -la" });

      // Apply code patches
      await apply_patch.execute({
        patch: "...",
        path: "src/app.ts",
      });

      // Get user selection
      const choice = await user_select.execute({
        message: "Choose option:",
        options: ["A", "B", "C"],
      });

      return {
        /* workflow implementation */
      };
    },
  };
});
```

## 📚 Type Definitions

Full TypeScript support with type definitions:

```typescript
export interface WorkflowFactory {
  /* ... */
}
export interface WorkflowState {
  /* ... */
}
export interface WorkflowManager {
  /* ... */
}
export interface SingleWorkflowOptions {
  /* ... */
}
export interface MultiWorkflowOptions {
  /* ... */
}
export interface CustomizableHotkeyConfig {
  /* ... */
}
```

## 📄 License

Apache-2.0

## 🤝 Contributing

We welcome contributions! The multi-workflow system is designed to be extensible - add your own workflow types, UI components, and tools.

---
