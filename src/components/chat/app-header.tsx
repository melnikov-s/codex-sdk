import type { ApprovalPolicy } from "../../approvals.js";
import type { HeaderConfig } from "../../lib.js";
import type { ColorName } from "chalk";

import { componentStyles, spacing } from "../../utils/design-system.js";
import { Box, Text } from "ink";
import path from "path";
import React from "react";

export interface AppHeaderProps {
  terminalRows: number;
  version: string;
  PWD: string;
  approvalPolicy: ApprovalPolicy;
  colorsByPolicy: Record<ApprovalPolicy, ColorName | undefined>;
  initialImagePaths?: Array<string>;
  headers?: Array<HeaderConfig>;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  terminalRows,
  version,
  PWD,
  approvalPolicy,
  colorsByPolicy,
  initialImagePaths,
  headers = [],
}) => {
  return (
    <>
      {terminalRows < 10 ? (
        // Compact header for small terminal windows
        <>
          <Text {...componentStyles.header.primary}>
            ● Codex SDK - {PWD} -{" "}
            <Text color={colorsByPolicy[approvalPolicy] || "blue"}>
              {approvalPolicy}
            </Text>
            {headers.length > 0 &&
              " - " + headers.map((h) => `${h.label}: ${h.value}`).join(" - ")}
          </Text>
        </>
      ) : (
        <>
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
              <Text key={idx} {...componentStyles.tabs.instruction}>
                <Text {...componentStyles.header.accent}>↳</Text>{" "}
                {header.label.toLowerCase()}:{" "}
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
        </>
      )}
    </>
  );
};

export default AppHeader;
