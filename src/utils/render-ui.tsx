import type {
  SingleWorkflowOptions,
  MultiWorkflowOptions,
} from "./workflow-config.js";
import type { WorkflowFactory, WorkflowController } from "../workflow/index.js";
import type { WorkflowManager } from "../workflow/manager-types.js";

import App from "../app.js";
import { HotkeyProvider } from "../hooks/use-customizable-hotkeys.js";
import { clearTerminal, setInkRenderer } from "../utils/terminal.js";
import { render } from "ink";
import React from "react";

export function renderSingleWorkflow(
  workflow: WorkflowFactory,
  options: SingleWorkflowOptions,
  manager: WorkflowManager,
  onController: (controller: WorkflowController) => void,
) {
  const uiConfig = options.config || {};

  clearTerminal();
  const inkInstance = render(
    <HotkeyProvider initialConfig={options.hotkeyConfig}>
      <App
        uiConfig={uiConfig}
        approvalPolicy={options.approvalPolicy || "suggest"}
        additionalWritableRoots={options.additionalWritableRoots || []}
        fullStdout={options.fullStdout || false}
        workflowFactory={workflow}
        title={options.title}
        workflowManager={manager}
        onController={onController}
      />
    </HotkeyProvider>,
  );
  setInkRenderer(inkInstance);
  return inkInstance;
}

export function renderMultiWorkflow(
  workflows: Array<WorkflowFactory>,
  options: MultiWorkflowOptions,
  manager: WorkflowManager,
  onController: (controller: WorkflowController) => void,
) {
  const uiConfig = options.config || {};

  clearTerminal();
  const inkInstance = render(
    <HotkeyProvider initialConfig={options.hotkeyConfig}>
      <App
        uiConfig={uiConfig}
        approvalPolicy={options.approvalPolicy || "suggest"}
        additionalWritableRoots={options.additionalWritableRoots || []}
        fullStdout={options.fullStdout || false}
        workflows={workflows}
        initialWorkflows={options.initialWorkflows}
        title={options.title || "Multi-Workflow Environment"}
        workflowManager={manager}
        onController={onController}
      />
    </HotkeyProvider>,
  );
  setInkRenderer(inkInstance);
  return inkInstance;
}
