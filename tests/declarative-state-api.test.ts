import type { WorkflowHooks, WorkflowState } from "../src/workflow/index.js";

import { createAgentWorkflow } from "../src/workflow/index.js";
import { describe, expect, it, vi } from "vitest";

describe("Declarative State API", () => {
  describe("setState behavior", () => {
    it("should merge partial state updates", () => {
      let currentState: WorkflowState = {
        loading: false,
        messages: [],
        inputDisabled: false,
        queue: [],
      };

      const mockSetState = (
        updater:
          | Partial<WorkflowState>
          | ((prev: WorkflowState) => WorkflowState),
      ) => {
        if (typeof updater === "function") {
          currentState = updater(currentState);
        } else {
          // Simulate the merge behavior - top level only
          currentState = { ...currentState, ...updater };
        }
      };

      // Test partial update
      mockSetState({ loading: true });
      expect(currentState).toEqual({
        loading: true,
        messages: [],
        inputDisabled: false,
        queue: [],
      });

      // Test another partial update
      mockSetState({ inputDisabled: true });
      expect(currentState).toEqual({
        loading: true,
        messages: [],
        inputDisabled: true,
        queue: [],
      });

      // Test updating back to false
      mockSetState({ loading: false });
      expect(currentState).toEqual({
        loading: false,
        messages: [],
        inputDisabled: true,
        queue: [],
      });
    });

    it("should handle function form of setState", () => {
      let currentState: WorkflowState = {
        loading: false,
        messages: [{ role: "user", content: "Hello" }],
        inputDisabled: false,
        queue: [],
      };

      const mockSetState = (
        updater:
          | Partial<WorkflowState>
          | ((prev: WorkflowState) => WorkflowState),
      ) => {
        if (typeof updater === "function") {
          currentState = updater(currentState);
        } else {
          currentState = { ...currentState, ...updater };
        }
      };

      // Test function form
      mockSetState((prev) => ({
        ...prev,
        loading: true,
        messages: [...prev.messages, { role: "assistant", content: "Hi!" }],
      }));

      expect(currentState).toEqual({
        loading: true,
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi!" },
        ],
        inputDisabled: false,
        queue: [],
      });
    });

    it("should replace messages array when using object form", () => {
      let currentState: WorkflowState = {
        loading: false,
        messages: [{ role: "user", content: "First message" }],
        inputDisabled: false,
      };

      // Simulate the setState behavior from terminal-chat.tsx
      const setState = (
        updater:
          | Partial<WorkflowState>
          | ((prev: WorkflowState) => WorkflowState),
      ) => {
        if (typeof updater === "function") {
          currentState = updater(currentState);
        } else {
          // Object form - merge at top level only
          currentState = { ...currentState, ...updater };
        }
      };

      // Test message replacement
      setState({
        messages: [{ role: "assistant", content: "New message" }],
      });

      // Should REPLACE, not append
      expect(currentState.messages).toHaveLength(1);
      expect(currentState.messages[0]).toEqual({
        role: "assistant",
        content: "New message",
      });

      // Test replacing with empty array
      setState({
        messages: [],
      });

      expect(currentState.messages).toHaveLength(0);

      // Test replacing with multiple messages
      setState({
        messages: [
          { role: "ui", content: "Message 1" },
          { role: "ui", content: "Message 2" },
        ],
      });

      expect(currentState.messages).toHaveLength(2);
      expect(currentState.messages[0]).toEqual({
        role: "ui",
        content: "Message 1",
      });
      expect(currentState.messages[1]).toEqual({
        role: "ui",
        content: "Message 2",
      });
    });

    it("should replace objects completely (not merge) - slots example", () => {
      let currentState: WorkflowState = {
        loading: false,
        messages: [],
        inputDisabled: false,
        slots: {
          aboveInput: "Initial slot content",
          belowInput: "Another slot",
        },
      };

      // Simulate the setState behavior from terminal-chat.tsx
      const setState = (
        updater:
          | Partial<WorkflowState>
          | ((prev: WorkflowState) => WorkflowState),
      ) => {
        if (typeof updater === "function") {
          currentState = updater(currentState);
        } else {
          // Simple top-level shallow merge - everything else replaced
          currentState = { ...currentState, ...updater };
        }
      };

      // Test slots replacement - should replace ALL slots, not merge
      setState({
        slots: {
          aboveInput: "New content only",
        },
      });

      // Should completely replace slots object (belowInput is gone)
      expect(currentState.slots).toEqual({
        aboveInput: "New content only",
      });
      expect(currentState.slots?.belowInput).toBeUndefined();

      // Other state properties should be preserved
      expect(currentState.loading).toBe(false);
      expect(currentState.messages).toEqual([]);
      expect(currentState.inputDisabled).toBe(false);
    });
  });

  describe("addMessage behavior", () => {
    it("should append a single message", () => {
      let currentState: WorkflowState = {
        loading: false,
        messages: [{ role: "user", content: "Hello" }],
        inputDisabled: false,
      };

      const mockAddMessage = (message: any) => {
        const messages = Array.isArray(message) ? message : [message];
        currentState = {
          ...currentState,
          messages: [...currentState.messages, ...messages],
        };
      };

      mockAddMessage({ role: "assistant", content: "Hi there!" });

      expect(currentState.messages).toHaveLength(2);
      expect(currentState.messages[1]).toEqual({
        role: "assistant",
        content: "Hi there!",
      });
    });

    it("should append multiple messages", () => {
      let currentState: WorkflowState = {
        loading: false,
        messages: [{ role: "user", content: "Hello" }],
        inputDisabled: false,
      };

      const mockAddMessage = (message: any) => {
        const messages = Array.isArray(message) ? message : [message];
        currentState = {
          ...currentState,
          messages: [...currentState.messages, ...messages],
        };
      };

      const newMessages = [
        { role: "assistant", content: "Message 1" },
        { role: "assistant", content: "Message 2" },
      ];

      mockAddMessage(newMessages);

      expect(currentState.messages).toHaveLength(3);
      expect(currentState.messages[1]).toEqual({
        role: "assistant",
        content: "Message 1",
      });
      expect(currentState.messages[2]).toEqual({
        role: "assistant",
        content: "Message 2",
      });
    });

    it("should preserve other state properties when appending messages", () => {
      let currentState: WorkflowState = {
        loading: true,
        messages: [],
        inputDisabled: true,
      };

      const mockAddMessage = (message: any) => {
        const messages = Array.isArray(message) ? message : [message];
        currentState = {
          ...currentState,
          messages: [...currentState.messages, ...messages],
        };
      };

      mockAddMessage({ role: "ui", content: "Test message" });

      expect(currentState).toEqual({
        loading: true,
        messages: [{ role: "ui", content: "Test message" }],
        inputDisabled: true,
      });
    });
  });

  describe("say behavior", () => {
    it("should create UI messages from strings", () => {
      let currentState: WorkflowState = {
        loading: false,
        messages: [],
        inputDisabled: false,
      };

      const mockSay = (text: string) => {
        const message = { role: "ui" as const, content: text };
        currentState = {
          ...currentState,
          messages: [...currentState.messages, message],
        };
      };

      mockSay("Test UI message");

      expect(currentState.messages).toHaveLength(1);
      expect(currentState.messages[0]).toEqual({
        role: "ui",
        content: "Test UI message",
      });
    });

    it("should exclude UI messages from transcript", () => {
      const messages = [
        { role: "user" as const, content: "Hello" },
        { role: "ui" as const, content: "Processing..." },
        { role: "assistant" as const, content: "Hi there!" },
        { role: "ui" as const, content: "Done" },
      ];

      const transcript = messages.filter((msg) => msg.role !== "ui");

      expect(transcript).toHaveLength(2);
      expect(transcript[0]).toEqual({ role: "user", content: "Hello" });
      expect(transcript[1]).toEqual({
        role: "assistant",
        content: "Hi there!",
      });
    });
  });

  describe("Workflow integration", () => {
    it("should provide setState and getState to workflows", () => {
      const mockHooks: WorkflowHooks = {
        setState: vi.fn(),
        state: {
          loading: false,
          messages: [],
          inputDisabled: false,
          queue: [],
          taskList: [],
          transcript: [],
        },
        actions: {
          say: vi.fn(),
          addMessage: vi.fn(),
          setLoading: vi.fn(),
          setInputDisabled: vi.fn(),
          setStatusLine: vi.fn(),
          setSlot: vi.fn(),
          clearSlot: vi.fn(),
          clearAllSlots: vi.fn(),
          addToQueue: vi.fn(),
          removeFromQueue: vi.fn(() => undefined),
          clearQueue: vi.fn(),
          addTask: vi.fn(),
          toggleTask: vi.fn(),
          clearTaskList: vi.fn(),
          setInputValue: vi.fn(),
          truncateFromLastMessage: vi.fn(() => []),
          handleModelResult: vi.fn(),
          createAgent: vi.fn((name: string) => ({
            id: "test-id-1",
            name,
            say: vi.fn(),
            addMessage: vi.fn(),
            transcript: vi.fn(() => []),
            handleModelResults: vi.fn(async () => []),
            setName: vi.fn(),
          })),
          getAgent: vi.fn(() => undefined),
        },
        tools: {
          definitions: {},
          execute: vi.fn(),
        },
        prompts: {
          select: vi.fn(),
          confirm: vi.fn(),
          input: vi.fn(),
        },
        control: {
          message: vi.fn(),
          stop: vi.fn(),
          terminate: vi.fn(),
        },
      };

      const workflow = createAgentWorkflow((hooks) => {
        // Verify hooks are provided
        expect(hooks.setState).toBeDefined();
        expect(hooks.state).toBeDefined();

        return {
          initialize: () => {
            hooks.setState({ loading: true });
            expect(hooks.state).toBeDefined();
          },
          message: () => {},
          stop: () => {},
          terminate: () => {},
        };
      });

      const instance = workflow(mockHooks);
      instance.initialize?.();

      expect(mockHooks.setState).toHaveBeenCalledWith({ loading: true });
    });

    it("should handle complex workflow state updates", () => {
      let workflowState: WorkflowState = {
        loading: false,
        messages: [],
        inputDisabled: false,
      };

      const mockHooks: WorkflowHooks = {
        setState: vi.fn(async (updater) => {
          if (typeof updater === "function") {
            workflowState = updater(workflowState);
          } else {
            // Merge at top level only
            workflowState = { ...workflowState, ...updater };
          }
          return Promise.resolve();
        }),
        state: {
          get loading() {
            return workflowState.loading;
          },
          get messages() {
            return workflowState.messages;
          },
          get inputDisabled() {
            return workflowState.inputDisabled;
          },
          get queue() {
            return workflowState.queue || [];
          },
          get taskList() {
            return workflowState.taskList || [];
          },
          get transcript() {
            return workflowState.messages.filter((msg) => msg.role !== "ui");
          },
        },
        actions: {
          say: vi.fn(),
          addMessage: vi.fn(),
          setLoading: vi.fn(),
          setInputDisabled: vi.fn(),
          setStatusLine: vi.fn(),
          setSlot: vi.fn(),
          clearSlot: vi.fn(),
          clearAllSlots: vi.fn(),
          addToQueue: vi.fn(),
          removeFromQueue: vi.fn(() => undefined),
          clearQueue: vi.fn(),
          addTask: vi.fn(),
          toggleTask: vi.fn(),
          clearTaskList: vi.fn(),
          setInputValue: vi.fn(),
          truncateFromLastMessage: vi.fn(() => []),
          handleModelResult: vi.fn(),
          createAgent: vi.fn((name: string) => ({
            id: "test-id-2",
            name,
            say: vi.fn(),
            addMessage: vi.fn(),
            transcript: vi.fn(() => []),
            handleModelResults: vi.fn(async () => []),
            setName: vi.fn(),
          })),
          getAgent: vi.fn(() => undefined),
        },
        tools: {
          definitions: {},
          execute: vi.fn(),
        },
        prompts: {
          select: vi.fn(),
          confirm: vi.fn(),
          input: vi.fn(),
        },
        control: {
          message: vi.fn(),
          stop: vi.fn(),
          terminate: vi.fn(),
        },
      };

      const workflow = createAgentWorkflow((hooks) => {
        return {
          initialize: () => {
            // Add initial UI message
            hooks.setState({
              messages: [{ role: "ui", content: "Agent initialized" }],
            });
          },
          message: (input) => {
            // Set loading
            hooks.setState({ loading: true });

            // Add user message using function form
            hooks.setState((prev) => ({
              ...prev,
              messages: [...prev.messages, input],
            }));

            // Simulate processing and add assistant message
            hooks.setState((prev) => ({
              ...prev,
              messages: [
                ...prev.messages,
                { role: "assistant", content: "Processing..." },
              ],
            }));

            // Complete processing
            hooks.setState({ loading: false });
          },
          stop: () => {
            hooks.setState({ loading: false });
            hooks.setState((prev) => ({
              ...prev,
              messages: [...prev.messages, { role: "ui", content: "Stopped" }],
            }));
          },
          terminate: () => {
            // Use function form to replace entire state
            hooks.setState(() => ({
              loading: false,
              messages: [],
              inputDisabled: false,
            }));
          },
        };
      });

      const instance = workflow(mockHooks);

      // Test initialize
      instance.initialize?.();
      expect(workflowState.messages).toHaveLength(1);
      expect(workflowState.messages[0]).toEqual({
        role: "ui",
        content: "Agent initialized",
      });

      // Test message handling
      instance.message({ role: "user", content: "Hello" });
      expect(workflowState.loading).toBe(false);
      expect(workflowState.messages).toHaveLength(3);
      expect(workflowState.messages[1]).toEqual({
        role: "user",
        content: "Hello",
      });
      expect(workflowState.messages[2]).toEqual({
        role: "assistant",
        content: "Processing...",
      });

      // Test stop
      instance.stop();
      expect(workflowState.loading).toBe(false);
      expect(workflowState.messages).toHaveLength(4);
      expect(workflowState.messages[3]).toEqual({
        role: "ui",
        content: "Stopped",
      });

      // Test terminate
      instance.terminate();
      expect(workflowState).toEqual({
        loading: false,
        messages: [],
        inputDisabled: false,
      });
    });
  });

  describe("State isolation", () => {
    it("should not share state between workflow instances", () => {
      const createMockHooks = (): WorkflowHooks => {
        let state: WorkflowState = {
          loading: false,
          messages: [],
          inputDisabled: false,
          taskList: [],
        };

        return {
          setState: vi.fn(async (updater) => {
            if (typeof updater === "function") {
              state = updater(state);
            } else {
              // Merge at top level only
              state = { ...state, ...updater };
            }
            return Promise.resolve();
          }),
          state: {
            get loading() {
              return state.loading;
            },
            get messages() {
              return state.messages;
            },
            get inputDisabled() {
              return state.inputDisabled;
            },
            get queue() {
              return state.queue || [];
            },
            get taskList() {
              return state.taskList || [];
            },
            get transcript() {
              return state.messages.filter((msg) => msg.role !== "ui");
            },
          },
          actions: {
            say: vi.fn(),
            addMessage: vi.fn(),
            setLoading: vi.fn(),
            setInputDisabled: vi.fn(),
            setStatusLine: vi.fn(),
            setSlot: vi.fn(),
            clearSlot: vi.fn(),
            clearAllSlots: vi.fn(),
            addToQueue: vi.fn(),
            removeFromQueue: vi.fn(() => undefined),
            clearQueue: vi.fn(),
            addTask: vi.fn(),
            toggleTask: vi.fn(),
            clearTaskList: vi.fn(),
            setInputValue: vi.fn(),
            truncateFromLastMessage: vi.fn(() => []),
            handleModelResult: vi.fn(),
            createAgent: vi.fn((name: string) => ({
              id: "test-id-3",
              name,
              say: vi.fn(),
              addMessage: vi.fn(),
              transcript: vi.fn(() => []),
              handleModelResults: vi.fn(async () => []),
              setName: vi.fn(),
            })),
            getAgent: vi.fn(() => undefined),
          },
          tools: {
            definitions: {},
            execute: vi.fn(),
          },
          prompts: {
            select: vi.fn(),
            confirm: vi.fn(),
            input: vi.fn(),
          },
          control: {
            message: vi.fn(),
            stop: vi.fn(),
            terminate: vi.fn(),
          },
        };
      };

      const workflowFactory = createAgentWorkflow((hooks) => {
        return {
          initialize: () => {
            hooks.setState({
              messages: [{ role: "ui", content: "Instance initialized" }],
            });
          },
          message: () => {},
          stop: () => {},
          terminate: () => {},
        };
      });

      // Create two instances
      const hooks1 = createMockHooks();
      const hooks2 = createMockHooks();

      const instance1 = workflowFactory(hooks1);
      const instance2 = workflowFactory(hooks2);

      // Initialize both
      instance1.initialize?.();
      instance2.initialize?.();

      // Verify they have separate states
      const state1 = hooks1.state;
      const state2 = hooks2.state;

      expect(state1.messages).toHaveLength(1);
      expect(state2.messages).toHaveLength(1);

      // Modify one instance
      hooks1.setState({ loading: true });

      // Verify isolation
      expect(hooks1.state.loading).toBe(true);
      expect(hooks2.state.loading).toBe(false);
    });
  });
});
