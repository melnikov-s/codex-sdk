import type { UIMessage } from "../utils/ai.js";

import { useDesktopNotifications } from "./use-desktop-notifications.js";

export function useWorkflowNotifications(params: {
  notify: boolean;
  loading: boolean;
  confirmationPrompt: React.ReactNode | null | undefined;
  items: Array<UIMessage>;
  cwd: string;
  title: string;
}): void {
  useDesktopNotifications({
    notify: params.notify,
    loading: params.loading,
    confirmationPrompt: params.confirmationPrompt,
    items: params.items,
    cwd: params.cwd,
    title: params.title,
  });
}


