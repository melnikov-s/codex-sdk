import type { ApprovalPolicy } from "../approvals.js";
import type { HeaderConfig } from "../utils/workflow-config.js";
import type { WorkflowFactory } from "../workflow/index.js";

import { WorkflowOverlay } from "./workflow-overlay.js";
import { generateWorkflowId } from "../utils/workflow-ids.js";
import React from "react";

export interface WorkflowPickerOverlayProps {
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
  availableWorkflows: Array<WorkflowFactory>;
  onSelect: (workflowId: string) => void;
  onCancel: () => void;
  isActive: boolean;
}

export function WorkflowPickerOverlay({
  title,
  terminalRows,
  version,
  PWD,
  approvalPolicy,
  colorsByPolicy,
  headers,
  availableHotkeys,
  availableWorkflows,
  onSelect,
  onCancel,
  isActive,
}: WorkflowPickerOverlayProps): JSX.Element {
  return (
    <WorkflowOverlay
      title={title}
      promptText="Create new workflow instance:"
      terminalRows={terminalRows}
      version={version}
      PWD={PWD}
      approvalPolicy={approvalPolicy}
      colorsByPolicy={colorsByPolicy}
      headers={headers}
      availableHotkeys={availableHotkeys}
      items={availableWorkflows.map((wf) => ({
        label: wf.meta?.title || "Untitled",
        value: generateWorkflowId(wf),
        isLoading: false,
      }))}
      onSelect={onSelect}
      onCancel={onCancel}
      isActive={isActive}
    />
  );
}
