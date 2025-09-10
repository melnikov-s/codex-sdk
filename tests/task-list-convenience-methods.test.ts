import { describe, expect, it } from "vitest";
import type { WorkflowState, TaskItem } from "../src/workflow/index.js";

describe("Task List Convenience Methods", () => {
  it("addTask should add string tasks to the task list", () => {
    let workflowState: WorkflowState = {
      loading: false,
      messages: [],
      inputDisabled: false,
      taskList: [],
    };

    const addTask = (task: string | TaskItem | Array<string | TaskItem>) => {
      const tasks = Array.isArray(task) ? task : [task];
      const taskItems: Array<TaskItem> = tasks.map((t) => {
        if (typeof t === "string") {
          return { completed: false, label: t };
        } else {
          return { completed: t.completed, label: t.label };
        }
      });
      workflowState = {
        ...workflowState,
        taskList: [...(workflowState.taskList || []), ...taskItems],
      };
    };

    addTask("First task");
    expect(workflowState.taskList).toEqual([
      { completed: false, label: "First task" },
    ]);

    addTask("Second task");
    expect(workflowState.taskList).toEqual([
      { completed: false, label: "First task" },
      { completed: false, label: "Second task" },
    ]);
  });

  it("addTask should add TaskItem objects to the task list", () => {
    let workflowState: WorkflowState = {
      loading: false,
      messages: [],
      inputDisabled: false,
      taskList: [],
    };

    const addTask = (task: string | TaskItem | Array<string | TaskItem>) => {
      const tasks = Array.isArray(task) ? task : [task];
      const taskItems: Array<TaskItem> = tasks.map((t) => {
        if (typeof t === "string") {
          return { completed: false, label: t };
        } else {
          return { completed: t.completed, label: t.label };
        }
      });
      workflowState = {
        ...workflowState,
        taskList: [...(workflowState.taskList || []), ...taskItems],
      };
    };

    addTask({ completed: true, label: "Completed task" });
    expect(workflowState.taskList).toEqual([
      { completed: true, label: "Completed task" },
    ]);

    addTask({ completed: false, label: "Pending task" });
    expect(workflowState.taskList).toEqual([
      { completed: true, label: "Completed task" },
      { completed: false, label: "Pending task" },
    ]);
  });

  it("addTask should add arrays of mixed tasks to the task list", () => {
    let workflowState: WorkflowState = {
      loading: false,
      messages: [],
      inputDisabled: false,
      taskList: [],
    };

    const addTask = (task: string | TaskItem | Array<string | TaskItem>) => {
      const tasks = Array.isArray(task) ? task : [task];
      const taskItems: Array<TaskItem> = tasks.map((t) => {
        if (typeof t === "string") {
          return { completed: false, label: t };
        } else {
          return { completed: t.completed, label: t.label };
        }
      });
      workflowState = {
        ...workflowState,
        taskList: [...(workflowState.taskList || []), ...taskItems],
      };
    };

    addTask([
      "String task",
      { completed: true, label: "Object task" },
      "Another string task",
    ]);

    expect(workflowState.taskList).toEqual([
      { completed: false, label: "String task" },
      { completed: true, label: "Object task" },
      { completed: false, label: "Another string task" },
    ]);
  });

  it("toggleTask should toggle specific task by index", () => {
    let workflowState: WorkflowState = {
      loading: false,
      messages: [],
      inputDisabled: false,
      taskList: [
        { completed: false, label: "Task 1" },
        { completed: true, label: "Task 2" },
        { completed: false, label: "Task 3" },
      ],
    };

    const toggleTask = (index?: number) => {
      const taskList = workflowState.taskList || [];

      let targetIndex = index;

      // If no index provided, find the next incomplete task
      if (targetIndex === undefined) {
        targetIndex = taskList.findIndex((task) => !task.completed);
        if (targetIndex === -1) {
          // No incomplete tasks found, return unchanged
          return;
        }
      }

      // Validate index bounds
      if (targetIndex < 0 || targetIndex >= taskList.length) {
        return;
      }

      const newTaskList = [...taskList];
      const currentTask = newTaskList[targetIndex];
      if (currentTask) {
        newTaskList[targetIndex] = {
          ...currentTask,
          completed: !currentTask.completed,
        };
      }
      workflowState = {
        ...workflowState,
        taskList: newTaskList,
      };
    };

    // Toggle specific task by index
    toggleTask(0);
    expect(workflowState.taskList![0]).toEqual({
      completed: true,
      label: "Task 1",
    });

    toggleTask(1);
    expect(workflowState.taskList![1]).toEqual({
      completed: false,
      label: "Task 2",
    });

    // Toggle back
    toggleTask(0);
    expect(workflowState.taskList![0]).toEqual({
      completed: false,
      label: "Task 1",
    });
  });

  it("toggleTask should toggle next incomplete task when no index provided", () => {
    let workflowState: WorkflowState = {
      loading: false,
      messages: [],
      inputDisabled: false,
      taskList: [
        { completed: true, label: "Task 1" },
        { completed: false, label: "Task 2" },
        { completed: false, label: "Task 3" },
      ],
    };

    const toggleTask = (index?: number) => {
      const taskList = workflowState.taskList || [];

      let targetIndex = index;

      // If no index provided, find the next incomplete task
      if (targetIndex === undefined) {
        targetIndex = taskList.findIndex((task) => !task.completed);
        if (targetIndex === -1) {
          // No incomplete tasks found, return unchanged
          return;
        }
      }

      // Validate index bounds
      if (targetIndex < 0 || targetIndex >= taskList.length) {
        return;
      }

      const newTaskList = [...taskList];
      const currentTask = newTaskList[targetIndex];
      if (currentTask) {
        newTaskList[targetIndex] = {
          ...currentTask,
          completed: !currentTask.completed,
        };
      }
      workflowState = {
        ...workflowState,
        taskList: newTaskList,
      };
    };

    // Should toggle Task 2 (first incomplete task)
    toggleTask();
    expect(workflowState.taskList).toEqual([
      { completed: true, label: "Task 1" },
      { completed: true, label: "Task 2" },
      { completed: false, label: "Task 3" },
    ]);

    // Should toggle Task 3 (next incomplete task)
    toggleTask();
    expect(workflowState.taskList).toEqual([
      { completed: true, label: "Task 1" },
      { completed: true, label: "Task 2" },
      { completed: true, label: "Task 3" },
    ]);

    // Should do nothing when all tasks are completed
    const originalTaskList = workflowState.taskList
      ? [...workflowState.taskList]
      : [];
    toggleTask();
    expect(workflowState.taskList).toEqual(originalTaskList);
  });

  it("toggleTask should handle edge cases gracefully", () => {
    let workflowState: WorkflowState = {
      loading: false,
      messages: [],
      inputDisabled: false,
      taskList: [{ completed: false, label: "Task 1" }],
    };

    const toggleTask = (index?: number) => {
      const taskList = workflowState.taskList || [];

      let targetIndex = index;

      // If no index provided, find the next incomplete task
      if (targetIndex === undefined) {
        targetIndex = taskList.findIndex((task) => !task.completed);
        if (targetIndex === -1) {
          // No incomplete tasks found, return unchanged
          return;
        }
      }

      // Validate index bounds
      if (targetIndex < 0 || targetIndex >= taskList.length) {
        return;
      }

      const newTaskList = [...taskList];
      const currentTask = newTaskList[targetIndex];
      if (currentTask) {
        newTaskList[targetIndex] = {
          ...currentTask,
          completed: !currentTask.completed,
        };
      }
      workflowState = {
        ...workflowState,
        taskList: newTaskList,
      };
    };

    const originalTaskList = workflowState.taskList
      ? [...workflowState.taskList]
      : [];

    // Test invalid indices
    toggleTask(-1);
    expect(workflowState.taskList).toEqual(originalTaskList);

    toggleTask(999);
    expect(workflowState.taskList).toEqual(originalTaskList);

    // Test empty task list
    workflowState.taskList = [];
    toggleTask();
    expect(workflowState.taskList).toEqual([]);

    toggleTask(0);
    expect(workflowState.taskList).toEqual([]);
  });

  it("clearTaskList should clear the entire task list", () => {
    let workflowState: WorkflowState = {
      loading: false,
      messages: [],
      inputDisabled: false,
      taskList: [
        { completed: false, label: "Task 1" },
        { completed: true, label: "Task 2" },
        { completed: false, label: "Task 3" },
      ],
    };

    const clearTaskList = () => {
      workflowState = {
        ...workflowState,
        taskList: [],
      };
    };

    clearTaskList();
    expect(workflowState.taskList).toEqual([]);
  });

  it("should handle undefined taskList gracefully", () => {
    let workflowState: WorkflowState = {
      loading: false,
      messages: [],
      inputDisabled: false,
      // taskList is undefined
    };

    const addTask = (task: string | TaskItem | Array<string | TaskItem>) => {
      const tasks = Array.isArray(task) ? task : [task];
      const taskItems: Array<TaskItem> = tasks.map((t) => {
        if (typeof t === "string") {
          return { completed: false, label: t };
        } else {
          return { completed: t.completed, label: t.label };
        }
      });
      workflowState = {
        ...workflowState,
        taskList: [...(workflowState.taskList || []), ...taskItems],
      };
    };

    const toggleTask = (index?: number) => {
      const taskList = workflowState.taskList || [];

      let targetIndex = index;

      // If no index provided, find the next incomplete task
      if (targetIndex === undefined) {
        targetIndex = taskList.findIndex((task) => !task.completed);
        if (targetIndex === -1) {
          // No incomplete tasks found, return unchanged
          return;
        }
      }

      // Validate index bounds
      if (targetIndex < 0 || targetIndex >= taskList.length) {
        return;
      }

      const newTaskList = [...taskList];
      const currentTask = newTaskList[targetIndex];
      if (currentTask) {
        newTaskList[targetIndex] = {
          ...currentTask,
          completed: !currentTask.completed,
        };
      }
      workflowState = {
        ...workflowState,
        taskList: newTaskList,
      };
    };

    // Adding to undefined taskList should work
    addTask("First task");
    expect(workflowState.taskList).toEqual([
      { completed: false, label: "First task" },
    ]);

    // Toggling on undefined should do nothing
    workflowState.taskList = undefined;
    toggleTask();
    expect(workflowState.taskList).toBeUndefined();
  });
});
