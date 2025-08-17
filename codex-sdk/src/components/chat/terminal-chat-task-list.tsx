import type { TaskItem } from "../../workflow/index.js";

import { Box, Text } from "ink";
import React from "react";

interface TerminalChatTaskListProps {
  taskList: Array<TaskItem>;
}

export default function TerminalChatTaskList({
  taskList,
}: TerminalChatTaskListProps): React.ReactElement | null {
  if (taskList.length === 0) {
    return null;
  }

  // Find the first incomplete task (current task)
  const currentTaskIndex = taskList.findIndex((task) => !task.completed);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box borderStyle="round" paddingX={1} paddingY={0}>
        <Box flexDirection="column">
          <Text bold color="cyan">
            Tasks ({taskList.length})
          </Text>
          {taskList.map((task, index) => {
            const isCurrent = index === currentTaskIndex;
            const isCompleted = task.completed;

            if (isCurrent) {
              // Current task - highlight with bright color and special indicator
              return (
                <Text key={index} bold color="white">
                  → {task.label}
                </Text>
              );
            } else if (isCompleted) {
              // Completed task - green with checkmark
              return (
                <Text key={index} color="green">
                  ✓ {task.label}
                </Text>
              );
            } else {
              // Future pending task - dimmed
              return (
                <Text key={index} color="gray" dimColor>
                  • {task.label}
                </Text>
              );
            }
          })}
        </Box>
      </Box>
    </Box>
  );
}
