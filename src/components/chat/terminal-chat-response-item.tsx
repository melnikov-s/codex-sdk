import type { UIMessage } from "../../utils/ai";
import type { DisplayConfig } from "../../workflow/index";
import type { ModelMessage, CoreToolMessage } from "ai";
import type { TerminalRendererOptions } from "marked-terminal";
import type { ExecOutputMetadata } from "src/utils/agent/sandbox/interface";

import { useTerminalSize } from "../../hooks/use-terminal-size";
import {
  getMessageType,
  getTextContent,
  getToolCall,
  getToolCallResult,
} from "../../utils/ai";
import { getDisplayLabel, getDisplayMessageType } from "../../utils/display";
import { parseToolCall } from "../../utils/parsers";
import chalk from "chalk";
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
        <TerminalChatResponseMessage
          message={item}
          displayConfig={displayConfig}
        />
      );
    case "function_call":
      return (
        <TerminalChatResponseToolCall
          message={item as ModelMessage}
          displayConfig={displayConfig}
        />
      );
    case "function_call_output":
      return (
        <TerminalChatResponseToolCallOutput
          message={item as CoreToolMessage}
          fullStdout={fullStdout}
          displayConfig={displayConfig}
        />
      );
    case "reasoning":
      return (
        <TerminalChatResponseReasoning
          message={item}
          displayConfig={displayConfig}
        />
      );
  }
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
  displayConfig,
}: {
  message: UIMessage & { duration_ms?: number };
  displayConfig?: DisplayConfig;
}): React.ReactElement | null {
  const textContent = getTextContent(message);

  if (!textContent) {
    return null;
  }

  return (
    <Box flexDirection="column">
      <TerminalChatResponseMessage
        message={message}
        displayConfig={displayConfig}
      />
    </Box>
  );
}

// Default color mapping for message types
const defaultColors: Record<string, string> = {
  assistant: "blueBright",
  user: "blue",
  toolCall: "blue",
  toolResponse: "green",
  ui: "gray",
};

// Default fallback component for messages
function DefaultMessageDisplay({
  message,
  displayConfig,
}: {
  message: UIMessage;
  displayConfig?: DisplayConfig;
}) {
  const messageType = getDisplayMessageType(message);
  const agentId =
    (message as UIMessage).metadata &&
    ((message as UIMessage).metadata!["agentId"] as string | undefined);
  const nameFromResolver =
    agentId && displayConfig?.agentNameResolver
      ? displayConfig.agentNameResolver(agentId)
      : undefined;
  const agentLabel = agentId ? `[${nameFromResolver || agentId}] ` : "";

  return (
    <Box flexDirection="column">
      <Text bold color={defaultColors[messageType] || "gray"}>
        {agentLabel}
        {getDisplayLabel(messageType)}
      </Text>
      <Markdown>{getTextContent(message)}</Markdown>
    </Box>
  );
}

function TerminalChatResponseMessage({
  message,
  displayConfig,
}: {
  message: UIMessage;
  displayConfig?: DisplayConfig;
}) {
  // If custom formatters are provided, use them
  if (displayConfig?.formatMessage || displayConfig?.formatRoleHeader) {
    const roleHeader = displayConfig.formatRoleHeader?.(message);
    const messageContent = displayConfig.formatMessage?.(message) || (
      <Markdown>{getTextContent(message)}</Markdown>
    );

    return (
      <Box flexDirection="column">
        {roleHeader}
        {messageContent}
      </Box>
    );
  }

  // Fallback to default display
  return (
    <DefaultMessageDisplay message={message} displayConfig={displayConfig} />
  );
}

function TerminalChatResponseToolCall({
  message,
  displayConfig,
}: {
  message: ModelMessage;
  displayConfig?: DisplayConfig;
}) {
  const agentId =
    (message as unknown as UIMessage).metadata &&
    ((message as unknown as UIMessage).metadata!["agentId"] as
      | string
      | undefined);
  const nameFromResolver =
    agentId && displayConfig?.agentNameResolver
      ? displayConfig.agentNameResolver(agentId)
      : undefined;
  const agentLabel = agentId ? `[${nameFromResolver || agentId}] ` : "";
  // If custom formatters are provided, use them
  if (displayConfig?.formatMessage || displayConfig?.formatRoleHeader) {
    const roleHeader = displayConfig.formatRoleHeader?.(message);
    const messageContent = displayConfig.formatMessage?.(message);

    return (
      <Box flexDirection="column">
        {roleHeader}
        {messageContent}
      </Box>
    );
  }

  // Fallback to default display for tool calls
  const details = parseToolCall(message);
  const text = getTextContent(message);
  const toolCall = getToolCall(message);
  const messageType = getDisplayMessageType(message);

  // Handle user_select tool calls differently - show the selection prompt
  if (toolCall?.toolName === "user_select") {
    const args = toolCall.input as {
      message: string;
      options: Array<string>;
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
          <Text bold color={defaultColors[messageType] || "blue"}>
            {getDisplayLabel(messageType)}
          </Text>
          <Box flexDirection="column" marginLeft={2}>
            <Text color="blue" bold>
              asking user: {args.message}
            </Text>
            <Text color="gray">Options: {args.options.join(", ")}</Text>
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
        <Text bold color={defaultColors[messageType] || "blue"}>
          {agentLabel}
          {getDisplayLabel(messageType)}
        </Text>
        <Box flexDirection="column" marginLeft={2}>
          <Text color="blue" bold>
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

function TerminalChatResponseToolCallOutput({
  message,
  fullStdout,
  displayConfig,
}: {
  message: CoreToolMessage;
  fullStdout: boolean;
  displayConfig?: DisplayConfig;
}) {
  const agentId =
    (message as unknown as UIMessage).metadata &&
    ((message as unknown as UIMessage).metadata!["agentId"] as
      | string
      | undefined);
  const nameFromResolver =
    agentId && displayConfig?.agentNameResolver
      ? displayConfig.agentNameResolver(agentId)
      : undefined;
  const agentLabel = agentId ? `[${nameFromResolver || agentId}] ` : "";
  const toolResult = getToolCallResult(message)!;

  // Handle the new tool result output structure safely
  const jsonResult = (() => {
    if (toolResult.output?.type === "json") {
      try {
        // toolResult.output.value is a JSON string that needs to be parsed
        return JSON.parse(toolResult.output.value as string) as {
          output: string;
          metadata: ExecOutputMetadata;
        };
      } catch (e) {
        // Fallback if parsing fails
        return {
          output: (toolResult.output.value as string) || "",
          metadata: { exit_code: 0, duration_seconds: 0 },
        };
      }
    } else {
      return {
        output: toolResult.output?.value || "",
        metadata: { exit_code: 0, duration_seconds: 0 },
      };
    }
  })();
  const { output, metadata } = jsonResult;

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
          You selected: <Text color="white">{String(output)}</Text>
        </Text>
      </Box>
    );
  }

  // Default handling for shell and other tool calls
  let displayedContent = String(output || "");
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
        {agentLabel}
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

  const rendered = useMemo(() => {
    // Keep default React import for JSX; using named useMemo above elsewhere
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
