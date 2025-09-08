import React from "react";
import { Box, Text } from "ink";
import { styles } from "./theme";
import { SelectOption as SelectOptionComponent } from "./select-option";
import { useSelectState } from "./use-select-state";
import { useSelect } from "./use-select";

export type SelectItem<T extends string = string> = {
  label: string;
  value: T;
  isLoading?: boolean;
};

export function Select<T extends string = string>({
  isDisabled = false,
  visibleOptionCount = 5,
  highlightText,
  options,
  defaultValue,
  onChange,
}: {
  isDisabled?: boolean;
  visibleOptionCount?: number;
  highlightText?: string;
  options: ReadonlyArray<SelectItem<T>>;
  defaultValue?: T;
  onChange?: (value: T) => void;
}): React.ReactElement {
  const state = useSelectState<T>({
    visibleOptionCount,
    options,
    defaultValue,
    onChange,
  });

  useSelect({ isDisabled, state });

  return React.createElement(
    Box,
    { ...styles.container() },
    state.visibleOptions.map((option) => {
      let label: React.ReactNode = option.label;
      if (highlightText && option.label.includes(highlightText)) {
        const index = option.label.indexOf(highlightText);
        label = React.createElement(
          React.Fragment,
          null,
          option.label.slice(0, index),
          React.createElement(
            Text,
            { ...styles.highlightedText() },
            highlightText,
          ),
          option.label.slice(index + highlightText.length),
        );
      }
      return React.createElement(SelectOptionComponent, {
        key: option.value,
        isFocused: !isDisabled && state.focusedValue === option.value,
        isSelected: state.value === option.value,
        isLoading: option.isLoading,
        children: label,
      });
    }),
  );
}
