import TextCompletions from "./chat/terminal-chat-completions.js";
import TextInput from "./vendor/ink-text-input.js";
import { useFileSystemSuggestions } from "../hooks/use-file-system-suggestions.js";
import { Box, useInput } from "ink";
import React, { useEffect } from "react";

interface FilePathInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  focus?: boolean;
  showCursor?: boolean;
}

export function FilePathInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  focus = true,
  showCursor = true,
}: FilePathInputProps) {
  const {
    fsSuggestions,
    selectedCompletion,
    updateFsSuggestions,
    getFileSystemSuggestion,
    setSelectedCompletion,
    clearSuggestions,
  } = useFileSystemSuggestions();

  useEffect(() => {
    updateFsSuggestions(value);
  }, [value, updateFsSuggestions]);

  useInput(
    (_input, key) => {
      if (!focus) {
        return;
      }

      // Handle tab key for autocompletion
      if (key.tab) {
        // If no suggestions visible, trigger them
        if (fsSuggestions.length === 0) {
          updateFsSuggestions(value, true);
        } else if (selectedCompletion >= 0) {
          // Apply the selected suggestion
          const {
            text: newText,
            suggestion,
            wasReplaced,
          } = getFileSystemSuggestion(value);

          if (wasReplaced) {
            onChange(newText);
            if (suggestion?.isDirectory) {
              // Keep suggestions active for directories
              setTimeout(() => updateFsSuggestions(newText, true), 0);
            } else {
              // Clear suggestions for files
              clearSuggestions();
            }
          }
        }
        return; // Always return to prevent tab from being inserted as text
      }

      // Clear suggestions on escape
      if (key.escape && fsSuggestions.length > 0) {
        clearSuggestions();
        return;
      }

      if (fsSuggestions.length > 0) {
        if (key.upArrow) {
          setSelectedCompletion((prev) =>
            prev <= 0 ? fsSuggestions.length - 1 : prev - 1,
          );
          return;
        }

        if (key.downArrow) {
          setSelectedCompletion((prev) =>
            prev >= fsSuggestions.length - 1 ? 0 : prev + 1,
          );
          return;
        }
      }

      if (key.return) {
        const { text: replacedText } = getFileSystemSuggestion(value);
        onSubmit(replacedText);
        return;
      }
    },
    { isActive: focus },
  );

  const handleChange = (newValue: string) => {
    onChange(newValue);
  };

  return (
    <Box flexDirection="column">
      <TextInput
        value={value}
        onChange={handleChange}
        onSubmit={onSubmit}
        placeholder={placeholder}
        showCursor={showCursor}
        focus={focus}
      />
      {fsSuggestions.length > 0 && (
        <Box marginTop={1}>
          <TextCompletions
            completions={fsSuggestions.map((suggestion) => suggestion.path)}
            selectedCompletion={selectedCompletion}
            displayLimit={5}
          />
        </Box>
      )}
    </Box>
  );
}
