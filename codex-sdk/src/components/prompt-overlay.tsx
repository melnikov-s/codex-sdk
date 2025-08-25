import type { PromptOptions, PromptOptionsWithTimeout } from "../workflow";

import { CountdownTimer } from "./countdown-timer";
import { FilePathInput } from "./file-path-input.js";
import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

interface Props {
  message: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  options?: PromptOptions | PromptOptionsWithTimeout;
}

export default function PromptOverlay({
  message,
  onSubmit,
  onCancel,
  options,
}: Props) {
  const [value, setValue] = useState("");

  const isTimeoutOptions = (
    opts?: PromptOptions | PromptOptionsWithTimeout,
  ): opts is PromptOptionsWithTimeout => {
    return Boolean(
      opts &&
        typeof opts.timeout === "number" &&
        opts.timeout > 0 &&
        typeof opts.defaultValue === "string",
    );
  };

  const timeoutOptions = isTimeoutOptions(options) ? options : null;
  const [timeoutActive, setTimeoutActive] = useState(Boolean(timeoutOptions));

  const handleSubmit = (finalValue: string) => {
    setTimeoutActive(false);
    onSubmit(finalValue);
  };

  const handleTimeout = () => {
    if (timeoutOptions) {
      onSubmit(timeoutOptions.defaultValue);
    }
  };

  const cancelTimeout = () => {
    setTimeoutActive(false);
  };

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
    } else {
      cancelTimeout();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
    >
      <Text color="blue">{message}</Text>
      {timeoutActive && timeoutOptions && (
        <Box marginTop={1}>
          <CountdownTimer
            timeoutSeconds={timeoutOptions.timeout}
            onTimeout={handleTimeout}
            defaultLabel={timeoutOptions.defaultValue}
          />
        </Box>
      )}
      <Box marginTop={1}>
        <FilePathInput
          value={value}
          onChange={(newValue) => {
            cancelTimeout();
            setValue(newValue);
          }}
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
