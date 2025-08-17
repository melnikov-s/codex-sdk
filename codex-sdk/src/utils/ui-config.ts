import type { HeaderConfig, LibraryConfig } from "../lib.js";

export function resolveHeaders(
  uiConfig: LibraryConfig | undefined,
): Array<HeaderConfig> {
  const configHeaders = uiConfig?.headers;
  if (!configHeaders) {
    return [];
  }
  return typeof configHeaders === "function" ? configHeaders() : configHeaders;
}

export function resolveStatusLine(uiConfig: LibraryConfig | undefined): string {
  const configStatusLine = uiConfig?.statusLine;
  if (!configStatusLine) {
    return "";
  }
  return typeof configStatusLine === "function"
    ? configStatusLine()
    : configStatusLine;
}
