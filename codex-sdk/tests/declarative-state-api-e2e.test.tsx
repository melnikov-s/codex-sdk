import { describe, it, expect, vi, afterEach } from "vitest";
import {
  type WorkflowFactory,
  type WorkflowHooks,
  type WorkflowState,
} from "../src/lib.js";
import { type UIMessage } from "../src/utils/ai.js";

describe("Declarative State API - E2E Workflow Hook Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const createTestWorkflow = (
    testFn: (hooks: WorkflowHooks) => any,
  ): WorkflowFactory => {
    return (hooks: WorkflowHooks) => {
      // Store hooks for test access
      (globalThis as any).__testHooks = hooks;
      testFn(hooks);

      return {
        header: "Test Workflow",
        initialize: vi.fn().mockImplementation(() => {
          hooks.setState({
            messages: [
              {
                id: "init",
                role: "ui",
                content: "Workflow initialized",
              } as UIMessage,
            ],
          });
        }),
        message: vi.fn(),
        stop: vi.fn(),
        terminate: vi.fn(),
      };
    };
  };

  it("should update state when setState is called", () => {
    let capturedHooks: WorkflowHooks | null = null;

    const workflowFactory = createTestWorkflow((hooks) => {
      capturedHooks = hooks;
    });

    // Create workflow
    const workflow = workflowFactory({
      tools: {},
      logger: vi.fn(),
      setState: vi.fn(),
      getState: vi.fn().mockReturnValue({
        loading: false,
        messages: [],
        inputDisabled: false,
      }),
      appendMessage: vi.fn(),
      onConfirm: vi.fn(),
      onPromptUser: vi.fn(),
      onSelect: vi.fn(),
      handleToolCall: vi.fn(),
    });

    // Initialize workflow
    workflow.initialize?.();

    // Verify setState was called
    expect(capturedHooks).toBeTruthy();
    expect(capturedHooks!.setState).toHaveBeenCalledWith({
      messages: [
        {
          id: "init",
          role: "ui",
          content: "Workflow initialized",
        },
      ],
    });
  });

  it("should handle confirmation requests through onConfirm", async () => {
    let capturedHooks: WorkflowHooks | null = null;

    const workflowFactory = createTestWorkflow((hooks) => {
      capturedHooks = hooks;
    });

    const mockOnConfirm = vi.fn().mockResolvedValue(true);

    const workflow = workflowFactory({
      tools: {},
      logger: vi.fn(),
      setState: vi.fn(),
      getState: vi.fn().mockReturnValue({
        loading: false,
        messages: [],
        inputDisabled: false,
      }),
      appendMessage: vi.fn(),
      onConfirm: mockOnConfirm,
      onPromptUser: vi.fn(),
      onSelect: vi.fn(),
      handleToolCall: vi.fn(),
    });

    workflow.initialize?.();

    // Test confirmation
    expect(capturedHooks).toBeTruthy();
    const result = await capturedHooks!.onConfirm("Are you sure?");

    expect(mockOnConfirm).toHaveBeenCalledWith("Are you sure?");
    expect(result).toBe(true);
  });

  it("should handle user prompts through onPromptUser", async () => {
    let capturedHooks: WorkflowHooks | null = null;

    const workflowFactory = createTestWorkflow((hooks) => {
      capturedHooks = hooks;
    });

    const mockOnPromptUser = vi.fn().mockResolvedValue("user input");

    const workflow = workflowFactory({
      tools: {},
      logger: vi.fn(),
      setState: vi.fn(),
      getState: vi.fn().mockReturnValue({
        loading: false,
        messages: [],
        inputDisabled: false,
      }),
      appendMessage: vi.fn(),
      onConfirm: vi.fn(),
      onPromptUser: mockOnPromptUser,
      onSelect: vi.fn(),
      handleToolCall: vi.fn(),
    });

    workflow.initialize?.();

    // Test prompt
    expect(capturedHooks).toBeTruthy();
    const result = await capturedHooks!.onPromptUser("Enter your name:");

    expect(mockOnPromptUser).toHaveBeenCalledWith("Enter your name:");
    expect(result).toBe("user input");
  });

  it("should handle selection through onSelect", async () => {
    let capturedHooks: WorkflowHooks | null = null;

    const workflowFactory = createTestWorkflow((hooks) => {
      capturedHooks = hooks;
    });

    const mockOnSelect = vi.fn().mockResolvedValue("option2");
    const items = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
    ];

    const workflow = workflowFactory({
      tools: {},
      logger: vi.fn(),
      setState: vi.fn(),
      getState: vi.fn().mockReturnValue({
        loading: false,
        messages: [],
        inputDisabled: false,
      }),
      appendMessage: vi.fn(),
      onConfirm: vi.fn(),
      onPromptUser: vi.fn(),
      onSelect: mockOnSelect,
      handleToolCall: vi.fn(),
    });

    workflow.initialize?.();

    // Test selection
    expect(capturedHooks).toBeTruthy();
    const result = await capturedHooks!.onSelect(items, { required: true });

    expect(mockOnSelect).toHaveBeenCalledWith(items, { required: true });
    expect(result).toBe("option2");
  });

  it("should demonstrate a complete workflow with state updates and user interactions", async () => {
    let capturedHooks: WorkflowHooks | null = null;
    const stateHistory: Array<any> = [];

    const workflowFactory = createTestWorkflow((hooks) => {
      capturedHooks = hooks;
    });

    let currentState = {
      loading: false,
      messages: [] as Array<UIMessage>,
      inputDisabled: false,
    };

    const mockSetState = vi.fn().mockImplementation((updater) => {
      if (typeof updater === "function") {
        const newState = updater(currentState);
        currentState = newState;
        stateHistory.push(newState);
      } else {
        // Top-level merge only
        currentState = { ...currentState, ...updater };
        stateHistory.push(currentState);
      }
    });

    const mockGetState = vi.fn().mockImplementation(() => currentState);

    const workflow = workflowFactory({
      tools: {},
      logger: vi.fn(),
      setState: mockSetState,
      getState: mockGetState,
      appendMessage: vi.fn(),
      onConfirm: vi.fn().mockResolvedValue(true),
      onPromptUser: vi.fn().mockResolvedValue("Test User"),
      onSelect: vi.fn().mockResolvedValue("continue"),
      handleToolCall: vi.fn(),
    });

    // Initialize
    workflow.initialize?.();

    expect(capturedHooks).toBeTruthy();

    // Simulate a workflow that:
    // 1. Sets loading state
    capturedHooks!.setState({ loading: true });

    // 2. Adds a message
    capturedHooks!.setState((prev: WorkflowState) => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: "1",
          role: "assistant",
          content: "Hello! Let me help you.",
        } as UIMessage,
      ],
    }));

    // 3. Asks for confirmation
    const confirmed = await capturedHooks!.onConfirm("Proceed with task?");
    expect(confirmed).toBe(true);

    // 4. Gets user input
    const userName = await capturedHooks!.onPromptUser("What's your name?");
    expect(userName).toBe("Test User");

    // 5. Shows selection
    const choice = await capturedHooks!.onSelect([
      { label: "Continue", value: "continue" },
      { label: "Stop", value: "stop" },
    ]);
    expect(choice).toBe("continue");

    // 6. Updates state with result
    capturedHooks!.setState((prev: WorkflowState) => ({
      ...prev,
      loading: false,
      messages: [
        ...prev.messages,
        {
          id: "2",
          role: "ui",
          content: `Great ${userName}, let's continue!`,
        } as UIMessage,
      ],
    }));

    // Verify state history
    expect(stateHistory).toHaveLength(4); // init + 3 updates
    expect(stateHistory[0]).toEqual({
      loading: false,
      messages: [
        {
          id: "init",
          role: "ui",
          content: "Workflow initialized",
        },
      ],
      inputDisabled: false,
    });
    expect(stateHistory[1]).toEqual({
      loading: true,
      messages: [
        {
          id: "init",
          role: "ui",
          content: "Workflow initialized",
        },
      ],
      inputDisabled: false,
    });
    expect(stateHistory[3].loading).toBe(false);
    expect(stateHistory[3].messages).toHaveLength(3);
  });

  it("should handle setState with both object and function forms", () => {
    let capturedHooks: WorkflowHooks | null = null;
    const states: Array<any> = [];

    const workflowFactory = createTestWorkflow((hooks) => {
      capturedHooks = hooks;
    });

    let currentState = {
      loading: false,
      messages: [] as Array<UIMessage>,
      inputDisabled: false,
    };

    const mockSetState = vi.fn().mockImplementation((updater) => {
      if (typeof updater === "function") {
        currentState = updater(currentState);
      } else {
        // Top-level merge only
        currentState = { ...currentState, ...updater };
      }
      states.push({ ...currentState });
    });

    const mockGetState = vi.fn().mockImplementation(() => currentState);

    const workflow = workflowFactory({
      tools: {},
      logger: vi.fn(),
      setState: mockSetState,
      getState: mockGetState,
      appendMessage: vi.fn(),
      onConfirm: vi.fn(),
      onPromptUser: vi.fn(),
      onSelect: vi.fn(),
      handleToolCall: vi.fn(),
    });

    workflow.initialize?.();

    expect(capturedHooks).toBeTruthy();

    // Test 1: Object form replaces arrays
    capturedHooks!.setState({
      messages: [
        { id: "1", role: "ui", content: "First" } as UIMessage,
        { id: "2", role: "ui", content: "Second" } as UIMessage,
      ],
    });

    expect(currentState.messages).toHaveLength(2);

    // Test 2: Object form with single message REPLACES array
    capturedHooks!.setState({
      messages: [{ id: "3", role: "ui", content: "Only this" } as UIMessage],
    });

    expect(currentState.messages).toHaveLength(1);
    expect(currentState.messages[0]?.content).toBe("Only this");

    // Test 3: Function form to append
    capturedHooks!.setState((prev: WorkflowState) => ({
      ...prev,
      messages: [
        ...prev.messages,
        { id: "4", role: "ui", content: "Appended" } as UIMessage,
      ],
    }));

    expect(currentState.messages).toHaveLength(2);
    expect(currentState.messages[1]?.content).toBe("Appended");

    // Test 4: Partial update preserves other fields
    capturedHooks!.setState({ loading: true });

    expect(currentState.loading).toBe(true);
    expect(currentState.messages).toHaveLength(2); // Messages unchanged
    expect(currentState.inputDisabled).toBe(false); // inputDisabled unchanged
  });
});
