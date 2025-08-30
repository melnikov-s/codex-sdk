import type { ApprovalPolicy } from "../approvals.js";
import type { HeaderConfig } from "../utils/workflow-config.js";

import { WorkflowOverlay } from "./workflow-overlay.js";
import React from "react";

export interface ApprovalPolicyOverlayProps {
  title?: React.ReactNode;
  terminalRows: number;
  version: string;
  PWD: string;
  approvalPolicy: ApprovalPolicy;
  colorsByPolicy: Record<ApprovalPolicy, "green" | undefined>;
  headers: Array<HeaderConfig>;
  availableHotkeys: Array<{
    key: string;
    ctrl?: boolean;
    action: () => void;
    description?: string;
  }>;
  onSelect: (policyValue: string) => void;
  onCancel: () => void;
  isActive: boolean;
}

export function ApprovalPolicyOverlay({
  title,
  terminalRows,
  version,
  PWD,
  approvalPolicy,
  colorsByPolicy,
  headers,
  availableHotkeys,
  onSelect,
  onCancel,
  isActive,
}: ApprovalPolicyOverlayProps): JSX.Element {
  return (
    <WorkflowOverlay
      title={title}
      promptText="Change approval policy:"
      terminalRows={terminalRows}
      version={version}
      PWD={PWD}
      approvalPolicy={approvalPolicy}
      colorsByPolicy={colorsByPolicy}
      headers={headers}
      availableHotkeys={availableHotkeys}
      items={[
        { label: "suggest", value: "suggest", isLoading: false },
        { label: "auto-edit", value: "auto-edit", isLoading: false },
        { label: "full-auto", value: "full-auto", isLoading: false },
      ]}
      onSelect={onSelect}
      onCancel={onCancel}
      isActive={isActive}
    />
  );
}
