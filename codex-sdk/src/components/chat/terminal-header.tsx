import type { HeaderConfig } from "../../lib.js";
import type { ReactNode } from "react";

import { componentStyles, spacing } from "../../utils/design-system.js";
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
  headers = [],
  statusLine = "",
  workflowHeader,
}) => {
  return (
    <>
      {terminalRows < 10 ? (
        // Compact header for small terminal windows
        <>
          <Text {...componentStyles.header.primary}>
            ● {workflowHeader || "Codex SDK"} - {PWD} -{" "}
            <Text color={colorsByPolicy[approvalPolicy] || "blue"}>
              {approvalPolicy}
            </Text>
            {headers.length > 0 &&
              " - " + headers.map((h) => `${h.label}: ${h.value}`).join(" - ")}
          </Text>
          {statusLine && (
            <Text {...componentStyles.tabs.instruction}>{statusLine}</Text>
          )}
        </>
      ) : (
        <>
          <Box borderStyle="round" paddingX={spacing.sm} width={64}>
            <Text {...componentStyles.header.primary}>
              ●{" "}
              {workflowHeader ? (
                workflowHeader
              ) : (
                <Text {...componentStyles.header.primary}>Codex SDK</Text>
              )}
            </Text>
          </Box>
          <Box
            borderStyle="round"
            borderColor="gray"
            paddingX={spacing.sm}
            width={64}
            flexDirection="column"
          >
            <Text {...componentStyles.tabs.instruction}>
              <Text {...componentStyles.header.accent}>↳</Text> workdir:{" "}
              <Text {...componentStyles.header.primary}>{PWD}</Text>
            </Text>
            <Text {...componentStyles.tabs.instruction}>
              <Text {...componentStyles.header.accent}>↳</Text> approval:{" "}
              <Text
                {...componentStyles.header.primary}
                color={colorsByPolicy[approvalPolicy] || "blue"}
              >
                {approvalPolicy}
              </Text>
            </Text>
            <Text {...componentStyles.tabs.instruction}>
              <Text {...componentStyles.header.accent}>↳</Text> sdk version:{" "}
              <Text {...componentStyles.header.primary}>v{version}</Text>
            </Text>

            {headers.map((header, idx) => (
              <Text
                key={`${header.label}-${idx}`}
                {...componentStyles.tabs.instruction}
              >
                <Text {...componentStyles.header.accent}>↳</Text> {header.label}
                :{" "}
                <Text {...componentStyles.header.primary}>{header.value}</Text>
              </Text>
            ))}
            {initialImagePaths?.map((img, idx) => (
              <Text key={img ?? idx} {...componentStyles.tabs.instruction}>
                <Text {...componentStyles.header.accent}>↳</Text> image:{" "}
                <Text {...componentStyles.header.primary}>
                  {path.basename(img)}
                </Text>
              </Text>
            ))}
          </Box>
          {statusLine && (
            <Text {...componentStyles.tabs.instruction}>{statusLine}</Text>
          )}
        </>
      )}
    </>
  );
};

export default TerminalHeader;
