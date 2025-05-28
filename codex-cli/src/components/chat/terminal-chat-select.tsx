import type { SelectItem, SelectOptions } from "../../workflow";

// @ts-expect-error select.js is JavaScript and has no types
import { Select } from "../vendor/ink-select/select";
import { Box, Text, useInput } from "ink";
import React from "react";

export function TerminalChatSelect({
  items,
  options,
  onSelect,
  onCancel,
  isActive = true,
}: {
  items: Array<SelectItem>;
  options?: SelectOptions;
  onSelect: (value: string) => void;
  onCancel: () => void;
  isActive?: boolean;
}): React.ReactElement {
  // Find the default item index if provided
  const defaultIndex = React.useMemo(() => {
    if (options?.default) {
      const index = items.findIndex((item) => item.value === options.default);
      return index >= 0 ? index : 0;
    }
    return 0;
  }, [items, options?.default]);

  // Memoize the select options to prevent unnecessary re-renders
  const selectOptions = React.useMemo(() => {
    return items.map((item) => ({
      label: item.label,
      value: item.value,
    }));
  }, [items]);

  useInput(
    (_input, key) => {
      if (key.return) {
        // Get the currently selected item (Select component handles this internally)
        // We'll rely on the Select component's onChange for the actual selection
        return;
      }

      if (key.escape) {
        if (options?.required) {
          // Don't allow escape if required
          return;
        }

        if (options?.default) {
          // Resolve with default if provided
          onSelect(options.default);
        } else {
          // Cancel/reject
          onCancel();
        }
      }
    },
    { isActive },
  );

  return (
    <Box flexDirection="column" gap={1} borderStyle="round" marginTop={1}>
      <Text bold>Select an option:</Text>
      <Box paddingX={2} flexDirection="column" gap={1}>
        <Select
          isDisabled={!isActive}
          visibleOptionCount={Math.min(selectOptions.length, 10)}
          initialIndex={defaultIndex}
          onChange={(value: string) => {
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
