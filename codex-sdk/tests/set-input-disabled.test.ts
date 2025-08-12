import { test, expect } from "vitest";
import type { WorkflowHooks, WorkflowState } from "../src/workflow";

test("input disabled state can be controlled through setState", () => {
  let currentState: WorkflowState = {
    loading: false,
    messages: [],
    inputDisabled: false,
    queue: [],
  };

  const mockHooks: Partial<WorkflowHooks> = {
    setState: async (state) => {
      if (typeof state === "function") {
        currentState = state(currentState);
      } else {
        currentState = { ...currentState, ...state };
      }
      return Promise.resolve();
    },
    state: {
      get loading() {
        return currentState.loading;
      },
      get messages() {
        return currentState.messages;
      },
      get inputDisabled() {
        return currentState.inputDisabled;
      },
      get queue() {
        return currentState.queue || [];
      },
      get taskList() {
        return currentState.taskList || [];
      },
      get transcript() {
        return currentState.messages.filter((msg) => msg.role !== "ui");
      },
    },
  };

  expect(mockHooks.setState).toBeDefined();
  expect(typeof mockHooks.setState).toBe("function");

  mockHooks.setState?.({ inputDisabled: true });
  expect(currentState.inputDisabled).toBe(true);

  mockHooks.setState?.({ inputDisabled: false });
  expect(currentState.inputDisabled).toBe(false);
});

test("input disabled state can be controlled through setState with function", () => {
  let currentState: WorkflowState = {
    loading: false,
    messages: [],
    inputDisabled: false,
    queue: [],
  };

  const setState = (
    updater: Partial<WorkflowState> | ((prev: WorkflowState) => WorkflowState),
  ) => {
    if (typeof updater === "function") {
      currentState = updater(currentState);
    } else {
      currentState = { ...currentState, ...updater };
    }
  };

  setState((prev) => ({ ...prev, inputDisabled: !prev.inputDisabled }));
  expect(currentState.inputDisabled).toBe(true);

  setState((prev) => ({ ...prev, inputDisabled: false }));
  expect(currentState.inputDisabled).toBe(false);
});
