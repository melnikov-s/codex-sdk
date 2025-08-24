import type { WorkflowFactoryWithTitle } from "../../../workflow/index.js";
import type { OverlayModeType } from "../types.js";

import { useMultiWorkflowHotkeys } from "../../../hooks/use-multi-workflow-hotkeys.js";

type Instance = { id: string; title: string; isActive: boolean };

export interface BridgeMultiWorkflowMgr {
  listInstances(): Array<Instance>;
  activeWorkflowId: string;
  switchToInstance(id: string): void;
  createInstance?: (
    factory: WorkflowFactoryWithTitle,
    options?: { activate?: boolean; title?: string },
  ) => string;
  removeInstance: (
    id: string,
    options?: { graceful?: boolean; force?: boolean },
  ) => void;
  switchToNextAttention?: () => boolean;
  switchToNextNonLoading?: () => boolean;
  switchToPreviousNonLoading?: () => boolean;
}

export function useMultiWorkflowHotkeysBridge(params: {
  enabled: boolean;
  isMulti: boolean;
  multiWorkflowMgr: BridgeMultiWorkflowMgr;
  openSelection: (
    items: Array<{ label: string; value: string }>,
    options: { label?: string; timeout?: number; defaultValue: string },
  ) => Promise<string>;
  setOverlayMode: (mode: OverlayModeType) => void;
  availableWorkflows: Array<{
    title: string;
    factory: WorkflowFactoryWithTitle;
  }>;
}) {
  const {
    enabled,
    isMulti,
    multiWorkflowMgr,
    openSelection,
    setOverlayMode,
    availableWorkflows,
  } = params;

  useMultiWorkflowHotkeys({
    workflows: isMulti ? multiWorkflowMgr.listInstances() : [],
    activeWorkflowId: isMulti ? multiWorkflowMgr.activeWorkflowId : "",
    switchToWorkflow: (id: string) => {
      if (isMulti) {
        multiWorkflowMgr.switchToInstance(id);
      }
    },
    openWorkflowPicker: () => {
      if (!isMulti) {
        return;
      }
      const instances = multiWorkflowMgr.listInstances();
      if (instances.length === 0) {
        setOverlayMode("selection");
        return;
      }
      const items = instances.map((i: Instance) => ({
        label: `${i.isActive ? "▶ " : ""}${i.title}`,
        value: i.id,
      }));
      openSelection(items, {
        defaultValue:
          multiWorkflowMgr.activeWorkflowId || (items[0]?.value ?? ""),
        label: "Switch workflow",
      })
        .then((id: string) => {
          multiWorkflowMgr.switchToInstance(id);
        })
        .catch(() => {});
    },
    switchToNextWorkflow: () => {
      if (!isMulti) {
        return;
      }
      const workflows = multiWorkflowMgr.listInstances();
      const currentIndex = workflows.findIndex((w: Instance) => w.isActive);
      const nextIndex = (currentIndex + 1) % workflows.length;
      if (workflows[nextIndex]) {
        multiWorkflowMgr.switchToInstance(workflows[nextIndex].id);
      }
    },
    switchToPreviousWorkflow: () => {
      if (!isMulti) {
        return;
      }
      const workflows = multiWorkflowMgr.listInstances();
      const currentIndex = workflows.findIndex((w: Instance) => w.isActive);
      const prevIndex =
        (currentIndex - 1 + workflows.length) % workflows.length;
      if (workflows[prevIndex]) {
        multiWorkflowMgr.switchToInstance(workflows[prevIndex].id);
      }
    },
    switchToNextAttention: () => {
      if (!isMulti) {
        return false;
      }
      return multiWorkflowMgr.switchToNextAttention?.() ?? false;
    },
    switchToNextNonLoading: () => {
      if (!isMulti) {
        return false;
      }
      return multiWorkflowMgr.switchToNextNonLoading?.() ?? false;
    },
    switchToPreviousNonLoading: () => {
      if (!isMulti) {
        return false;
      }
      return multiWorkflowMgr.switchToPreviousNonLoading?.() ?? false;
    },
    // removed duplicate openWorkflowPicker
    createNewWorkflow: () => {
      if (!isMulti || !availableWorkflows?.length) {
        return;
      }
      const choices = availableWorkflows.map((f, idx) => ({
        label: f.title,
        value: String(idx),
      }));
      openSelection(choices, { defaultValue: choices[0]?.value || "0" })
        .then((val) => {
          const idx = Number(val);
          const wf = availableWorkflows[idx];
          if (wf && multiWorkflowMgr.createInstance) {
            multiWorkflowMgr.createInstance(wf.factory, { activate: true });
          }
        })
        .catch(() => {});
    },
    closeCurrentWorkflow: () => {
      if (isMulti && multiWorkflowMgr.activeWorkflowId) {
        multiWorkflowMgr.removeInstance(multiWorkflowMgr.activeWorkflowId, {
          graceful: true,
        });
      }
    },
    killCurrentWorkflow: () => {
      if (isMulti && multiWorkflowMgr.activeWorkflowId) {
        multiWorkflowMgr.removeInstance(multiWorkflowMgr.activeWorkflowId, {
          force: true,
        });
      }
    },
    emergencyExit: () => {
      process.exit(1);
    },
    enabled,
  });
}
