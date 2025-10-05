import type { ApprovalPolicy } from "../approvals.js";
import type { CurrentWorkflow } from "../hooks/use-workflows.js";
import type { HeaderConfig } from "../utils/workflow-config.js";
import type { WorkflowFactory } from "../workflow/index.js";

import { WorkflowOverlay } from "./workflow-overlay.js";
import React from "react";

export interface WorkflowSwitcherOverlayProps {
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
  currentWorkflows: Array<CurrentWorkflow>;
  availableWorkflows: Array<WorkflowFactory>;
  activeWorkflowId: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
  isActive: boolean;
}

export function WorkflowSwitcherOverlay({
  title,
  terminalRows,
  version,
  PWD,
  approvalPolicy,
  colorsByPolicy,
  headers,
  availableHotkeys,
  currentWorkflows,
  availableWorkflows,
  activeWorkflowId,
  onSelect,
  onCancel,
  isActive,
}: WorkflowSwitcherOverlayProps): JSX.Element {
  return (
    <WorkflowOverlay
      title={title}
      promptText={
        currentWorkflows.length > 1
          ? "Switch to workflow:"
          : "Workflow actions:"
      }
      terminalRows={terminalRows}
      version={version}
      PWD={PWD}
      approvalPolicy={approvalPolicy}
      availableHotkeys={availableHotkeys}
      colorsByPolicy={colorsByPolicy}
      headers={headers}
      items={[
        ...(currentWorkflows.length > 1
          ? currentWorkflows.map((workflow) => ({
              label: `${workflow.displayTitle}${workflow.id === activeWorkflowId ? " (current)" : ""}`,
              value: workflow.id,
              isLoading: workflow.isLoading || false,
            }))
          : []),
        ...(currentWorkflows.length > 0
          ? [
              {
                label: `Close current (${(currentWorkflows.find((w) => w.id === activeWorkflowId)?.displayTitle) || "current"})`,
                value: "__close_current__",
                isLoading: false,
              },
            ]
          : []),
        {
          label:
            availableWorkflows.length === 1 ? "Create new" : "Create new...",
          value: "__create_new__",
          isLoading: false,
        },
      ]}
      onSelect={onSelect}
      onCancel={onCancel}
      isActive={isActive}
    />
  );
}
