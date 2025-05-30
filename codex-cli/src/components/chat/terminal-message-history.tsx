import type { TerminalHeaderProps } from "./terminal-header.js";
import type { GroupedResponseItem } from "./use-message-grouping.js";
import type { UIMessage } from "../../utils/ai.js";

import TerminalChatResponseItem from "./terminal-chat-response-item.js";
import TerminalHeader from "./terminal-header.js";
import { getId } from "../../utils/ai.js";
import { Box, Static } from "ink";
import React, { useMemo } from "react";

// A batch entry can either be a standalone response item or a grouped set of
// items (e.g. auto‑approved tool‑call batches) that should be rendered
// together.
type BatchEntry = { item?: UIMessage; group?: GroupedResponseItem };
type TerminalMessageHistoryProps = {
  batch: Array<BatchEntry>;
  groupCounts: Record<string, number>;
  items: Array<UIMessage>;
  userMsgCount: number;
  confirmationPrompt: React.ReactNode;
  loading: boolean;
  thinkingSeconds: number;
  headerProps: TerminalHeaderProps;
  fullStdout: boolean;
  formatRole?: (
    role: "user" | "system" | "assistant" | "tool" | "ui",
  ) => string;
};

const TerminalMessageHistory: React.FC<TerminalMessageHistoryProps> = ({
  batch,
  headerProps,
  // `loading` and `thinkingSeconds` handled by input component now.
  loading: _loading,
  thinkingSeconds: _thinkingSeconds,
  fullStdout,
  formatRole,
}) => {
  // Flatten batch entries to response items.
  const messages = useMemo(() => batch.map(({ item }) => item!), [batch]);

  return (
    <Box flexDirection="column">
      {/* The dedicated thinking indicator in the input area now displays the
          elapsed time, so we no longer render a separate counter here. */}
      <Static items={["header", ...messages]}>
        {(item, index) => {
          if (typeof item === "string") {
            return <TerminalHeader key="header" {...headerProps} />;
          }

          // After the guard above, item is a ResponseItem
          const message = item;
          // Suppress empty reasoning updates (i.e. items with an empty summary).
          const msg = message as unknown as { summary?: Array<unknown> };
          if (msg.summary?.length === 0) {
            return null;
          }
          return (
            <Box
              key={`${getId(message)}-${index}`}
              flexDirection="column"
              marginLeft={message.role === "user" ? 0 : 4}
              marginTop={message.role === "user" ? 1 : 2}
              marginBottom={1}
            >
              <TerminalChatResponseItem
                item={message}
                fullStdout={fullStdout}
                formatRole={formatRole}
              />
            </Box>
          );
        }}
      </Static>
    </Box>
  );
};

export default React.memo(TerminalMessageHistory);
