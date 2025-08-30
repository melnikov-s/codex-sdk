import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { styles } from "./theme";
export function SelectOption({ isFocused, isSelected, isLoading, children }) {
  return React.createElement(
    Box,
    { ...styles.option({ isFocused }) },
    React.createElement(
      Box,
      { width: 2 },
      isFocused &&
        React.createElement(
          Text,
          { ...styles.focusIndicator() },
          figures.pointer,
        ),
    ),
    React.createElement(
      Text,
      { ...styles.label({ isFocused, isSelected, isLoading }) },
      children,
    ),
    isSelected &&
      React.createElement(
        Text,
        { ...styles.selectedIndicator() },
        figures.tick,
      ),
  );
}
