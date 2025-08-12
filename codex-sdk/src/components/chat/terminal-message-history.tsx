import type { TerminalHeaderProps } from "./terminal-header.js";
import type { GroupedResponseItem } from "./use-message-grouping.js";
import type { UIMessage } from "../../utils/ai.js";
import type { DisplayConfig, SlotRegion } from "../../workflow/index.js";

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
  headerProps: TerminalHeaderProps;
  fullStdout: boolean;
  displayConfig?: DisplayConfig;
  slots?: Partial<Record<SlotRegion, React.ReactNode | null>>;
};

const TerminalMessageHistory: React.FC<TerminalMessageHistoryProps> = ({
  batch,
  headerProps,
  // `loading` handled by input component now.
  loading: _loading,
  fullStdout,
  displayConfig,
  slots,
}) => {
  // Flatten batch entries to response items.
  const messages = useMemo(() => batch.map(({ item }) => item!), [batch]);

  return (
    <Box flexDirection="column">
      {/* Pinned header at top */}
      <Static items={["header"]}>
        {() => <TerminalHeader key="header" {...headerProps} />}
      </Static>

      {/* Below-header dynamic slot */}
      {slots?.belowHeader ?? null}

      {/* Above-history dynamic slot */}
      {slots?.aboveHistory ?? null}

      {/* History messages (static append-only) */}
      <Static items={messages}>
        {(message, index) => {
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
              marginTop={message.role === "user" ? 1 : 1}
              marginBottom={0}
            >
              <TerminalChatResponseItem
                item={message}
                fullStdout={fullStdout}
                displayConfig={displayConfig}
              />
            </Box>
          );
        }}
      </Static>

      {/* Below-history dynamic slot */}
      {slots?.belowHistory ?? null}
    </Box>
  );
};

export default React.memo(TerminalMessageHistory);
