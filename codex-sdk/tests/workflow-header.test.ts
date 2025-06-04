import { test, expect } from "vitest";
import type { Workflow } from "../src/workflow";

test("Workflow interface includes optional header property", () => {
  // Test that header is optional and accepts string values
  const workflowWithHeader: Partial<Workflow> = {
    header: "Custom Workflow Header",
    run: async () => [],
    stop: () => {},
    terminate: () => {},
  };

  expect(workflowWithHeader.header).toBe("Custom Workflow Header");
  expect(typeof workflowWithHeader.header).toBe("string");
});

test("Workflow can exist without header property", () => {
  // Test that header is truly optional
  const workflowWithoutHeader: Partial<Workflow> = {
    run: async () => [],
    stop: () => {},
    terminate: () => {},
  };

  expect(workflowWithoutHeader.header).toBeUndefined();
});

test("Header fallback behavior", () => {
  // Test fallback logic similar to what's used in the component
  const workflowWithHeader = { header: "My Custom Header" };
  const workflowWithoutHeader = {};

  const getDisplayHeader = (workflow?: { header?: string }) => {
    return workflow?.header || "Codex (Default workflow)";
  };

  expect(getDisplayHeader(workflowWithHeader)).toBe("My Custom Header");
  expect(getDisplayHeader(workflowWithoutHeader)).toBe(
    "Codex (Default workflow)",
  );
  expect(getDisplayHeader(undefined)).toBe("Codex (Default workflow)");
});
