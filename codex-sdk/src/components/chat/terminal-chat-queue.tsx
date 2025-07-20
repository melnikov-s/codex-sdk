import { Box, Text } from "ink";
import React from "react";

interface TerminalChatQueueProps {
  queue: Array<string>;
}

export default function TerminalChatQueue({
  queue,
}: TerminalChatQueueProps): React.ReactElement | null {
  if (queue.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box borderStyle="round" paddingX={1} paddingY={0}>
        <Box flexDirection="column">
          <Text bold color="yellow">
            Queue ({queue.length})
          </Text>
          {queue.map((item, index) => (
            <Text key={index} color="gray">
              {index + 1}. {item}
            </Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
