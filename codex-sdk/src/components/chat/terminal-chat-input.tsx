import type { MultilineTextEditorHandle } from "./multiline-editor";
import type { ReviewDecision } from "../../utils/agent/review.js";
import type { UIMessage } from "../../utils/ai";
import type { HistoryEntry } from "../../utils/storage/command-history.js";
import type { Workflow, TaskItem } from "../../workflow";
import type { ModelMessage } from "ai";

import MultilineTextEditor from "./multiline-editor";
import { TerminalChatCommandReview } from "./terminal-chat-command-review.js";
import TextCompletions from "./terminal-chat-completions.js";
import TerminalChatQueue from "./terminal-chat-queue.js";
import TerminalChatTaskList from "./terminal-chat-task-list.js";
import { useFileSystemSuggestions } from "../../hooks/use-file-system-suggestions.js";
import { loadConfig } from "../../utils/config.js";
import { processFileTokens } from "../../utils/file-tag-utils";
import { createInputItem } from "../../utils/input-utils.js";
import { log } from "../../utils/logger/log.js";
import {
  getAllAvailableCommands,
  type SlashCommand,
} from "../../utils/slash-commands.js";
import {
  loadCommandHistory,
  addToHistory,
} from "../../utils/storage/command-history.js";
import { onExit } from "../../utils/terminal.js";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import React, { useCallback, useState, useEffect, useRef } from "react";
import { useInterval } from "use-interval";

export default function TerminalChatInput({
  loading,
  queue,
  taskList,
  submitInput,
  confirmationPrompt,
  explanation,
  submitConfirmation,
  setItems,
  openOverlay,
  openApprovalOverlay,
  openHelpOverlay,
  interruptAgent,
  active,
  statusLine,
  workflowStatusLine,
  workflow,
  inputDisabled,
  inputSetterRef,
  openWorkflowPicker,
  createNewWorkflow,
}: {
  loading: boolean;
  queue: Array<string>;
  taskList?: Array<TaskItem>;
  submitInput: (input: ModelMessage) => void;
  confirmationPrompt: React.ReactNode | null;
  explanation?: string;
  submitConfirmation: (
    decision: ReviewDecision,
    customDenyMessage?: string,
  ) => void;
  setItems: React.Dispatch<React.SetStateAction<Array<UIMessage>>>;
  openOverlay: () => void;
  openApprovalOverlay: () => void;
  openHelpOverlay: () => void;

  interruptAgent: () => void;
  active: boolean;
  statusLine?: string;
  workflowStatusLine?: React.ReactNode;
  workflow?: Workflow | null;
  inputDisabled?: boolean;
  inputSetterRef?: React.MutableRefObject<
    ((value: string) => void) | undefined
  >;
  openWorkflowPicker?: () => void;
  createNewWorkflow?: () => void;
}): React.ReactElement {
  const app = useApp();
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Array<HistoryEntry>>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draftInput, setDraftInput] = useState<string>("");
  const [skipNextSubmit, setSkipNextSubmit] = useState<boolean>(false);
  const {
    fsSuggestions,
    selectedCompletion,
    updateFsSuggestions,
    getFileSystemSuggestion,
    setSelectedCompletion,
    clearSuggestions,
  } = useFileSystemSuggestions();
  const [selectedSlashSuggestion, setSelectedSlashSuggestion] =
    useState<number>(0);
  // Multiline text editor key to force remount after submission
  const [editorState, setEditorState] = useState<{
    key: number;
    initialCursorOffset?: number;
  }>({ key: 0 });
  // Imperative handle from the multiline editor so we can query caret position
  const editorRef = useRef<MultilineTextEditorHandle | null>(null);
  // Track the caret row across keystrokes
  const prevCursorRow = useRef<number | null>(null);
  const prevCursorWasAtLastRow = useRef<boolean>(false);

  // Get all available commands (UI + workflow commands)
  // Note: Don't memoize this since disabled functions need to be evaluated with current state
  const availableCommands = getAllAvailableCommands(workflow?.commands || {});

  // --- Helper for updating input, remounting editor, and moving cursor to end ---
  const applyFsSuggestion = useCallback((newInputText: string) => {
    setInput(newInputText);
    setDraftInput(newInputText);
    setEditorState((s) => ({
      key: s.key + 1,
      initialCursorOffset: newInputText.length,
    }));
  }, []);

  // Expose an imperative setter to the workflow via ref
  useEffect(() => {
    if (!inputSetterRef) {
      return;
    }
    inputSetterRef.current = (value: string) => {
      applyFsSuggestion(value);
    };
    return () => {
      if (inputSetterRef) {
        inputSetterRef.current = undefined;
      }
    };
  }, [inputSetterRef, applyFsSuggestion]);

  // Load command history on component mount
  useEffect(() => {
    async function loadHistory() {
      const historyEntries = await loadCommandHistory();
      setHistory(historyEntries);
    }

    loadHistory();
  }, []);
  // Reset slash suggestion index when input prefix changes
  useEffect(() => {
    if (input.trim().startsWith("/")) {
      setSelectedSlashSuggestion(0);
    }
  }, [input]);

  useInput(
    (_input, _key) => {
      if (
        (_key.ctrl && (_input === "[" || _input === "]")) ||
        _input === "\u001b" ||
        _input === "\u001d"
      ) {
        return;
      }
      // Slash command navigation: up/down to select, enter to fill
      if (!confirmationPrompt && input.trim().startsWith("/")) {
        const prefix = input.trim();
        const matches = availableCommands.filter((cmd: SlashCommand) =>
          cmd.command.startsWith(prefix),
        );
        if (matches.length > 0) {
          if (_key.tab) {
            // Cycle and fill slash command suggestions on Tab
            const len = matches.length;
            // Determine new index based on shift state
            const nextIdx = _key.shift
              ? selectedSlashSuggestion <= 0
                ? len - 1
                : selectedSlashSuggestion - 1
              : selectedSlashSuggestion >= len - 1
                ? 0
                : selectedSlashSuggestion + 1;
            setSelectedSlashSuggestion(nextIdx);
            // Autocomplete the command in the input
            const match = matches[nextIdx];
            if (!match) {
              return;
            }
            const cmd = match.command;
            setInput(cmd);
            setDraftInput(cmd);
            return;
          }
          if (_key.upArrow) {
            setSelectedSlashSuggestion((prev) =>
              prev <= 0 ? matches.length - 1 : prev - 1,
            );
            return;
          }
          if (_key.downArrow) {
            setSelectedSlashSuggestion((prev) =>
              prev < 0 || prev >= matches.length - 1 ? 0 : prev + 1,
            );
            return;
          }
          if (_key.return) {
            // Execute the currently selected slash command
            const selIdx = selectedSlashSuggestion;
            const cmdObj = matches[selIdx];
            if (cmdObj) {
              const cmd = cmdObj.command;
              setInput("");
              setDraftInput("");
              setSelectedSlashSuggestion(0);

              // Handle UI commands
              if (cmdObj.source === "ui") {
                switch (cmd) {
                  case "/history":
                    openOverlay();
                    break;
                  case "/help":
                    openHelpOverlay();
                    break;
                  case "/approval":
                    openApprovalOverlay();
                    break;
                  case "/switch":
                    openWorkflowPicker?.();
                    break;
                  case "/new":
                    createNewWorkflow?.();
                    break;

                  case "/clearhistory":
                    onSubmit(cmd);
                    break;
                  default:
                    break;
                }
              } else if (cmdObj.source === "workflow") {
                // Handle workflow commands
                const commandName = cmd.slice(1); // Remove the "/" prefix
                const workflowCommands = workflow?.commands;
                if (workflowCommands?.[commandName]) {
                  try {
                    // Execute the command (might be sync or async)
                    const result = workflowCommands[commandName].handler();
                    // If it's a promise, handle errors
                    if (result && typeof result.then === "function") {
                      result.catch((error: Error) => {
                        log(
                          `Error executing workflow command ${cmd}: ${error.message}`,
                        );
                      });
                    }
                  } catch (error) {
                    // Handle synchronous errors
                    log(
                      `Error executing workflow command ${cmd}: ${(error as Error).message}`,
                    );
                  }
                }
              }
            }
            return;
          }
        }
      }
      if (!confirmationPrompt) {
        if (fsSuggestions.length > 0) {
          if (_key.upArrow) {
            setSelectedCompletion((prev) =>
              prev <= 0 ? fsSuggestions.length - 1 : prev - 1,
            );
            return;
          }

          if (_key.downArrow) {
            setSelectedCompletion((prev) =>
              prev >= fsSuggestions.length - 1 ? 0 : prev + 1,
            );
            return;
          }

          if (_key.tab) {
            const { text: newText, wasReplaced } =
              getFileSystemSuggestion(input);

            // Only proceed if the text was actually changed
            if (wasReplaced) {
              applyFsSuggestion(newText);
              clearSuggestions();
              return;
            } else if (selectedCompletion >= 0) {
              // If we have suggestions but completion didn't work, still consume the tab
              return;
            }
          }
        }

        if (_key.upArrow) {
          let moveThroughHistory = true;

          // Only use history when the caret was *already* on the very first
          // row *before* this key-press.
          const cursorRow = editorRef.current?.getRow?.() ?? 0;
          const cursorCol = editorRef.current?.getCol?.() ?? 0;
          const wasAtFirstRow = (prevCursorRow.current ?? cursorRow) === 0;
          if (!(cursorRow === 0 && wasAtFirstRow)) {
            moveThroughHistory = false;
          }

          // If we are not yet in history mode, then also require that the col is zero so that
          // we only trigger history navigation when the user is at the start of the input.
          if (historyIndex == null && !(cursorRow === 0 && cursorCol === 0)) {
            moveThroughHistory = false;
          }

          // Move through history.
          if (history.length && moveThroughHistory) {
            let newIndex: number;
            if (historyIndex == null) {
              const currentDraft = editorRef.current?.getText?.() ?? input;
              setDraftInput(currentDraft);
              newIndex = history.length - 1;
            } else {
              newIndex = Math.max(0, historyIndex - 1);
            }
            setHistoryIndex(newIndex);

            setInput(history[newIndex]?.command ?? "");
            // Re-mount the editor so it picks up the new initialText
            setEditorState((s) => ({ key: s.key + 1 }));
            return; // handled
          }

          // Otherwise let it propagate.
        }

        if (_key.downArrow) {
          // Only move forward in history when we're already *in* history mode
          // AND the caret sits on the last line of the buffer.
          const wasAtLastRow =
            prevCursorWasAtLastRow.current ??
            editorRef.current?.isCursorAtLastRow() ??
            true;
          if (historyIndex != null && wasAtLastRow) {
            const newIndex = historyIndex + 1;
            if (newIndex >= history.length) {
              setHistoryIndex(null);
              setInput(draftInput);
              setEditorState((s) => ({ key: s.key + 1 }));
            } else {
              setHistoryIndex(newIndex);
              setInput(history[newIndex]?.command ?? "");
              setEditorState((s) => ({ key: s.key + 1 }));
            }
            return; // handled
          }
          // Otherwise let it propagate
        }

        // Defer filesystem suggestion logic to onSubmit if enter key is pressed
        if (!_key.return) {
          // Pressing tab should trigger the file system suggestions
          const shouldUpdateSelection = _key.tab;
          const targetInput = _key.delete ? input.slice(0, -1) : input + _input;
          updateFsSuggestions(targetInput, shouldUpdateSelection);
        }
      }

      // Update the cached cursor position *after* **all** handlers (including
      // the internal <MultilineTextEditor>) have processed this key event.
      //
      // Ink invokes `useInput` callbacks starting with **parent** components
      // first, followed by their descendants. As a result the call above
      // executes *before* the editor has had a chance to react to the key
      // press and update its internal caret position.  When navigating
      // through a multi-line draft with the ↑ / ↓ arrow keys this meant we
      // recorded the *old* cursor row instead of the one that results *after*
      // the key press.  Consequently, a subsequent ↑ still saw
      // `prevCursorRow = 1` even though the caret was already on row 0 and
      // history-navigation never kicked in.
      //
      // Defer the sampling by one tick so we read the *final* caret position
      // for this frame.
      setTimeout(() => {
        prevCursorRow.current = editorRef.current?.getRow?.() ?? null;
        prevCursorWasAtLastRow.current =
          editorRef.current?.isCursorAtLastRow?.() ?? true;
      }, 1);

      if (_input === "\u0003" || (_input === "c" && _key.ctrl)) {
        setTimeout(() => {
          app.exit();
          onExit();
          process.exit(0);
        }, 60);
      }
    },
    { isActive: active },
  );

  const onSubmit = useCallback(
    async (value: string) => {
      const inputValue = value.trim();

      // If the user only entered a slash, do not send a chat message.
      if (inputValue === "/") {
        setInput("");
        return;
      }

      // Skip this submit if we just autocompleted a slash command.
      if (skipNextSubmit) {
        setSkipNextSubmit(false);
        return;
      }

      if (!inputValue) {
        return;
      } else if (inputValue === "/history") {
        setInput("");
        openOverlay();
        return;
      } else if (inputValue === "/help") {
        setInput("");
        openHelpOverlay();
        return;
      } else if (inputValue.startsWith("/approval")) {
        setInput("");
        openApprovalOverlay();
        return;
      } else if (inputValue === "/switch") {
        setInput("");
        openWorkflowPicker?.();
        return;
      } else if (inputValue === "/new") {
        setInput("");
        createNewWorkflow?.();
        return;
      } else if (["exit", "q", ":q"].includes(inputValue)) {
        setInput("");
        setTimeout(() => {
          app.exit();
          onExit();
          process.exit(0);
        }, 60); // Wait one frame.
        return;
      } else if (inputValue === "/clearhistory") {
        setInput("");

        // Import clearCommandHistory function to avoid circular dependencies
        // Using dynamic import to lazy-load the function
        import("../../utils/storage/command-history.js").then(
          async ({ clearCommandHistory }) => {
            await clearCommandHistory();
            setHistory([]);

            // Emit a system message to confirm the history clear action.
            setItems((prev) => [
              ...prev,
              {
                id: `clearhistory-${Date.now()}`,
                role: "system",
                content: "Command history cleared",
                parts: [{ type: "text", text: "Command history cleared" }],
              },
            ]);
          },
        );

        return;
      } else if (inputValue.startsWith("/")) {
        const trimmed = inputValue.trim();

        // Check if it's a workflow command first
        if (workflow?.commands) {
          const parts = trimmed.slice(1).split(/\s+/); // Remove "/" and split by whitespace
          const commandName = parts[0];
          const args = parts.slice(1).join(" "); // Rest of the input as arguments

          if (commandName && workflow.commands[commandName]) {
            setInput("");
            try {
              const result = workflow.commands[commandName].handler(
                args || undefined,
              );
              if (result && typeof result.then === "function") {
                result.catch((error: Error) => {
                  log(
                    `Error executing workflow command ${trimmed}: ${error.message}`,
                  );
                  setItems((prev) => [
                    ...prev,
                    {
                      id: `workflowcommand-error-${Date.now()}`,
                      role: "system",
                      content: `Error executing command "${trimmed}": ${error.message}`,
                      parts: [
                        {
                          type: "text",
                          text: `Error executing command "${trimmed}": ${error.message}`,
                        },
                      ],
                    },
                  ]);
                });
              }
            } catch (error) {
              log(
                `Error executing workflow command ${trimmed}: ${(error as Error).message}`,
              );
              setItems((prev) => [
                ...prev,
                {
                  id: `workflowcommand-error-${Date.now()}`,
                  role: "system",
                  content: `Error executing command "${trimmed}": ${(error as Error).message}`,
                  parts: [
                    {
                      type: "text",
                      text: `Error executing command "${trimmed}": ${(error as Error).message}`,
                    },
                  ],
                },
              ]);
            }
            return;
          }
        }

        if (/^\/\S+$/.test(trimmed)) {
          setInput("");
          setItems((prev) => [
            ...prev,
            {
              id: `invalidcommand-${Date.now()}`,
              role: "system",
              content: `Invalid command "${trimmed}". Use /help to retrieve the list of commands.`,
              parts: [
                {
                  type: "text",
                  text: `Invalid command "${trimmed}". Use /help to retrieve the list of commands.`,
                },
              ],
            },
          ]);

          return;
        }
      }

      // Process @file tokens (handles both text and binary files)
      const { text: processedText, attachments } =
        await processFileTokens(inputValue);

      const inputItem = await createInputItem(processedText, [], attachments);
      submitInput(inputItem);

      // Get config for history persistence.
      const config = loadConfig();

      // Add to history and update state.
      const updatedHistory = await addToHistory(value, history, {
        maxSize: config.history?.maxSize ?? 1000,
        saveHistory: config.history?.saveHistory ?? true,
        sensitivePatterns: config.history?.sensitivePatterns ?? [],
      });

      setHistory(updatedHistory);
      setHistoryIndex(null);
      setDraftInput("");
      setSelectedCompletion(-1);
      setInput("");
      clearSuggestions();
    },
    [
      setInput,
      submitInput,
      setItems,
      app,
      setHistory,
      setHistoryIndex,
      openOverlay,
      openApprovalOverlay,
      openHelpOverlay,
      openWorkflowPicker,
      createNewWorkflow,
      history,
      skipNextSubmit,
      workflow,
      clearSuggestions,
      setSelectedCompletion,
    ],
  );

  if (confirmationPrompt) {
    return (
      <TerminalChatCommandReview
        confirmationPrompt={confirmationPrompt}
        onReviewCommand={submitConfirmation}
        // allow switching approval mode via 'v'
        onSwitchApprovalMode={openApprovalOverlay}
        explanation={explanation}
        // disable when input is inactive (e.g., overlay open)
        isActive={active}
      />
    );
  }

  return (
    <Box flexDirection="column">
      <TerminalChatTaskList taskList={taskList || []} />
      <TerminalChatQueue queue={queue} />
      {loading && (
        <Box marginTop={1} marginBottom={0}>
          <TerminalChatInputThinking
            onInterrupt={interruptAgent}
            active={active}
          />
        </Box>
      )}
      {workflowStatusLine && (
        <Box marginTop={1} marginBottom={0}>
          {workflowStatusLine}
        </Box>
      )}
      <Box borderStyle="round">
        <Box paddingX={1}>
          <MultilineTextEditor
            ref={editorRef}
            onChange={(txt: string) => {
              setDraftInput(txt);
              if (historyIndex != null) {
                setHistoryIndex(null);
              }
              setInput(txt);
              // Always update selection when @ is present to ensure selectedCompletion is set
              const hasAtSymbol = txt.includes("@");
              updateFsSuggestions(txt, hasAtSymbol);
            }}
            key={editorState.key}
            initialCursorOffset={editorState.initialCursorOffset}
            initialText={input}
            height={6}
            focus={active}
            onSubmit={(txt) => {
              // If final token is an @path, replace with filesystem suggestion if available
              const {
                text: replacedText,
                suggestion,
                wasReplaced,
              } = getFileSystemSuggestion(txt, true);

              // If we replaced @path token with a directory, don't submit
              if (wasReplaced && suggestion?.isDirectory) {
                applyFsSuggestion(replacedText);
                // Update suggestions for the new directory
                updateFsSuggestions(replacedText, true);
                return;
              }

              onSubmit(replacedText);
              setEditorState((s) => ({ key: s.key + 1 }));
              setInput("");
              setHistoryIndex(null);
              setDraftInput("");
            }}
          />
        </Box>
      </Box>
      {/* Slash command autocomplete suggestions */}
      {input.trim().startsWith("/") && (
        <Box flexDirection="column" paddingX={2} marginBottom={1}>
          {availableCommands
            .filter((cmd: SlashCommand) => cmd.command.startsWith(input.trim()))
            .map((cmd: SlashCommand, idx: number) => (
              <Box key={cmd.command}>
                <Text
                  backgroundColor={
                    idx === selectedSlashSuggestion ? "blackBright" : undefined
                  }
                >
                  <Text color="blue">{cmd.command}</Text>
                  <Text> {cmd.description}</Text>
                </Text>
              </Box>
            ))}
        </Box>
      )}
      <Box paddingX={2} marginBottom={1}>
        {fsSuggestions.length > 0 ? (
          <TextCompletions
            completions={fsSuggestions.map((suggestion) => suggestion.path)}
            selectedCompletion={selectedCompletion}
            displayLimit={5}
          />
        ) : (
          <Text dimColor>
            ctrl+c to exit | "/" to see commands
            {inputDisabled && (
              <>
                {" | "}
                <Text color="red">Input disabled</Text>
              </>
            )}
            {statusLine && (
              <>
                {" — "}
                <Text>{statusLine}</Text>
              </>
            )}
          </Text>
        )}
      </Box>
    </Box>
  );
}

function TerminalChatInputThinking({
  onInterrupt,
  active,
}: {
  onInterrupt: () => void;
  active: boolean;
}) {
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [dots, setDots] = useState("");
  const [thinkingSeconds, setThinkingSeconds] = useState(0);

  // Animate ellipsis
  useInterval(() => {
    setDots((prev) => (prev.length < 3 ? prev + "." : ""));
  }, 500);

  // Timer for thinking seconds
  useInterval(() => {
    setThinkingSeconds((prev) => prev + 1);
  }, 1000);

  // Spinner frames with embedded seconds
  const ballFrames = [
    "( ●    )",
    "(  ●   )",
    "(   ●  )",
    "(    ● )",
    "(     ●)",
    "(    ● )",
    "(   ●  )",
    "(  ●   )",
    "( ●    )",
    "(●     )",
  ];
  const [frame, setFrame] = useState(0);

  useInterval(() => {
    setFrame((idx) => (idx + 1) % ballFrames.length);
  }, 80);

  // Keep the elapsed‑seconds text fixed while the ball animation moves.
  const frameTemplate = ballFrames[frame] ?? ballFrames[0];
  const frameWithSeconds = `${frameTemplate} ${thinkingSeconds}s`;

  // ---------------------------------------------------------------------
  // Raw stdin listener to catch the case where the terminal delivers two
  // consecutive ESC bytes ("\x1B\x1B") in a *single* chunk. Ink's `useInput`
  // collapses that sequence into one key event, so the regular two‑step
  // handler above never sees the second press.  By inspecting the raw data
  // we can identify this special case and trigger the interrupt while still
  // requiring a double press for the normal single‑byte ESC events.
  // ---------------------------------------------------------------------

  const { stdin, setRawMode } = useStdin();

  useEffect(() => {
    if (!active) {
      return;
    }

    // Ensure raw mode – already enabled by Ink when the component has focus,
    // but called defensively in case that assumption ever changes.
    setRawMode?.(true);

    const onData = (data: Buffer | string) => {
      if (awaitingConfirm) {
        return; // already awaiting a second explicit press
      }

      // Handle both Buffer and string forms.
      const str = Buffer.isBuffer(data) ? data.toString("utf8") : data;
      if (str === "\x1b\x1b") {
        // Treat as the first Escape press – prompt the user for confirmation.
        log(
          "raw stdin: received collapsed ESC ESC – starting confirmation timer",
        );
        setAwaitingConfirm(true);
        setTimeout(() => setAwaitingConfirm(false), 1500);
      }
    };

    stdin?.on("data", onData);

    return () => {
      stdin?.off("data", onData);
    };
  }, [stdin, awaitingConfirm, onInterrupt, active, setRawMode]);

  // No local timer: the parent component supplies the elapsed time via props.

  // Listen for the escape key to allow the user to interrupt the current
  // operation. We require two presses within a short window (1.5s) to avoid
  // accidental cancellations.
  useInput(
    (_input, key) => {
      if (!key.escape) {
        return;
      }

      if (awaitingConfirm) {
        log("useInput: second ESC detected – triggering onInterrupt()");
        onInterrupt();
        setAwaitingConfirm(false);
      } else {
        log("useInput: first ESC detected – waiting for confirmation");
        setAwaitingConfirm(true);
        setTimeout(() => setAwaitingConfirm(false), 1500);
      }
    },
    { isActive: active },
  );

  return (
    <Box width="100%" flexDirection="column" gap={1}>
      <Box
        flexDirection="row"
        width="100%"
        justifyContent="space-between"
        paddingRight={1}
      >
        <Box gap={2}>
          <Text>{frameWithSeconds}</Text>
          <Text>
            Thinking
            {dots}
          </Text>
        </Box>
        <Text>
          <Text dimColor>press</Text> <Text bold>Esc</Text>{" "}
          {awaitingConfirm ? (
            <Text bold>again</Text>
          ) : (
            <Text dimColor>twice</Text>
          )}{" "}
          <Text dimColor>to interrupt</Text>
        </Text>
      </Box>
    </Box>
  );
}
