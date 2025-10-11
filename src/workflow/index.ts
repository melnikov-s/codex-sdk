import type { ApprovalPolicy, SafetyAssessment } from "../approvals.js";
import type { UIMessage, MessageMetadata } from "../utils/ai";
import type { ModelMessage, ToolSet } from "ai";
import type { ReactNode } from "react";

export interface SelectItem {
  label: string;
  value: string;
  isLoading?: boolean;
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
  /** Map of agent id to human-friendly name used for display */
  agentNames?: Record<string, string>;
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

  /** Configuration for workflow tabs display */
  tabs?: {
    /** Custom header text for the tabs section. If null, no header is shown. Defaults to "Active Workflows". */
    header?: string | null;

    /** Styling for the tab container */
    containerProps?: {
      flexDirection?: "row" | "column";
      marginBottom?: number;
      marginTop?: number;
      paddingX?: number;
      paddingY?: number;
    };

    /** Styling for individual active tabs */
    activeTab?: {
      color?: string;
      backgroundColor?: string;
      bold?: boolean;
      dimColor?: boolean;
    };

    /** Styling for inactive tabs */
    inactiveTab?: {
      color?: string;
      backgroundColor?: string;
      bold?: boolean;
      dimColor?: boolean;
    };

    /** Styling for the header text */
    headerStyle?: {
      color?: string;
      bold?: boolean;
      marginBottom?: number;
    };

    /** Styling for the instruction text */
    instructionStyle?: {
      color?: string;
      dimColor?: boolean;
      marginTop?: number;
    };
  };

  /**
   * Optional resolver to map an agent id to a display name for UI rendering.
   * When not provided, the UI will default to showing the raw agent id.
   */
  agentNameResolver?: (agentId: string) => string;
}

export interface Workflow {
  /**
   * Human-friendly title for this workflow (displayed in headers and UI)
   */
  title?: string;
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
  setState?(
    state: Partial<WorkflowState> | ((prev: WorkflowState) => WorkflowState),
  ): Promise<void>;
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
    readonly transcript: Array<ModelMessage>;
    readonly statusLine?: ReactNode;
    readonly slots?: Partial<Record<SlotRegion, ReactNode | null>>;
    readonly approvalPolicy?: ApprovalPolicy;
  };

  /**
   * Convenience methods - shortcuts for common setState operations
   */
  actions: {
    /**
     * Add UI-only message to the current messages array
     * UI messages are excluded from transcript and used for status/info display
     * @param text String to display as UI message
     * @param metadata Optional metadata to attach to the message
     */
    say: (text: string, metadata?: MessageMetadata) => void;

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

    /**
     * Create or retrieve a lightweight per-agent handle for message scoping.
     * The handle only affects message attribution (say/addMessage/transcript/handleModelResults).
     * All control state (loading, inputDisabled, statusLine, queue, taskList) remains global.
     */
    createAgent: (name: string) => {
      id: string;
      name: string;
      say: (text: string, metadata?: MessageMetadata) => void;
      addMessage: (message: UIMessage | Array<UIMessage>) => void;
      transcript: () => Array<ModelMessage>;
      handleModelResults: (
        result: {
          response: { messages: Array<ModelMessage> };
          finishReason?: string;
        },
        opts?: { abortSignal?: AbortSignal },
      ) => Promise<Array<UIMessage>>;
      setName: (newName: string) => void;
    };

    /**
     * Retrieve an existing agent handle by id if created previously.
     */
    getAgent?: (id: string) =>
      | {
          id: string;
          name: string;
          say: (text: string, metadata?: MessageMetadata) => void;
          addMessage: (message: UIMessage | Array<UIMessage>) => void;
          transcript: () => Array<ModelMessage>;
          handleModelResults: (
            result: {
              response: { messages: Array<ModelMessage> };
              finishReason?: string;
            },
            opts?: { abortSignal?: AbortSignal },
          ) => Promise<Array<UIMessage>>;
          setName: (newName: string) => void;
        }
      | undefined;
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

export type WorkflowMeta = {
  id?: string;
  title: string;
  icon?: string;
  description?: string;
};

export type WorkflowFactory = ((hooks: WorkflowHooks) => Workflow) & {
  meta?: WorkflowMeta;
};
export type WorkflowFactoryWithTitle = WorkflowFactory;

export function createAgentWorkflow(
  factory: (hooks: WorkflowHooks) => Workflow,
): WorkflowFactory;
export function createAgentWorkflow(
  meta: string | WorkflowMeta,
  factory: (hooks: WorkflowHooks) => Workflow,
): WorkflowFactory;
export function createAgentWorkflow(
  a: unknown,
  b?: (hooks: WorkflowHooks) => Workflow,
): WorkflowFactory {
  const hasMeta =
    typeof a === "string" ||
    (typeof a === "object" && a != null && !Array.isArray(a));
  const meta = hasMeta
    ? typeof a === "string"
      ? { title: a }
      : (a as WorkflowMeta)
    : undefined;
  const factory = (hasMeta ? b : a) as (hooks: WorkflowHooks) => Workflow;
  const wrapped: WorkflowFactory = (hooks) => factory(hooks);
  if (meta) {
    wrapped.meta = meta;
  }
  return wrapped;
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
