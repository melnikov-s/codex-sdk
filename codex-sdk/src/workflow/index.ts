import type { UIMessage } from "../utils/ai";
import type { ModelMessage, ToolSet } from "ai";
import type { ReactNode } from "react";

export interface SelectItem {
  label: string;
  value: string;
}

export interface SelectOptions {
  required?: boolean;
  default?: string;
  label?: string;
  timeout?: number;
  defaultValue?: string;
}

export interface SelectOptionsWithTimeout {
  required?: boolean;
  default?: string;
  label?: string;
  timeout: number;
  defaultValue: string;
}

export interface ConfirmOptions {
  timeout?: number;
  defaultValue?: boolean;
}

export interface ConfirmOptionsWithTimeout {
  timeout: number;
  defaultValue: boolean;
}

export interface PromptOptions {
  timeout?: number;
  defaultValue?: string;
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
    }
  >;
}

export interface WorkflowHooks {
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
  };

  /**
   * Convenience methods - shortcuts for common setState operations
   */
  actions: {
    /**
     * Add message(s) to the current messages array
     * @param message Single message, string (creates UI message), or array of messages/strings to add
     */
    addMessage: (message: UIMessage | string | Array<UIMessage | string>) => void;

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
     * Convenience helper: apply a model result by adding its messages and executing tool calls.
     * Equivalent to:
     *   const { messages } = result.response;
     *   addMessage(messages);
     *   const toolResponses = await tools.execute(messages);
     *   addMessage(toolResponses);
     * Returns the array of tool responses (possibly empty).
     */
    handleModelResult: (
      result: { response: { messages: Array<UIMessage> }; finishReason?: string },
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
    select(items: Array<SelectItem>, options?: SelectOptions): Promise<string>;

    /**
     * Send a confirmation prompt to the user
     * @param msg The confirmation message
     * @param options Optional timeout and default configuration
     * @returns Whether the user confirmed or not
     */
    confirm(msg: string): Promise<boolean>;
    confirm(msg: string, options: ConfirmOptionsWithTimeout): Promise<boolean>;
    confirm(msg: string, options?: ConfirmOptions): Promise<boolean>;

    /**
     * Send a prompt to the user and get their response
     * @param msg The prompt message
     * @param options Optional timeout and default configuration
     * @returns The user's response as a string
     */
    input(msg: string): Promise<string>;
    input(msg: string, options: PromptOptionsWithTimeout): Promise<string>;
    input(msg: string, options?: PromptOptions): Promise<string>;
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
