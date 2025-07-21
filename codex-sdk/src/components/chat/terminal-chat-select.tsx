import type {
  SelectItem,
  SelectOptions,
  SelectOptionsWithTimeout,
} from "../../workflow";

import { CountdownTimer } from "../countdown-timer";
import { Select } from "../vendor/ink-select/select";
import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

export function TerminalChatSelect({
  items,
  options,
  onSelect,
  onCancel,
  isActive = true,
}: {
  items: Array<SelectItem>;
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
        typeof opts.defaultValue === "string",
    );
  };

  const timeoutOptions = isTimeoutOptions(options) ? options : null;
  const [timeoutActive, setTimeoutActive] = useState(Boolean(timeoutOptions));

  const defaultIndex = React.useMemo(() => {
    if (options?.default) {
      const index = items.findIndex((item) => item.value === options.default);
      return index >= 0 ? index : 0;
    }
    return 0;
  }, [items, options?.default]);

  const selectOptions = React.useMemo(() => {
    return items.map((item) => ({
      label: item.label,
      value: item.value,
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

  useInput(
    (_input, key) => {
      if (key.return) {
        return;
      }

      if (key.escape) {
        if (options?.required) {
          return;
        }

        if (options?.default) {
          onSelect(options.default);
        } else {
          onCancel();
        }
      }

      cancelTimeout();
    },
    { isActive },
  );

  return (
    <Box flexDirection="column" gap={1} borderStyle="round" marginTop={1}>
      <Text bold>{options?.label || "Select an option:"}</Text>
      {timeoutActive && timeoutOptions && (
        <Box paddingX={2}>
          <CountdownTimer
            timeoutSeconds={timeoutOptions.timeout}
            onTimeout={handleTimeout}
            onCancel={cancelTimeout}
          />
        </Box>
      )}
      <Box paddingX={2} flexDirection="column" gap={1}>
        <Select
          isDisabled={!isActive}
          visibleOptionCount={Math.min(selectOptions.length, 10)}
          highlightText=""
          defaultValue={selectOptions[defaultIndex]?.value}
          onChange={(value: string) => {
            cancelTimeout();
            onSelect(value);
          }}
          options={selectOptions}
        />
      </Box>
      <Box paddingX={2}>
        <Text dimColor>
          {options?.required
            ? "↵ to select (escape disabled)"
            : options?.default
              ? `↵ to select • esc for default (${options.default})`
              : "↵ to select • esc to cancel"}
        </Text>
      </Box>
    </Box>
  );
}
