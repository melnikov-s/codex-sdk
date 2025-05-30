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
import { parseToolCall } from "../../utils/parsers";
import chalk, { type ForegroundColorName } from "chalk";
import { Box, Text } from "ink";
import { parse, setOptions } from "marked";
import TerminalRenderer from "marked-terminal";
import React, { useMemo } from "react";

export default function TerminalChatResponseItem({
  item,
  fullStdout = false,
  formatRole,
}: {
  item: CoreMessage;
  fullStdout?: boolean;
  formatRole?: (
    role: "user" | "system" | "assistant" | "tool" | "ui",
  ) => string;
}): React.ReactElement {
  switch (getMessageType(item)) {
    case "message":
      return (
        <TerminalChatResponseMessage message={item} formatRole={formatRole} />
      );
    case "function_call":
      return <TerminalChatResponseToolCall message={item} />;
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
  message: CoreMessage & { duration_ms?: number };
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

const colorsByRole: Record<string, ForegroundColorName> = {
  assistant: "magentaBright",
  user: "blueBright",
  system: "gray",
  tool: "cyan",
  ui: "yellow",
};

function TerminalChatResponseMessage({
  message,
  formatRole,
}: {
  message: CoreMessage;
  formatRole?: (
    role: "user" | "system" | "assistant" | "tool" | "ui",
  ) => string;
}) {
  const roleToDisplay = formatRole
    ? formatRole(
        message.role as "user" | "system" | "assistant" | "tool" | "ui",
      )
    : message.role;

  return (
    <Box flexDirection="column">
      <Text bold color={colorsByRole[message.role] || "gray"}>
        {roleToDisplay}
      </Text>
      <Markdown>{getTextContent(message)}</Markdown>
    </Box>
  );
}

function TerminalChatResponseToolCall({ message }: { message: CoreMessage }) {
  const details = parseToolCall(message);
  const text = getTextContent(message);
  return (
    <>
      {text ? <TerminalChatResponseMessage message={message} /> : null}
      <Box flexDirection="column" gap={1}>
        <Text color="magentaBright" bold>
          command
        </Text>
        <Text>
          <Text dimColor>$</Text> {details?.cmdReadableText}
        </Text>
      </Box>
    </>
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
    <Box flexDirection="column" gap={1}>
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
  const { exit_code, duration_seconds } = metadata;
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
    <Box flexDirection="column" gap={1}>
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
  message: CoreMessage;
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
