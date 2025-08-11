import type { HeaderConfig } from "../../lib.js";
import type { ReactNode } from "react";

import { Box, Text } from "ink";
import path from "node:path";
import React from "react";

export interface TerminalHeaderProps {
  terminalRows: number;
  version: string;
  PWD: string;
  approvalPolicy: string;
  colorsByPolicy: Record<string, string | undefined>;
  initialImagePaths?: Array<string>;
  flexModeEnabled?: boolean;
  headers?: Array<HeaderConfig>;
  statusLine?: string;
  workflowHeader?: ReactNode;
}

const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  terminalRows,
  version,
  PWD,
  approvalPolicy,
  colorsByPolicy,
  initialImagePaths,
  flexModeEnabled = false,
  headers = [],
  statusLine = "",
  workflowHeader,
}) => {
  return (
    <>
      {terminalRows < 10 ? (
        // Compact header for small terminal windows
        <>
          <Text>
            ● {workflowHeader || "Codex (Default workflow)"} v{version} - {PWD}{" "}
            -{" "}
            <Text color={colorsByPolicy[approvalPolicy]}>{approvalPolicy}</Text>
            {flexModeEnabled ? " - flex-mode" : ""}
            {headers.length > 0 &&
              " - " + headers.map((h) => `${h.label}: ${h.value}`).join(" - ")}
          </Text>
          {statusLine && <Text dimColor>{statusLine}</Text>}
        </>
      ) : (
        <>
          <Box borderStyle="round" paddingX={1} width={64}>
            <Text>
              ●{" "}
              {workflowHeader ? (
                workflowHeader
              ) : (
                <>
                  OpenAI <Text bold>Codex</Text>{" "}
                  <Text dimColor>(research preview)</Text>
                </>
              )}{" "}
              <Text dimColor>
                <Text color="blueBright">v{version}</Text>
              </Text>
            </Text>
          </Box>
          <Box
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            width={64}
            flexDirection="column"
          >
            <Text dimColor>
              <Text color="blueBright">↳</Text> workdir: <Text bold>{PWD}</Text>
            </Text>
            {/* Model info removed - handled by consumer's workflow */}
            <Text dimColor>
              <Text color="blueBright">↳</Text> approval:{" "}
              <Text bold color={colorsByPolicy[approvalPolicy]}>
                {approvalPolicy}
              </Text>
            </Text>
            {flexModeEnabled && (
              <Text dimColor>
                <Text color="blueBright">↳</Text> flex-mode:{" "}
                <Text bold>enabled</Text>
              </Text>
            )}
            {headers.map((header, idx) => (
              <Text key={`${header.label}-${idx}`} dimColor>
                <Text color="blueBright">↳</Text> {header.label}:{" "}
                <Text bold>{header.value}</Text>
              </Text>
            ))}
            {initialImagePaths?.map((img, idx) => (
              <Text key={img ?? idx} color="gray">
                <Text color="blueBright">↳</Text> image:{" "}
                <Text bold>{path.basename(img)}</Text>
              </Text>
            ))}
          </Box>
          {statusLine && <Text dimColor>{statusLine}</Text>}
        </>
      )}
    </>
  );
};

export default TerminalHeader;
