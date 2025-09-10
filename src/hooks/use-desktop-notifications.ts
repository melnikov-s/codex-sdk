import type { UIMessage } from "../utils/ai.js";

import { getTextContent } from "../utils/ai.js";
import { spawn } from "node:child_process";
import React from "react";

export function useDesktopNotifications(params: {
  notify: boolean;
  loading: boolean;
  confirmationPrompt: React.ReactNode | null;
  items: Array<UIMessage>;
  cwd: string;
  title?: string;
}) {
  const { notify, loading, confirmationPrompt, items, cwd, title } = params;
  const prevLoadingRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    if (!notify) {
      prevLoadingRef.current = loading;
      return;
    }

    if (
      prevLoadingRef.current &&
      !loading &&
      confirmationPrompt == null &&
      items.length > 0
    ) {
      if (process.platform === "darwin") {
        const assistantMessages = items.filter((i) => i.role === "assistant");
        const last = assistantMessages[assistantMessages.length - 1];
        if (last) {
          const text = getTextContent(last);
          const preview = text.replace(/\n/g, " ").slice(0, 100);
          const safePreview = preview.replace(/"/g, '\\"');
          const titleToUse = title || "Codex SDK";
          spawn("osascript", [
            "-e",
            `display notification "${safePreview}" with title "${titleToUse}" subtitle "${cwd}" sound name "Ping"`,
          ]);
        }
      }
    }
    prevLoadingRef.current = loading;
  }, [notify, loading, confirmationPrompt, items, cwd, title]);
}
