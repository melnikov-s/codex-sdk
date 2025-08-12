import { describe, expect, it } from "vitest";
import type { WorkflowState } from "../src/workflow/index.js";

describe("Queue Convenience Methods", () => {
it("pushQueue should add items to the queue", () => {
    let workflowState: WorkflowState = {
      loading: false,
      messages: [],
      inputDisabled: false,
      queue: [],
    };

  const pushQueue = (item: string | Array<string>) => {
      const items = Array.isArray(item) ? item : [item];
      workflowState = {
        ...workflowState,
        queue: [...(workflowState.queue || []), ...items],
      };
    };

  pushQueue("item1");
    expect(workflowState.queue).toEqual(["item1"]);

  pushQueue(["item2", "item3"]);
    expect(workflowState.queue).toEqual(["item1", "item2", "item3"]);
  });

it("shiftQueue should remove and return first item", () => {
    let workflowState: WorkflowState = {
      loading: false,
      messages: [],
      inputDisabled: false,
      queue: ["first", "second", "third"],
    };

  const shiftQueue = (): string | undefined => {
      const queue = workflowState.queue || [];
      if (queue.length === 0) {
        return undefined;
      }
      const firstItem = queue[0];
      workflowState = {
        ...workflowState,
        queue: queue.slice(1),
      };
      return firstItem;
    };

  const first = shiftQueue();
    expect(first).toBe("first");
    expect(workflowState.queue).toEqual(["second", "third"]);

  const second = shiftQueue();
    expect(second).toBe("second");
    expect(workflowState.queue).toEqual(["third"]);

  const third = shiftQueue();
    expect(third).toBe("third");
    expect(workflowState.queue).toEqual([]);

  const empty = shiftQueue();
    expect(empty).toBe(undefined);
    expect(workflowState.queue).toEqual([]);
  });
});
