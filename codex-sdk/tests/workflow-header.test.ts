import { test, expect } from "vitest";
import type { Workflow } from "../src/workflow";

test("Workflow interface includes optional displayConfig with header", () => {
  // Test that displayConfig.header is optional and accepts string values
  const workflowWithHeader: Partial<Workflow> = {
    displayConfig: {
      header: "Custom Workflow Header",
    },
    message: () => {},
    stop: () => {},
    terminate: () => {},
  };

  expect(workflowWithHeader.displayConfig?.header).toBe(
    "Custom Workflow Header",
  );
  expect(typeof workflowWithHeader.displayConfig?.header).toBe("string");
});

test("Workflow can exist without displayConfig header", () => {
  // Test that displayConfig.header is truly optional
  const workflowWithoutHeader: Partial<Workflow> = {
    message: () => {},
    stop: () => {},
    terminate: () => {},
  };

  expect(workflowWithoutHeader.displayConfig?.header).toBeUndefined();
});

test("Header fallback behavior", () => {
  // Test fallback logic similar to what's used in the component
  const workflowWithHeader = {
    displayConfig: {
      header: "My Custom Header",
    },
  };
  const workflowWithoutHeader = {};

  const getDisplayHeader = (workflow?: {
    displayConfig?: { header?: string };
  }) => {
    return workflow?.displayConfig?.header || "Codex (Default workflow)";
  };

  expect(getDisplayHeader(workflowWithHeader)).toBe("My Custom Header");
  expect(getDisplayHeader(workflowWithoutHeader)).toBe(
    "Codex (Default workflow)",
  );
  expect(getDisplayHeader(undefined)).toBe("Codex (Default workflow)");
});
