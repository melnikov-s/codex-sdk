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

test("SelectOptions interface supports optional properties", () => {
  const options1: SelectOptions = {};
  expect(options1.required).toBeUndefined();
  expect(options1.default).toBeUndefined();

  const options2: SelectOptions = {
    required: true,
    default: "default-value",
  };
  expect(options2.required).toBe(true);
  expect(options2.default).toBe("default-value");
});

test("SelectOptions can have partial properties", () => {
  const requiredOnly: SelectOptions = { required: true };
  expect(requiredOnly.required).toBe(true);
  expect(requiredOnly.default).toBeUndefined();

  const defaultOnly: SelectOptions = { default: "test" };
  expect(defaultOnly.default).toBe("test");
  expect(defaultOnly.required).toBeUndefined();
});
