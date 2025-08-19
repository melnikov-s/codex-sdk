import type { ApprovalPolicy, SafetyAssessment } from "../approvals.js";
import type { UIMessage } from "../utils/ai";
import type { ModelMessage, ToolSet } from "ai";
import type { ReactNode } from "react";

export interface SelectItem {
  label: string;
  value: string;
}

export interface SelectOptions {
  required?: boolean;
  label?: string;
  timeout?: number;
  defaultValue: string;
}

export interface SelectOptionsWithTimeout {
  required?: boolean;
  label?: string;
  timeout: number;
  defaultValue: string;
}

export interface ConfirmOptions {
  timeout?: number;
  defaultValue: boolean;
}

export interface ConfirmOptionsWithTimeout {
  timeout: number;
  defaultValue: boolean;
}

export interface PromptOptions {
  timeout?: number;
  defaultValue: string;
}

export interface PromptOptionsWithTimeout {
  timeout: number;
  defaultValue: string;
}

export interface TaskItem {
  completed: boolean;
  label: string;
}

export interface WorkflowState {
  loading: boolean;
  messages: Array<UIMessage>;
  inputDisabled: boolean;
  queue?: Array<string>;
  taskList?: Array<TaskItem>;
  transcript?: Array<UIMessage>;
  statusLine?: ReactNode;
  /**
   * Named UI slots rendered around core layout regions.
   * Values are arbitrary React nodes; set to null/undefined to clear.
   */
  slots?: Partial<Record<SlotRegion, ReactNode | null>>;
  /**
   * Current approval policy for tool execution
   */
  approvalPolicy?: ApprovalPolicy;
}

export interface DisplayConfig {
  /** Custom header for the workflow */
  header?: ReactNode;

  /** Function to format the role header for each message */
  formatRoleHeader?: (message: UIMessage) => ReactNode;

  /** Function to format the message content */
  formatMessage?: (message: UIMessage) => ReactNode;
}

export interface Workflow {
  /**
   * Initialize the workflow
   * Called when the workflow is first created
   */
  initialize?(): void;

  /**
   * Run the workflow with the given input messages
   * @param input The input messages to process
   * @returns Promise that resolves with any messages produced after the call
   */
  message(input: ModelMessage): void;

  /**
   * Stop the current workflow processing
   * Non-destructive - allows resuming with future run calls
   */
  stop(): void;

  /**
   * Terminate the workflow
   * Destroys the workflow instance - cannot be used after this call
   */
  terminate(): void;

  /**
   * Display customization configuration
   * Controls how messages and UI elements are styled
   */
  displayConfig?: DisplayConfig;

  /**
   * Commands that this workflow provides
   * These will be available as slash commands in the UI (e.g., /compact)
   */
  commands?: Record<
    string,
    {
      description: string;
      handler: (args?: string) => Promise<void> | void;
      disabled?: () => boolean;
    }
  >;
}

export interface WorkflowController {
  headless?: boolean;
  message(input: string | ModelMessage): void;
  stop(): void;
  terminate(code?: number): void;
  getState(): WorkflowState;
}

export interface WorkflowHooks {
  /** Indicates headless mode when true; omitted/false in UI */
  headless?: boolean;
  /**
   * Set the workflow state declaratively
   * State changes are applied synchronously and immediately visible via getState()
   * @param state Partial state object or updater function
   * @returns Promise that resolves when UI has been updated (for compatibility)
   */
  setState: (
    state: Partial<WorkflowState> | ((prev: WorkflowState) => WorkflowState),
  ) => Promise<void>;

  /**
   * Current workflow state with getter properties
   * Access via state.loading, state.messages, etc.
   */
  state: {
    readonly loading: boolean;
    readonly messages: Array<UIMessage>;
    readonly inputDisabled: boolean;
    readonly queue: Array<string>;
    readonly taskList: Array<TaskItem>;
    readonly transcript: Array<UIMessage>;
    readonly statusLine?: ReactNode;
    readonly slots?: Partial<Record<SlotRegion, ReactNode | null>>;
    readonly approvalPolicy?: ApprovalPolicy;
  };

  /**
   * Convenience methods - shortcuts for common setState operations
   */
  actions: {
    /**
     * Add UI-only message(s) to the current messages array
     * UI messages are excluded from transcript and used for status/info display
     * @param text Single string or array of strings to display as UI messages
     */
    say: (text: string | Array<string>) => void;

    /**
     * Add structured message(s) to the current messages array
     * @param message Single UIMessage or array of UIMessages to add
     */
    addMessage: (message: UIMessage | Array<UIMessage>) => void;

    /**
     * Set loading state
     * @param loading Whether the agent is currently processing
     */
    setLoading: (loading: boolean) => void;

    /**
     * Set input disabled state
     * @param disabled Whether user input is disabled
     */
    setInputDisabled: (disabled: boolean) => void;

    /**
     * Set status line content
     * @param content Status line content to display
     */
    setStatusLine: (content: ReactNode) => void;

    /**
     * Set content for a specific slot region
     * @param region The slot region to set content for
     * @param content The content to set (null to clear)
     */
    setSlot: (region: SlotRegion, content: ReactNode | null) => void;

    /**
     * Clear content from a specific slot region
     * @param region The slot region to clear
     */
    clearSlot: (region: SlotRegion) => void;

    /**
     * Clear all slot content
     */
    clearAllSlots: () => void;

    /**
     * Add item(s) to the end of the queue
     * @param item Single string or array of strings to add to queue
     */
    addToQueue: (item: string | Array<string>) => void;

    /**
     * Remove and return the first item from the queue
     * @returns The first queue item, or undefined if queue is empty
     */
    removeFromQueue: () => string | undefined;

    /**
     * Clear the entire queue
     */
    clearQueue: () => void;

    /**
     * Add task(s) to the task list
     * @param task Single task, string, array of tasks, or array of strings to add to task list
     */
    addTask: (task: string | TaskItem | Array<string | TaskItem>) => void;

    /**
     * Toggle the completion status of a task by index, or the next incomplete task if no index provided
     * @param index The index of the task to toggle (optional - defaults to next incomplete task)
     */
    toggleTask: (index?: number) => void;

    /**
     * Clear the entire task list
     */
    clearTaskList: () => void;

    /**
     * Set the approval policy for tool execution
     * @param policy The approval policy to set
     */
    setApprovalPolicy?: (policy: ApprovalPolicy) => void;

    /**
     * Programmatically set the current input box value in the UI.
     * This is intentionally an action (not part of WorkflowState) so the
     * input remains uncontrolled by state diffs and can be updated
     * imperatively by workflows (e.g., for edit flows).
     * @param value The text to populate into the input editor
     */
    setInputValue: (value: string) => void;

    /**
     * Remove the last message that matches the given role and everything after it.
     * Returns the removed tail (first element is the removed message itself).
     */
    truncateFromLastMessage: (role: UIMessage["role"]) => Array<UIMessage>;

    /**
     * Convenience helper: apply a model result by adding its messages and executing tool calls.
     * Equivalent to:
     *   const { messages } = result.response;
     *   addMessage(messages);
     *   const toolResponses = await tools.execute(messages);
     *   addMessage(toolResponses);
     * Returns the array of tool responses (possibly empty).
     */
    handleModelResult: (
      result: {
        response: { messages: Array<UIMessage> };
        finishReason?: string;
      },
      opts?: { abortSignal?: AbortSignal },
    ) => Promise<Array<UIMessage>>;
  };

  /**
   * Tool execution and definitions
   */
  tools: {
    /**
     * Tool definitions that can be used by the workflow
     */
    definitions: ToolSet;

    /**
     * Execute tool calls directly
     * @param toolCalls Tool calls to execute
     * @param opts Optional abort signal
     * @returns Promise that resolves with tool response messages
     */
    execute: {
      (
        message: ModelMessage,
        opts?: { abortSignal?: AbortSignal },
      ): Promise<ModelMessage | null>;
      (
        messages: Array<ModelMessage>,
        opts?: { abortSignal?: AbortSignal },
      ): Promise<Array<ModelMessage>>;
    };
  };

  /**
   * Programmatic control of the workflow from within your agent logic
   * Use these to inject messages or stop/terminate without relying on `this`
   */
  control: {
    /** Normalize string to user message and dispatch into workflow */
    message: (input: string | ModelMessage) => void;
    /** Stop current processing */
    stop: () => void;
    /** Terminate the workflow instance */
    terminate: () => void;
  };

  /**
   * User interaction prompts
   */
  prompts: {
    /**
     * Show a selection dialog to the user
     * @param items Array of items to select from
     * @param options Selection options (required, default, timeout)
     * @returns Promise that resolves with the selected value
     */
    select(
      items: Array<SelectItem>,
      options: SelectOptionsWithTimeout,
    ): Promise<string>;
    select(items: Array<SelectItem>, options: SelectOptions): Promise<string>;

    /**
     * Send a confirmation prompt to the user
     * @param msg The confirmation message
     * @param options Optional timeout and default configuration
     * @returns Whether the user confirmed or not
     */
    confirm(msg: string, options: ConfirmOptionsWithTimeout): Promise<boolean>;
    confirm(msg: string, options: ConfirmOptions): Promise<boolean>;

    /**
     * Send a prompt to the user and get their response
     * @param msg The prompt message
     * @param options Optional timeout and default configuration
     * @returns The user's response as a string
     */
    input(msg: string, options: PromptOptionsWithTimeout): Promise<string>;
    input(msg: string, options: PromptOptions): Promise<string>;
  };

  /**
   * Approval policy management and control
   */
  approval?: {
    /**
     * Get the current approval policy
     * @returns The current approval policy
     */
    getPolicy(): ApprovalPolicy;

    /**
     * Set the approval policy dynamically
     * @param policy The new approval policy to set
     */
    setPolicy(policy: ApprovalPolicy): void;

    /**
     * Check if a command would be auto-approved under current policy
     * @param command The command to check as an array of strings
     * @param workdir Optional working directory for the command
     * @param writableRoots Optional array of writable root paths
     * @returns Promise that resolves with the safety assessment
     */
    canAutoApprove(
      command: ReadonlyArray<string>,
      workdir?: string,
      writableRoots?: ReadonlyArray<string>,
    ): Promise<SafetyAssessment>;
  };
}

export type WorkflowFactory = (hooks: WorkflowHooks) => Workflow;

/**
 * Create a workflow using the provided factory function
 * @param factory A factory function that creates a workflow
 * @returns A workflow factory that can be used to create workflow instances
 */
export function createAgentWorkflow(
  factory: (hooks: WorkflowHooks) => Workflow,
): WorkflowFactory {
  return (hooks: WorkflowHooks) => {
    return factory(hooks);
  };
}

/**
 * Workflow factory with a required static title.
 * The runtime Workflow object no longer carries a title; titles are static on factories.
 */
export type WorkflowFactoryWithTitle = WorkflowFactory & { title: string };

/**
 * Create a workflow factory with a static title.
 * Overloads:
 *  - createWorkflow(title, factory)
 *  - createWorkflow(factoryWithTitle)
 */
export function createWorkflow(
  arg1: string | WorkflowFactoryWithTitle,
  arg2?: WorkflowFactory,
): WorkflowFactoryWithTitle {
  if (typeof arg1 === "function") {
    // Already has static title
    const f = arg1 as Partial<WorkflowFactoryWithTitle>;
    if (!f || typeof f.title !== "string" || f.title.trim().length === 0) {
      throw new Error("createWorkflow(factory): factory is missing static 'title' property");
    }
    return f as WorkflowFactoryWithTitle;
  }
  const title = arg1 as string;
  const factory = arg2 as WorkflowFactory;
  const wrapped: WorkflowFactory = (hooks: WorkflowHooks) => factory(hooks);
  (wrapped as WorkflowFactoryWithTitle).title = title;
  return wrapped as WorkflowFactoryWithTitle;
}

/**
 * Vertical regions where slot content can be injected.
 * Ordering (top to bottom):
 *  aboveHeader → header → belowHeader → aboveHistory → history → belowHistory → aboveTaskList → taskList → belowTaskList → aboveQueue → queue → belowQueue → aboveInput → input → belowInput
 */
export type SlotRegion =
  | "aboveHeader"
  | "belowHeader"
  | "aboveHistory"
  | "belowHistory"
  | "aboveTaskList"
  | "belowTaskList"
  | "aboveQueue"
  | "belowQueue"
  | "aboveInput"
  | "belowInput";

/**
 * Manager-level slot regions that persist across workflow switches.
 * Ordering (top to bottom):
 *  aboveTabs → tabs → aboveWorkflow → workflow content → belowWorkflow
 */
export type ManagerSlotRegion =
  | "aboveTabs"      // Above the tab bar
  | "aboveWorkflow"  // Between tabs and workflow content  
  | "belowWorkflow"; // Below the entire workflow area

export interface ManagerSlotState {
  aboveTabs?: ReactNode | ((state: WorkflowState) => ReactNode) | null;
  aboveWorkflow?: ReactNode | ((state: WorkflowState) => ReactNode) | null;
  belowWorkflow?: ReactNode | ((state: WorkflowState) => ReactNode) | null;
}

// ====================================================================
// Multi-Workflow System Types
// ====================================================================

export interface AttentionState {
  requiresInput: boolean;
  hasNotification: boolean;
  priority: 'low' | 'medium' | 'high';
  lastActivity: Date;
  reason?: string;
}

// Internal type (not exported) retained for reference only
// interface WorkflowTab { /* removed */ }

export interface WorkflowEvent {
  type: 'created' | 'destroyed' | 'activated' | 'attention' | 'completed' | 'error';
  workflowId: string;
  data?: unknown;
  timestamp: Date;
}

export interface WorkflowMetadata {
  title: string;
  description?: string;
  category?: string;
  version?: string;
  author?: string;
  tags?: Array<string>;
}

export interface MultiWorkflowController extends WorkflowController {
  // Manager slots - exact same pattern as workflow actions.setSlot()
  slots: {
    set: (region: ManagerSlotRegion, content: ReactNode | ((state: WorkflowState) => ReactNode) | null) => void;
    clear: (region: ManagerSlotRegion) => void;
    clearAll: () => void;
  };

  // Instance management
  createInstance(factory: WorkflowFactoryWithTitle, options?: { activate?: boolean; title?: string }): string;
  removeInstance(id: string, options?: {
    graceful?: boolean;
    force?: boolean;
  }): void;
  
  switchToInstance(id: string): void;
  closeInstance(id: string): void;
  killInstance(id: string): void;
  
  // Workflow queries
  listInstances(): Array<{
    id: string;
    title: string;
    status: 'loading' | 'idle' | 'waiting' | 'error';
    attention: AttentionState;
    isActive: boolean;
    createdAt: Date;
  }>;
  
  getActiveInstance(): string | null;
  findInstance(predicate: (workflow: WorkflowInfo) => boolean): string | null;
  
  // Registry of available workflow types
  listAvailableWorkflows(): Array<{ title: string; factory: WorkflowFactoryWithTitle }>;
  openLauncher(): void;
  
  // Workflow communication
  sendToWorkflow(id: string, message: ModelMessage): void;
  broadcastToAll(message: ModelMessage, excludeActive?: boolean): void;
  
  // Attention management
  getWorkflowsRequiringAttention(): Array<string>;
  switchToNextAttention(): boolean;
  switchToNextNonLoading(): boolean;
  switchToPreviousNonLoading(): boolean;
  updateWorkflowAttention(workflowId: string, updates: Partial<AttentionState>): void;
  updateWorkflowStatus(workflowId: string, status: 'loading' | 'idle' | 'waiting' | 'error'): void;
  markAttentionHandled(id: string): void;
  
  // Event handling
  onWorkflowEvent(
    eventType: WorkflowEvent['type'], 
    handler: (workflowId: string, data?: unknown) => void
  ): () => void;
  
  offWorkflowEvent(eventType: WorkflowEvent['type'], handler: (workflowId: string, data?: unknown) => void): void;
  
  // Registry integration (optional, separate from basic launcher catalog)
  addWorkflowFromRegistry?(registryId: string, options?: {
    title?: string;
    activate?: boolean;
  }): string;
  
  listRegistryWorkflows?(): Array<{
    registryId: string;
    metadata: WorkflowMetadata;
    isLoaded: boolean;
  }>;
  
  // Dynamic loading
  addWorkflowFromFile?(filePath: string, options?: {
    title?: string;
    activate?: boolean;
  }): Promise<string>;
  
  addWorkflowFromUrl?(url: string, options?: {
    title?: string;
    activate?: boolean;
  }): Promise<string>;
}

export interface WorkflowInfo {
  id: string;
  title: string;
  status: 'loading' | 'idle' | 'waiting' | 'error';
  attention: AttentionState;
  isActive: boolean;
  createdAt: Date;
}

// Deprecated in new API – instances are created from factories with static titles
export interface WorkflowInitializer {}
