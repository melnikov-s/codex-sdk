import { test, expect } from "vitest";
import type { SelectItem, SelectOptions } from "../src/workflow";

test("SelectItem interface has required properties", () => {
  const item: SelectItem = {
    label: "Test Label",
    value: "test-value",
  };

  expect(item.label).toBe("Test Label");
  expect(item.value).toBe("test-value");
});

test("SelectOptions interface requires defaultValue", () => {
  const options2: SelectOptions = {
    required: true,
    defaultValue: "default-value",
  };
  expect(options2.required).toBe(true);
  expect(options2.defaultValue).toBe("default-value");
});

test("SelectOptions can have required flag and defaultValue", () => {
  const requiredAndDefault: SelectOptions = {
    required: true,
    defaultValue: "test",
  };
  expect(requiredAndDefault.defaultValue).toBe("test");
  expect(requiredAndDefault.required).toBe(true);
});
