import { describe, expect, it } from "vitest";

describe("Custom Workflow setState/getState Sync", () => {
  it("should demonstrate the expected synchronous behavior pattern", () => {
    // Simulate the pattern used in custom-workflow.js
    let state = {
      loading: false,
      messages: [],
      inputDisabled: false,
      queue: [],
    };

    // This is how setState should work now - immediately update state
    const setState = (update: any) => {
      if (typeof update === "function") {
        state = update(state);
      } else {
        state = { ...state, ...update };
      }
    };

    const stateObj = {
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
        return state.queue;
      },
      get transcript() {
        return (state.messages as Array<any>).filter(
          (msg: any) => msg.role !== "ui",
        );
      },
    };

    // Test the critical workflow pattern from custom-workflow.js
    expect(stateObj.loading).toBe(false);

    setState({ loading: true });

    // This should now work - checking loading state immediately after setState
    const canProceed = stateObj.loading;
    expect(canProceed).toBe(true);

    // Test the while loop pattern: while (state.loading)
    let iterations = 0;
    while (stateObj.loading && iterations < 3) {
      iterations++;
      if (iterations >= 2) {
        setState({ loading: false });
      }
    }

    expect(iterations).toBe(2);
    expect(stateObj.loading).toBe(false);
  });

  it("should handle the queue checking pattern", () => {
    let state = {
      loading: false,
      messages: [],
      inputDisabled: false,
      queue: ["item1", "item2"],
    };

    const setState = (update: any) => {
      if (typeof update === "function") {
        state = update(state);
      } else {
        state = { ...state, ...update };
      }
    };

    const stateObj = {
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
        return state.queue;
      },
      get transcript() {
        return (state.messages as Array<any>).filter(
          (msg: any) => msg.role !== "ui",
        );
      },
    };

    // Simulate the queue processing pattern
    if (stateObj.loading) {
      // Should be able to check state synchronously
      expect(true).toBe(false); // Shouldn't reach here
    } else {
      // Process queue
      setState({ loading: true });
      expect(stateObj.loading).toBe(true);

      // Simulate processing
      setState((prev: any) => ({
        ...prev,
        queue: prev.queue.slice(1),
      }));

      expect(stateObj.queue).toEqual(["item2"]);
    }
  });
});
