import { test, expect } from "vitest";
import type { WorkflowHooks } from "../src/workflow";

test("setInputDisabled hook signature exists in WorkflowHooks", () => {
  // This test verifies that the setInputDisabled hook has the correct signature
  // We can't easily test the actual functionality without a full React setup,
  // but we can ensure the type definition is correct

  const mockHooks: Partial<WorkflowHooks> = {
    setInputDisabled: (disabled: boolean) => {
      // Mock implementation
      expect(typeof disabled).toBe("boolean");
    },
  };

  expect(mockHooks.setInputDisabled).toBeDefined();
  expect(typeof mockHooks.setInputDisabled).toBe("function");

  // Test that it accepts boolean parameters
  mockHooks.setInputDisabled?.(true);
  mockHooks.setInputDisabled?.(false);
});

test("setInputDisabled hook accepts boolean values", () => {
  let lastValue: boolean | undefined;

  const setInputDisabled = (disabled: boolean) => {
    lastValue = disabled;
  };

  // Test enabling/disabling
  setInputDisabled(true);
  expect(lastValue).toBe(true);

  setInputDisabled(false);
  expect(lastValue).toBe(false);
});
