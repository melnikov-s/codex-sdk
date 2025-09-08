import type { ApprovalPolicy } from "../approvals.js";
import type { CurrentWorkflow } from "../hooks/use-workflows.js";
import type { LibraryConfig } from "../utils/workflow-config.js";
import type { DisplayConfig, WorkflowController } from "../workflow/index.js";

import TerminalChat from "./chat/terminal-chat.js";
import React from "react";

export interface WorkflowTerminalsProps {
  currentWorkflows: Array<CurrentWorkflow>;
  activeWorkflowId: string;
  visible: boolean;
  approvalPolicy: ApprovalPolicy;
  additionalWritableRoots: ReadonlyArray<string>;
  fullStdout: boolean;
  uiConfig?: LibraryConfig;
  onController: (controller: WorkflowController, workflowId: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onDisplayConfigChange: (id: string, displayConfig?: DisplayConfig) => void;
  onLoadingStateChange: (id: string, isLoading: boolean) => void;
  openWorkflowPicker: () => void;
  createNewWorkflow: () => void;
  isMulti: boolean;
}

export function WorkflowTerminals({
  currentWorkflows,
  activeWorkflowId,
  visible,
  approvalPolicy,
  additionalWritableRoots,
  fullStdout,
  uiConfig,
  onController,
  onTitleChange,
  onDisplayConfigChange,
  onLoadingStateChange,
  openWorkflowPicker,
  createNewWorkflow,
  isMulti,
}: WorkflowTerminalsProps): JSX.Element {
  return (
    <>
      {currentWorkflows.map((workflow) => (
        <TerminalChat
          key={workflow.id}
          id={workflow.id}
          visible={workflow.id === activeWorkflowId && visible}
          approvalPolicy={approvalPolicy}
          additionalWritableRoots={additionalWritableRoots}
          fullStdout={fullStdout}
          workflowFactory={workflow.factory}
          uiConfig={uiConfig}
          onController={(controller) => onController(controller, workflow.id)}
          onTitleChange={onTitleChange}
          onDisplayConfigChange={onDisplayConfigChange}
          onLoadingStateChange={onLoadingStateChange}
          openWorkflowPicker={openWorkflowPicker}
          createNewWorkflow={createNewWorkflow}
          isMulti={isMulti}
        />
      ))}
    </>
  );
}
