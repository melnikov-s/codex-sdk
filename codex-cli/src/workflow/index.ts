import type { CoreMessage } from "ai";

export interface SelectItem {
  label: string;
  value: string;
}

export interface SelectOptions {
  required?: boolean;
  default?: string;
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
  run(input: Array<CoreMessage>): Promise<Array<CoreMessage>>;

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
   * Custom header for the workflow
   * If not provided, defaults to "Codex (Default workflow)"
   */
  header?: string;

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
  /** Tool definitions that can be used by the workflow */
  tools: Record<string, unknown>;

  /** Initial prompt/instructions for the workflow */
  toolPrompt: string;

  /**
   * Send a confirmation prompt to the user
   * @param msg The confirmation message
   * @returns Whether the user confirmed or not
   */
  confirm: (msg: string) => Promise<boolean>;

  /**
   * Set the loading state
   * @param isLoading Whether the workflow is loading
   */
  setLoading: (isLoading: boolean) => void;

  /**
   * Handle new messages from the workflow (e.g. user, assistant, tool)
   * @param message The new message
   */
  onMessage: (message: CoreMessage) => void;

  /**
   * Handle system messages (e.g. logs, status, non-CoreMessage errors)
   * @param message The system message string
   */
  onSystemMessage: (message: string) => void;

  /**
   * Handler for tool calls
   * @param message The message containing a tool call
   * @returns The tool response message if a tool was called, null otherwise
   */
  handleToolCall: (message: CoreMessage) => Promise<CoreMessage | null>;

  /**
   * Optional error handler
   * @param error The error that occurred
   */
  onError?: (error: unknown) => void;

  /**
   * Logging function for debug messages
   * @param message The log message
   */
  logger: (message: string) => void;

  /**
   * Notify that a command was executed
   * @param command The command that was executed
   * @param result Optional result message
   */
  onCommandExecuted?: (command: string, result?: string) => void;

  /**
   * Show a selection dialog to the user
   * @param items Array of items to select from
   * @param options Selection options (required, default)
   * @returns Promise that resolves with the selected value
   */
  onSelect: (
    items: Array<SelectItem>,
    options?: SelectOptions,
  ) => Promise<string>;

  /**
   * Enable or disable the input box
   * @param disabled Whether the input should be disabled
   */
  setInputDisabled: (disabled: boolean) => void;
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
