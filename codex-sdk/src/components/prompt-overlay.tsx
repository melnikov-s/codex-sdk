import { FilePathInput } from "./file-path-input.js";
import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

interface Props {
  message: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export default function PromptOverlay({ message, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = (finalValue: string) => {
    onSubmit(finalValue);
  };

  // Handle escape key to cancel
  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
    >
      <Text color="cyan">{message}</Text>
      <Box marginTop={1}>
        <FilePathInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="Type your response..."
          showCursor
          focus
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Press Enter to submit, Esc to cancel, Tab to autocomplete paths
        </Text>
      </Box>
    </Box>
  );
}
