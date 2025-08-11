import { test, expect } from "vitest";
import type { Workflow } from "../src/workflow";
import React from "react";

test("Workflow interface includes optional displayConfig with ReactNode header", () => {
  // Test that displayConfig.header accepts string values (backwards compatibility)
  const workflowWithStringHeader: Partial<Workflow> = {
    displayConfig: {
      header: "Custom Workflow Header",
    },
    message: () => {},
    stop: () => {},
    terminate: () => {},
  };

  expect(workflowWithStringHeader.displayConfig?.header).toBe(
    "Custom Workflow Header",
  );
  expect(typeof workflowWithStringHeader.displayConfig?.header).toBe("string");

  // Test that displayConfig.header accepts ReactNode values
  const workflowWithReactHeader: Partial<Workflow> = {
    displayConfig: {
      header: React.createElement("span", {}, "React Header"),
    },
    message: () => {},
    stop: () => {},
    terminate: () => {},
  };

  expect(React.isValidElement(workflowWithReactHeader.displayConfig?.header)).toBe(true);
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

test("New ReactNode formatter functions", () => {
  // Test that the new formatter functions are available and optional
  const workflowWithFormatters: Partial<Workflow> = {
    displayConfig: {
      formatRoleHeader: (message) => React.createElement("span", {}, message.role),
      formatMessage: (_message) => React.createElement("div", {}, "Formatted message"),
    },
    message: () => {},
    stop: () => {},
    terminate: () => {},
  };

  expect(typeof workflowWithFormatters.displayConfig?.formatRoleHeader).toBe("function");
  expect(typeof workflowWithFormatters.displayConfig?.formatMessage).toBe("function");

  // Test that functions return ReactNodes
  const mockMessage = { role: "user", content: "test" } as any;
  const roleHeader = workflowWithFormatters.displayConfig?.formatRoleHeader?.(mockMessage);
  const formattedMessage = workflowWithFormatters.displayConfig?.formatMessage?.(mockMessage);

  expect(React.isValidElement(roleHeader)).toBe(true);
  expect(React.isValidElement(formattedMessage)).toBe(true);
});
