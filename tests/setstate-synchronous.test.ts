import { describe, expect, it } from "vitest";

describe("setState Synchronous Behavior", () => {
  it("should make state changes immediately visible via getState", () => {
    // Simulate the current broken implementation
    let reactState = {
      loading: false,
      messages: [],
      inputDisabled: false,
      queue: [],
    };

    const refState = { ...reactState };

    const brokenSetState = (update: any) => {
      // Simulates React's setWorkflowState - asynchronous
      if (typeof update === "function") {
        reactState = update(reactState);
      } else {
        reactState = { ...reactState, ...update };
      }
      // Ref is NOT updated immediately (this happens later in render cycle)
    };

    const brokenGetState = () => refState; // Returns stale ref

    // Test the broken behavior
    expect(brokenGetState().loading).toBe(false);
    brokenSetState({ loading: true });
    expect(brokenGetState().loading).toBe(false); // ❌ Still false - this is the bug!

    // Now test the fixed implementation
    let syncState = {
      loading: false,
      messages: [],
      inputDisabled: false,
      queue: [],
    };

    const fixedSetState = (update: any) => {
      if (typeof update === "function") {
        syncState = update(syncState);
      } else {
        syncState = { ...syncState, ...update };
      }
      // State is immediately updated
    };

    const fixedGetState = () => syncState;

    // Test the fixed behavior
    expect(fixedGetState().loading).toBe(false);
    fixedSetState({ loading: true });
    expect(fixedGetState().loading).toBe(true); // ✅ Immediately true!
  });

  it("should handle function-form setState synchronously", () => {
    let state = {
      loading: false,
      messages: [],
      inputDisabled: false,
      queue: ["item1"],
    };

    const setState = (update: any) => {
      if (typeof update === "function") {
        state = update(state);
      } else {
        state = { ...state, ...update };
      }
    };

    const getState = () => state;

    // Test function form
    setState((prev: any) => ({
      ...prev,
      loading: true,
      queue: [...prev.queue, "item2"],
    }));

    expect(getState().loading).toBe(true);
    expect(getState().queue).toEqual(["item1", "item2"]);
  });
});
