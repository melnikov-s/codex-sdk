import TextInput from "./vendor/ink-text-input.js";
import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

interface Props {
  message: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export default function PromptOverlay({ message, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    onSubmit(value);
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
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="Type your response..."
          showCursor
          focus
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Enter to submit, Esc to cancel</Text>
      </Box>
    </Box>
  );
}
