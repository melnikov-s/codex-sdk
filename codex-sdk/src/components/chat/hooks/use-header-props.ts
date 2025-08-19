import type { LibraryConfig } from "../../../lib.js";
import type { TerminalHeaderProps } from "../terminal-header.js";

import { resolveHeaders, resolveStatusLine } from "../../../utils/ui-config.js";
import { useMemo } from "react";

export function useHeaderProps(params: {
  uiConfig?: LibraryConfig;
  terminalRows: number;
  version: string;
  PWD: string;
  approvalPolicy: string;
  colorsByPolicy: Record<string, string | undefined>;
  displayConfig?: { header?: React.ReactNode } | undefined;
  activeInstanceTitle?: string;
}): { headers: TerminalHeaderProps["headers"]; statusLine: string; headerProps: TerminalHeaderProps } {
  const { uiConfig, terminalRows, version, PWD, approvalPolicy, colorsByPolicy, displayConfig, activeInstanceTitle } = params;

  const headers = useMemo(() => resolveHeaders(uiConfig), [uiConfig]);
  const statusLine = useMemo(() => resolveStatusLine(uiConfig), [uiConfig]);

  const workflowHeader = useMemo(() => {
    return (activeInstanceTitle as unknown as React.ReactNode) || displayConfig?.header || "Codex SDK";
  }, [activeInstanceTitle, displayConfig?.header]);

  const headerProps: TerminalHeaderProps = {
    terminalRows,
    version,
    PWD,
    approvalPolicy,
    colorsByPolicy,
    headers,
    statusLine,
    workflowHeader,
  };

  return { headers, statusLine, headerProps } as const;
}


