import type {
  SelectItem,
  SelectOptions,
  SelectOptionsWithTimeout,
} from "../../workflow";

import { CountdownTimer } from "../countdown-timer";
import MultilineTextEditor from "./multiline-editor";
import { Select } from "../vendor/ink-select/select";
import { Box, Text, useInput } from "ink";
import React, { useState, useMemo } from "react";

export function TerminalChatSelect({
  items,
  options,
  onSelect,
  onCancel: _onCancel,
  isActive = true,
}: {
  items: Array<SelectItem & { isLoading?: boolean }>;
  options?: SelectOptions | SelectOptionsWithTimeout;
  onSelect: (value: string) => void;
  onCancel: () => void;
  isActive?: boolean;
}): React.ReactElement {
  const isTimeoutOptions = (
    opts?: SelectOptions | SelectOptionsWithTimeout,
  ): opts is SelectOptionsWithTimeout => {
    return Boolean(
      opts &&
        typeof opts.timeout === "number" &&
        opts.timeout > 0 &&
        typeof opts.defaultValue === "string" &&
        opts.defaultValue.length > 0,
    );
  };

  const timeoutOptions = isTimeoutOptions(options) ? options : null;
  const [timeoutActive, setTimeoutActive] = useState(Boolean(timeoutOptions));

  // Custom input state
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInputValue, setCustomInputValue] = useState("");

  const defaultIndex = useMemo(() => {
    const defaultValue = options?.defaultValue;
    if (defaultValue) {
      const index = items.findIndex((item) => item.value === defaultValue);
      return index >= 0 ? index : 0;
    }
    return 0;
  }, [items, options?.defaultValue]);

  const selectOptions = useMemo(() => {
    return items.map((item) => ({
      label: item.label,
      value: item.value,
      isLoading: item.isLoading,
    }));
  }, [items]);

  const cancelTimeout = () => {
    setTimeoutActive(false);
  };

  const handleTimeout = () => {
    if (timeoutOptions) {
      onSelect(timeoutOptions.defaultValue);
    }
  };

  const handleSelectionChange = (value: string) => {
    // This is always a real user selection - cancel timeout and proceed
    cancelTimeout();

    // Check if "None of the above" was selected
    if (value === "__CUSTOM_INPUT__") {
      setShowCustomInput(true);
      return;
    }

    onSelect(value);
  };

  const handleCustomInputSubmit = (text: string) => {
    if (text.trim()) {
      onSelect(text.trim());
    }
  };

  const handleCustomInputCancel = () => {
    setShowCustomInput(false);
    setCustomInputValue("");
    // When cancelling custom input, fall back to default if available
    const defaultValue = options?.defaultValue;
    if (defaultValue) {
      onSelect(defaultValue);
    } else {
      // If no default, resolve with empty string rather than rejecting
      onSelect("");
    }
  };

  useInput(
    (_input, key) => {
      // If in custom input mode, let the text editor handle input
      if (showCustomInput) {
        if (key.escape) {
          handleCustomInputCancel();
        }
        return;
      }

      if (key.escape) {
        if (options?.required) {
          return;
        }

        const defaultValue = options?.defaultValue;
        if (defaultValue) {
          onSelect(defaultValue);
        } else {
          // Resolve with empty string instead of calling onCancel
          onSelect("");
        }
        return;
      }

      // Only cancel timeout for meaningful navigation keys, not on any input
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
        cancelTimeout();
      }
    },
    { isActive },
  );

  // Render custom input mode
  if (showCustomInput) {
    return (
      <Box flexDirection="column" alignItems="flex-start" width="100%">
        <Box borderStyle="round" paddingX={1} paddingY={1} width="100%">
          <Box flexDirection="column" gap={1}>
            <Text bold>Enter your custom option:</Text>
            <Box borderStyle="single" paddingX={1}>
              <MultilineTextEditor
                initialText={customInputValue}
                height={3}
                focus={isActive}
                onChange={setCustomInputValue}
                onSubmit={handleCustomInputSubmit}
              />
            </Box>
          </Box>
        </Box>
        <Box marginTop={1} paddingLeft={1}>
          <Text dimColor>
            ↵ to submit • Shift+↵ for new line • esc to select default
          </Text>
        </Box>
        {timeoutActive && timeoutOptions && (
          <Box marginTop={1} paddingLeft={1}>
            <CountdownTimer
              timeoutSeconds={timeoutOptions.timeout}
              onTimeout={handleTimeout}
              defaultLabel={
                items.find((item) => item.value === timeoutOptions.defaultValue)
                  ?.label || timeoutOptions.defaultValue
              }
            />
          </Box>
        )}
      </Box>
    );
  }

  // Render normal selection mode
  return (
    <Box flexDirection="column" alignItems="flex-start" width="100%">
      <Box borderStyle="round" paddingX={1} paddingY={1} width="100%">
        <Box flexDirection="column" gap={1}>
          <Text bold>{options?.label || "Select an option:"}</Text>
          <Select
            isDisabled={!isActive}
            visibleOptionCount={Math.min(selectOptions.length, 10)}
            highlightText=""
            defaultValue={selectOptions[defaultIndex]?.value}
            onChange={handleSelectionChange}
            options={selectOptions}
          />
        </Box>
      </Box>
      <Box marginTop={1} paddingLeft={1}>
        <Text dimColor>
          {options?.required
            ? "↵ to select (escape disabled)"
            : (() => {
                const defaultValue = options?.defaultValue;
                if (defaultValue) {
                  // Find the label for the default value to match capitalization
                  const defaultItem = items.find(
                    (item) => item.value === defaultValue,
                  );
                  const displayValue = defaultItem
                    ? defaultItem.label
                    : defaultValue;
                  return `↵ to select • esc to select default (${displayValue})`;
                }
                return "↵ to select • esc to select (none)";
              })()}
        </Text>
      </Box>
      {timeoutActive && timeoutOptions && (
        <Box marginTop={1} paddingLeft={1}>
          <CountdownTimer
            timeoutSeconds={timeoutOptions.timeout}
            onTimeout={handleTimeout}
            defaultLabel={
              items.find((item) => item.value === timeoutOptions.defaultValue)
                ?.label || timeoutOptions.defaultValue
            }
          />
        </Box>
      )}
    </Box>
  );
}
