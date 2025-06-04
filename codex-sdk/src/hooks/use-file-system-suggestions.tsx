import type { FileSystemSuggestion } from "../utils/file-system-suggestions.js";

import { getFileSystemSuggestions } from "../utils/file-system-suggestions.js";
import { useState, useCallback } from "react";

interface UseFileSystemSuggestionsReturn {
  fsSuggestions: Array<FileSystemSuggestion>;
  selectedCompletion: number;
  updateFsSuggestions: (txt: string, alwaysUpdateSelection?: boolean) => void;
  getFileSystemSuggestion: (
    txt: string,
    requireAtPrefix?: boolean,
  ) => {
    text: string;
    suggestion: FileSystemSuggestion | null;
    wasReplaced: boolean;
  };
  setSelectedCompletion: React.Dispatch<React.SetStateAction<number>>;
  clearSuggestions: () => void;
}

export function useFileSystemSuggestions(): UseFileSystemSuggestionsReturn {
  const [fsSuggestions, setFsSuggestions] = useState<
    Array<FileSystemSuggestion>
  >([]);
  const [selectedCompletion, setSelectedCompletion] = useState<number>(-1);

  const updateFsSuggestions = useCallback(
    (txt: string, alwaysUpdateSelection: boolean = false) => {
      if (txt.endsWith(" ")) {
        setFsSuggestions([]);
        setSelectedCompletion(-1);
      } else {
        const words = txt.trim().split(/\s+/);
        const lastWord = words[words.length - 1] ?? "";

        const shouldUpdateSelection =
          lastWord.startsWith("@") || alwaysUpdateSelection;

        let pathPrefix: string;
        if (lastWord.startsWith("@")) {
          pathPrefix = lastWord.slice(1);
          pathPrefix = pathPrefix.length === 0 ? "./" : pathPrefix;
        } else {
          pathPrefix = lastWord;
        }

        if (shouldUpdateSelection) {
          const completions = getFileSystemSuggestions(pathPrefix);
          setFsSuggestions(completions);
          if (completions.length > 0) {
            setSelectedCompletion((prev) =>
              prev < 0 || prev >= completions.length ? 0 : prev,
            );
          } else {
            setSelectedCompletion(-1);
          }
        } else {
          setFsSuggestions((currentSuggestions) =>
            currentSuggestions.length > 0 ? [] : currentSuggestions,
          );
          setSelectedCompletion(-1);
        }
      }
    },
    [],
  );

  const getFileSystemSuggestion = useCallback(
    (
      txt: string,
      requireAtPrefix: boolean = false,
    ): {
      text: string;
      suggestion: FileSystemSuggestion | null;
      wasReplaced: boolean;
    } => {
      if (fsSuggestions.length === 0 || selectedCompletion < 0) {
        return { text: txt, suggestion: null, wasReplaced: false };
      }

      const words = txt.trim().split(/\s+/);
      const lastWord = words[words.length - 1] ?? "";

      if (requireAtPrefix && !lastWord.startsWith("@")) {
        return { text: txt, suggestion: null, wasReplaced: false };
      }

      const selected = fsSuggestions[selectedCompletion];
      if (!selected) {
        return { text: txt, suggestion: null, wasReplaced: false };
      }

      const replacement = lastWord.startsWith("@")
        ? `@${selected.path}`
        : selected.path;
      words[words.length - 1] = replacement;
      return {
        text: words.join(" "),
        suggestion: selected,
        wasReplaced: true,
      };
    },
    [fsSuggestions, selectedCompletion],
  );

  const clearSuggestions = useCallback(() => {
    setFsSuggestions([]);
    setSelectedCompletion(-1);
  }, []);

  return {
    fsSuggestions,
    selectedCompletion,
    updateFsSuggestions,
    getFileSystemSuggestion,
    setSelectedCompletion,
    clearSuggestions,
  };
}
