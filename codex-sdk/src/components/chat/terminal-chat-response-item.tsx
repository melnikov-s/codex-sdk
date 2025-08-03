import type { UIMessage } from "../../utils/ai";
import type { DisplayConfig, ThemeOptions } from "../../workflow/index";
import type { CoreAssistantMessage, CoreMessage, CoreToolMessage } from "ai";
import type { TerminalRendererOptions } from "marked-terminal";
import type { ExecOutputMetadata } from "src/utils/agent/sandbox/interface";

import { useTerminalSize } from "../../hooks/use-terminal-size";
import {
  getMessageType,
  getReasoning,
  getTextContent,
  getToolCall,
  getToolCallResult,
} from "../../utils/ai";
import { getDisplayMessageType } from "../../utils/display";
import { parseToolCall } from "../../utils/parsers";
import chalk, { type ForegroundColorName } from "chalk";
import { Box, Text } from "ink";
import { parse, setOptions } from "marked";
import TerminalRenderer from "marked-terminal";
import React, { useMemo } from "react";

export default function TerminalChatResponseItem({
  item,
  fullStdout = false,
  displayConfig,
}: {
  item: UIMessage;
  fullStdout?: boolean;
  displayConfig?: DisplayConfig;
}): React.ReactElement {
  switch (getMessageType(item)) {
    case "message":
    case "ui":
      return (
        <TerminalChatResponseMessage message={item} displayConfig={displayConfig} />
      );
    case "function_call":
      return (
        <TerminalChatResponseToolCall
          message={item as CoreMessage}
          displayConfig={displayConfig}
        />
      );
    case "function_call_output":
      return (
        <TerminalChatResponseToolCallOutput
          message={item as CoreToolMessage}
          fullStdout={fullStdout}
        />
      );
    case "mcp_call":
      return (
        <TerminalChatResponseMcpCall message={item as CoreAssistantMessage} />
      );
    case "mcp_output":
      return (
        <TerminalChatResponseMcpOutput message={item as CoreToolMessage} />
      );
    default:
      break;
  }

  if (getMessageType(item) === "reasoning") {
    return <TerminalChatResponseReasoning message={item} />;
  }

  return <TerminalChatResponseGenericMessage message={item} />;
}

// TODO: this should be part of `ResponseReasoningItem`. Also it doesn't work.
// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Guess how long the assistant spent "thinking" based on the combined length
 * of the reasoning summary. The calculation itself is fast, but wrapping it in
 * `useMemo` in the consuming component ensures it only runs when the
 * `summary` array actually changes.
 */
// TODO: use actual thinking time
//
// function guessThinkingTime(summary: Array<ResponseReasoningItem.Summary>) {
//   const totalTextLength = summary
//     .map((t) => t.text.length)
//     .reduce((a, b) => a + b, summary.length - 1);
//   return Math.max(1, Math.ceil(totalTextLength / 300));
// }

export function TerminalChatResponseReasoning({
  message,
}: {
  message: UIMessage & { duration_ms?: number };
}): React.ReactElement | null {
  const reasoning = getReasoning(message);

  if (!reasoning) {
    return null;
  }

  return (
    <Box gap={1} flexDirection="column">
      <Box flexDirection="column">
        <Markdown>{reasoning}</Markdown>
      </Box>
    </Box>
  );
}

// Helper function to resolve color from display config
function resolveColor(
  color: string | undefined,
  theme: ThemeOptions | undefined,
  fallback: ForegroundColorName = "gray"
): ForegroundColorName | string {
  if (!color) {
    return fallback;
  }
  
  // Check if it's a theme reference
  if (theme && color in theme) {
    return theme[color as keyof ThemeOptions] || fallback;
  }
  
  return color;
}

// Default colors for each message type
const defaultColors: Record<string, ForegroundColorName> = {
  assistant: "magentaBright",
  user: "blueBright", 
  toolCall: "cyan",
  toolResponse: "green",
  ui: "yellow",
};

function TerminalChatResponseMessage({
  message,
  displayConfig,
}: {
  message: UIMessage;
  displayConfig?: DisplayConfig;
}) {
  const messageType = getDisplayMessageType(message);
  const displayOptions = displayConfig?.messageTypes?.[messageType];
  
  // Get label (default to messageType if not specified)
  const label = displayOptions?.label || messageType;
  
  // Transform message content if onMessage provided
  let content = getTextContent(message);
  if (displayOptions?.onMessage) {
    content = displayOptions.onMessage(message);
  }
  
  // Get colors with theme support
  const color = resolveColor(
    displayOptions?.color, 
    displayConfig?.theme, 
    defaultColors[messageType] || "gray"
  );

  return (
    <Box flexDirection="column">
      <Text bold={displayOptions?.bold !== false} color={color}>
        {label}
      </Text>
      <Markdown>{content}</Markdown>
    </Box>
  );
}

function TerminalChatResponseToolCall({
  message,
  displayConfig,
}: {
  message: CoreMessage;
  displayConfig?: DisplayConfig;
}) {
  const details = parseToolCall(message);
  const text = getTextContent(message);
  const toolCall = getToolCall(message);
  
  const messageType = getDisplayMessageType(message);
  const displayOptions = displayConfig?.messageTypes?.[messageType];
  
  // Get label (default to messageType if not specified)
  const label = displayOptions?.label || messageType;
  
  // Get colors with theme support
  const color = resolveColor(
    displayOptions?.color, 
    displayConfig?.theme, 
    defaultColors[messageType] || "gray"
  );
  
  // Handle user_select tool calls differently - show the selection prompt
  if (toolCall?.toolName === "user_select") {
    const args = toolCall.args as {
      message: string;
      options: Array<{ label: string; value: string }>;
      defaultValue: string;
    };
    
    return (
      <Box flexDirection="column" gap={1}>
        {text && (
          <TerminalChatResponseMessage
            message={message}
            displayConfig={displayConfig}
          />
        )}
        <Box flexDirection="column">
                    <Text bold color={color}>
            {label}
          </Text>
          <Box flexDirection="column" marginLeft={2}>
            <Text color="cyan" bold>
              asking user: {args.message}
            </Text>
            <Text color="gray">
              Options: {args.options.map(opt => opt.label).join(", ")}
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Default handling for shell and other tool calls
  return (
    <Box flexDirection="column" gap={1}>
      {text && (
        <TerminalChatResponseMessage
          message={message}
          displayConfig={displayConfig}
        />
      )}
      <Box flexDirection="column">
          <Text bold color={color}>
            {label}
        </Text>
        <Box flexDirection="column" marginLeft={2}>
          <Text color="cyan" bold>
            command
          </Text>
          <Text>
            <Text dimColor>$</Text> {details?.cmdReadableText}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

function TerminalChatResponseMcpOutput({ message }: { message: CoreMessage }) {
  const toolCallResult = getToolCallResult(message);
  const content = toolCallResult?.result;
  if (!content) {
    return null;
  }
  const contentStr =
    typeof content === "string" ? content : JSON.stringify(content);
  return <Text>Received response (length: {contentStr.length})</Text>;
}

function TerminalChatResponseMcpCall({
  message,
}: {
  message: CoreAssistantMessage;
}) {
  const details = getToolCall(message);
  return (
    <Box flexDirection="column" gap={0}>
      <Text color="magentaBright" bold>
        calling mcp:
      </Text>
      <Text>
        <Text dimColor>$</Text> {details?.toolName}
      </Text>
    </Box>
  );
}

function TerminalChatResponseToolCallOutput({
  message,
  fullStdout,
}: {
  message: CoreToolMessage;
  fullStdout: boolean;
}) {
  const toolResult = getToolCallResult(message)!;
  const { output, metadata } = JSON.parse(toolResult.result as string) as {
    output: string;
    metadata: ExecOutputMetadata;
  };
  
  // Extract metadata for all tool calls (needed for hook rules)
  const { exit_code, duration_seconds } = metadata ?? {};
  const metadataInfo = useMemo(
    () =>
      [
        typeof exit_code !== "undefined" ? `code: ${exit_code}` : "",
        typeof duration_seconds !== "undefined"
          ? `duration: ${duration_seconds}s`
          : "",
      ]
        .filter(Boolean)
        .join(", "),
    [exit_code, duration_seconds],
  );
  
  // Handle user_select tool calls differently
  if (toolResult.toolName === "user_select") {
    return (
      <Box flexDirection="column" gap={0} marginLeft={2}>
        <Text color="green" bold>
          You selected: <Text color="white">{output}</Text>
        </Text>
      </Box>
    );
  }

  // Default handling for shell and other tool calls
  let displayedContent = output;
  if (getMessageType(message) === "function_call_output" && !fullStdout) {
    const lines = displayedContent.split("\n");
    if (lines.length > 4) {
      const head = lines.slice(0, 4);
      const remaining = lines.length - 4;
      displayedContent = [...head, `... (${remaining} more lines)`].join("\n");
    }
  }

  // -------------------------------------------------------------------------
  // Colorize diff output: lines starting with '-' in red, '+' in green.
  // This makes patches and other diff‑like stdout easier to read.
  // We exclude the typical diff file headers ('---', '+++') so they retain
  // the default color. This is a best‑effort heuristic and should be safe for
  // non‑diff output – only the very first character of a line is inspected.
  // -------------------------------------------------------------------------
  const colorizedContent = displayedContent
    .split("\n")
    .map((line) => {
      if (line.startsWith("+") && !line.startsWith("++")) {
        return chalk.green(line);
      }
      if (line.startsWith("-") && !line.startsWith("--")) {
        return chalk.red(line);
      }
      return line;
    })
    .join("\n");
  return (
    <Box flexDirection="column" gap={0} marginLeft={2}>
      <Text color="magenta" bold>
        command.stdout{" "}
        <Text dimColor>{metadataInfo ? `(${metadataInfo})` : ""}</Text>
      </Text>
      <Text dimColor>{colorizedContent}</Text>
    </Box>
  );
}

export function TerminalChatResponseGenericMessage({
  message,
}: {
  message: UIMessage;
}): React.ReactElement {
  return <Text>{JSON.stringify(message, null, 2)}</Text>;
}

export type MarkdownProps = TerminalRendererOptions & {
  children: string;
};

export function Markdown({
  children,
  ...options
}: MarkdownProps): React.ReactElement {
  const size = useTerminalSize();

  const rendered = React.useMemo(() => {
    // Configure marked for this specific render
    setOptions({
      // @ts-expect-error missing parser, space props
      renderer: new TerminalRenderer({ ...options, width: size.columns }),
    });
    const parsed = parse(children, { async: false }).trim();

    // Remove the truncation logic
    return parsed;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options is an object of primitives
  }, [children, size.columns, size.rows]);

  return <Text>{rendered}</Text>;
}
