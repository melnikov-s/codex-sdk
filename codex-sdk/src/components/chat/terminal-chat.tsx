import type { ApprovalPolicy } from "../../approvals.js";
import type { LibraryConfig } from "../../lib.js";
// import type { SelectionState as OverlaySelectionState } from "./hooks/use-overlays.js";
import type { UIMessage } from "../../utils/ai.js";
import type {
  WorkflowController,
  WorkflowFactory,
  WorkflowFactoryWithTitle,
  MultiWorkflowController,
} from "../../workflow";

import { useHeaderProps } from "./hooks/use-header-props.js";
import { useInitialLauncher } from "./hooks/use-initial-launcher.js";
import { useInkInputSlash } from "./hooks/use-ink-input-slash.js";
import { useMultiWorkflowHotkeysBridge } from "./hooks/use-multi-workflow-hotkeys-bridge.js";
import { useOverlayAPIs } from "./hooks/use-overlay-apis.js";
import { useOverlays } from "./hooks/use-overlays.js";
import { useQuickSlash } from "./hooks/use-quick-slash.js";
import { useWorkflowFactorySync } from "./hooks/use-workflow-factory-sync.js";
import { useWorkflowManager } from "./hooks/use-workflow-manager.js";
// Keep import list minimal in container; child components handle details
import InputRegion from "./input-region.js";
import ManagerSlot from "./manager-slot.js";
import InteractiveWorkflowTabBar from "./multi-workflow-tab-bar.js";
import { OverlayRouter } from "./overlay-router.js";
import WorkflowPane from "./workflow-pane.js";
// (dedupe)
import { useMultiWorkflowManager } from "../../hooks/use-multi-workflow-manager.js";
import { useStdinRawMode } from "../../hooks/use-stdin-raw-mode.js";
import { useTerminalSize } from "../../hooks/use-terminal-size.js";
import { useWorkflowNotifications } from "../../hooks/use-workflow-notifications.js";
import { colorsByPolicy } from "../../utils/colors.js";
import { log } from "../../utils/logger/log.js";
import { CLI_VERSION } from "../../utils/session.js";
import { shortCwd } from "../../utils/short-path.js";
// (moved header/hooks imports above)
import { Box, Text } from "ink";
import React, { useMemo, useState } from "react";

// OverlayModeType moved to ./types

type Props = {
  approvalPolicy: ApprovalPolicy;
  additionalWritableRoots: ReadonlyArray<string>;
  fullStdout: boolean;
  uiConfig?: LibraryConfig;
  onController?: (
    controller: WorkflowController | MultiWorkflowController,
  ) => void;
} & (
  | {
      // Single workflow mode
      workflowFactory: WorkflowFactory;
      multiWorkflow?: false;
    }
  | {
      // Multi-workflow mode
      workflowFactory?: never;
      multiWorkflow: true;
      availableWorkflows: Array<WorkflowFactoryWithTitle>;
      onMultiController?: (controller: MultiWorkflowController) => void;
    }
);

// colorsByPolicy moved to ../../utils/colors

// Command explanation functionality removed - should be handled by the consumer's workflow

export default function TerminalChat(props: Props): React.ReactElement {
  const {
    approvalPolicy: initialApprovalPolicy,
    additionalWritableRoots,
    fullStdout,
    uiConfig,
    onController,
  } = props;
  const effectiveUiConfig = useMemo(() => uiConfig ?? {}, [uiConfig]);
  const notify = Boolean(effectiveUiConfig?.notify);
  const overlays = useOverlays();
  const {
    overlayMode,
    setOverlayMode,
    selectionState,
    setSelectionState,
    promptState,
    setPromptState,
    confirmationState,
    setConfirmationState,
    workflowPickerState,
  } = overlays;

  // Quick slash / selection restore helpers

  const {
    openSelection: openSelectionStable,
    selectionApi,
    openPrompt: _openPrompt,
    openConfirmation: _openConfirmation,
    promptApi,
  } = useOverlayAPIs({
    setOverlayMode,
    setSelectionState,
    setPromptState,
    setConfirmationState,
  });

  // Conditional workflow management based on mode
  // Active workflow factory is driven by the multi-workflow manager
  const [activeFactory, setActiveFactory] = useState<WorkflowFactory>(() =>
    props.multiWorkflow
      ? // Temporary no-op factory until a real one is selected by the multi-workflow manager
        () => ({ message: () => {}, stop: () => {}, terminate: () => {} })
      : (props.workflowFactory as WorkflowFactory),
  );

  const singleWorkflowMgr = useWorkflowManager({
    initialApprovalPolicy,
    additionalWritableRoots,
    uiConfig: effectiveUiConfig,
    workflowFactory: activeFactory,
    onController: props.multiWorkflow ? undefined : onController,
    selectionApi,
    promptApi,
  });

  const multiWorkflowMgr = useMultiWorkflowManager({
    availableWorkflows: props.multiWorkflow ? props.availableWorkflows : [],
    initialApprovalPolicy,
    additionalWritableRoots,
    uiConfig: effectiveUiConfig,
    onController: props.multiWorkflow
      ? props.onMultiController || onController
      : undefined,
    selectionApi,
    promptApi,
    singleWorkflowManager: singleWorkflowMgr,
  });

  // (moved below once state deps are defined)

  // Sync active factory in multi-workflow mode
  useWorkflowFactorySync({
    isMulti: props.multiWorkflow,
    activeInstanceFactory: multiWorkflowMgr.activeInstance?.factory as
      | WorkflowFactory
      | undefined,
    activeFactory,
    setActiveFactory: (f) => setActiveFactory(() => f),
  });

  // Use appropriate manager based on mode
  // In multi-workflow mode, the single workflow manager holds the active workflow instance
  const workflowMgr = singleWorkflowMgr;

  const loading = workflowMgr.state.loading;
  const items = workflowMgr.state.messages as Array<UIMessage>;
  const inputDisabled = Boolean(workflowMgr.state.inputDisabled);
  const approvalPolicy = workflowMgr.approvalPolicy;
  const workflowState = workflowMgr.state;
  const smartSetState = workflowMgr.smartSetState;
  const displayConfig = workflowMgr.displayConfig;
  const workflow = workflowMgr.workflow;
  const inputSetterRef = (
    workflowMgr as unknown as {
      inputSetterRef: React.MutableRefObject<
        ((value: string) => void) | undefined
      >;
    }
  ).inputSetterRef;
  const confirmationPrompt = workflowMgr.confirmationPrompt;
  const explanation = workflowMgr.explanation;
  const submitConfirmation = workflowMgr.submitConfirmation;
  const setApprovalPolicy = workflowMgr.setApprovalPolicy;

  const PWD = useMemo(() => shortCwd(), []);

  // Quick-slash mode handling via hooks
  const { quickSlashBuffer, setQuickSlashBuffer, selectionBackupRef } =
    useQuickSlash({
      overlayMode,
      setOverlayMode,
      selectionState,
      setSelectionState,
      inputSetterRef,
    });
  useInkInputSlash({
    overlayMode,
    selectionState,
    setQuickSlashBuffer,
    selectionBackupRef: selectionBackupRef as {
      current: typeof selectionState;
    },
    inputSetterRef,
    isActive: true,
  });

  // ManagerSlot rendering moved to ManagerSlot component

  // ────────────────────────────────────────────────────────────────
  // DEBUG: log every render w/ key bits of state
  // ────────────────────────────────────────────────────────────────
  log(
    `render - workflow? ${Boolean(workflowMgr.workflow)} loading=${loading} items=${
      items.length
    }`,
  );

  useInitialLauncher({
    isMulti: props.multiWorkflow,
    workflowsCount: multiWorkflowMgr.workflows.length,
    setOverlayMode: (m) => setOverlayMode(m),
  });

  // Workflow creation and lifecycle handled by hook

  useWorkflowNotifications({
    notify,
    loading,
    confirmationPrompt,
    items,
    cwd: PWD,
    title: props.multiWorkflow
      ? multiWorkflowMgr
          .listInstances()
          .find((w) => w.id === multiWorkflowMgr.activeWorkflowId)?.title ||
        "Codex SDK"
      : "Codex SDK",
  });

  // Ensure stdin remains in raw mode so Ctrl+C reaches Ink handlers
  useStdinRawMode();

  // ---------------------------------------------------------------------
  // Dynamic layout constraints – keep total rendered rows <= terminal rows
  // ---------------------------------------------------------------------

  // Just render every item in order, no grouping/collapse.
  const lastMessageBatch = items.map((item) => ({ item }));
  const groupCounts: Record<string, number> = {};
  const userMsgCount = items.filter((i) => i.role === "user").length;

  const activeInstanceTitle = props.multiWorkflow
    ? multiWorkflowMgr
        .listInstances()
        .find((w) => w.id === multiWorkflowMgr.activeWorkflowId)?.title || ""
    : "";

  const { rows: terminalRows } = useTerminalSize();
  const { headers, statusLine } = useHeaderProps({
    uiConfig: effectiveUiConfig,
    terminalRows,
    version: CLI_VERSION,
    PWD,
    approvalPolicy,
    colorsByPolicy,
    displayConfig,
    activeInstanceTitle,
  });

  // Tab bar for multi-workflow mode - render directly without memoization to avoid dependency loops
  const renderTabBar = () => {
    if (props.multiWorkflow && multiWorkflowMgr.workflows.length > 1) {
      return (
        <InteractiveWorkflowTabBar
          workflows={multiWorkflowMgr.listInstances()}
          activeId={multiWorkflowMgr.activeWorkflowId}
          onSwitchWorkflow={multiWorkflowMgr.switchToInstance}
          mouseEnabled={false} // TODO: Implement mouse support
        />
      );
    }
    return null;
  };

  // Removed: setting manager slots from container is not allowed; consumers own slots

  // Set up global hotkeys for multi-workflow mode via bridge
  useMultiWorkflowHotkeysBridge({
    enabled: true,
    isMulti: Boolean(props.multiWorkflow),
    multiWorkflowMgr,
    openSelection: openSelectionStable,
    setOverlayMode,
    availableWorkflows: props.multiWorkflow
      ? props.availableWorkflows.map((f) => ({ title: f.title, factory: f }))
      : [],
  });

  return (
    <Box flexDirection="column">
      {/* Manager Slot: Above Tabs */}
      <ManagerSlot
        enabled={Boolean(props.multiWorkflow)}
        region="aboveTabs"
        managerSlots={multiWorkflowMgr.managerSlots}
        workflowState={workflowState}
      />

      {/* Tab Bar - render directly to avoid useEffect loops */}
      {renderTabBar()}

      {/* Manager Slot: Above Workflow */}
      <ManagerSlot
        enabled={Boolean(props.multiWorkflow)}
        region="aboveWorkflow"
        managerSlots={multiWorkflowMgr.managerSlots}
        workflowState={workflowState}
      />

      {/* Current Workflow Content */}
      <Box flexDirection="column">
        <WorkflowPane
          show={Boolean(
            (!props.multiWorkflow || multiWorkflowMgr.workflows.length > 0) &&
              workflow,
          )}
          batch={lastMessageBatch}
          groupCounts={groupCounts}
          items={items}
          userMsgCount={userMsgCount}
          confirmationPrompt={confirmationPrompt}
          loading={quickSlashBuffer != null ? false : loading}
          fullStdout={fullStdout}
          displayConfig={displayConfig}
          workflowState={workflowState}
          headerProps={{
            terminalRows,
            version: CLI_VERSION,
            PWD,
            approvalPolicy,
            colorsByPolicy: colorsByPolicy as unknown as Record<
              string,
              string | undefined
            >,
            headers,
            statusLine,
            workflowHeader: props.multiWorkflow
              ? (activeInstanceTitle as unknown as React.ReactNode) ||
                displayConfig?.header ||
                "Codex SDK"
              : displayConfig?.header || "Codex SDK",
          }}
        />
        <InputRegion
          overlayMode={overlayMode}
          quickSlashBuffer={quickSlashBuffer}
          setQuickSlashBuffer={setQuickSlashBuffer}
          workflowState={workflowState}
          workflow={workflow}
          loading={loading}
          statusLine={statusLine}
          confirmationPrompt={confirmationPrompt}
          explanation={explanation}
          submitConfirmation={submitConfirmation}
          inputDisabled={inputDisabled}
          inputSetterRef={inputSetterRef}
          smartSetState={(updater) => smartSetState(updater)}
          setOverlayMode={setOverlayMode as unknown as (mode: string) => void}
          selectionState={selectionState}
          setSelectionState={setSelectionState}
          selectionBackupRef={selectionBackupRef}
          openSelection={openSelectionStable}
          multiWorkflow={Boolean(props.multiWorkflow)}
          listInstances={() =>
            multiWorkflowMgr
              .listInstances()
              .map((w) => ({ id: w.id, title: w.title, isActive: w.isActive }))
          }
          activeWorkflowId={multiWorkflowMgr.activeWorkflowId}
          switchToInstance={multiWorkflowMgr.switchToInstance}
          removeActiveGraceful={() =>
            multiWorkflowMgr.activeWorkflowId &&
            multiWorkflowMgr.removeInstance(multiWorkflowMgr.activeWorkflowId, {
              graceful: true,
            })
          }
          removeActiveForce={() =>
            multiWorkflowMgr.activeWorkflowId &&
            multiWorkflowMgr.removeInstance(multiWorkflowMgr.activeWorkflowId, {
              force: true,
            })
          }
        />
        <OverlayRouter
          overlayMode={overlayMode}
          setOverlayMode={setOverlayMode}
          items={items}
          approvalPolicy={approvalPolicy}
          onSelectApproval={(newMode) => setApprovalPolicy(newMode)}
          selectionState={selectionState}
          selectionSuppressed={
            quickSlashBuffer != null &&
            selectionState === selectionBackupRef.current
          }
          promptState={promptState}
          confirmationState={confirmationState}
          workflowPickerState={workflowPickerState}
          workflow={workflow}
          availableWorkflows={
            props.multiWorkflow
              ? props.availableWorkflows.map((f: WorkflowFactoryWithTitle) => ({
                  title: f.title,
                  factory: f,
                }))
              : props.workflowFactory
                ? [
                    {
                      title: "Default Workflow",
                      factory: props.workflowFactory,
                    },
                  ]
                : []
          }
          onCreateFromLauncher={(factory) => {
            if (props.multiWorkflow) {
              multiWorkflowMgr.createInstance(
                factory as WorkflowFactoryWithTitle,
                { activate: true },
              );
            } else {
              // In single workflow mode, we don't actually create a new workflow
              // The launcher just closes - the workflow creation is handled by the parent
              // This allows the /new command to work but doesn't actually change workflows
            }
            setOverlayMode("none");
            // Clear backup on successful launcher completion
            selectionBackupRef.current = null;
            setQuickSlashBuffer(null);
          }}
        />

        {/* selection overlay status line */}
        {overlayMode === "selection" &&
          (workflowState.statusLine || statusLine) && (
            <Box flexDirection="column" marginTop={1}>
              {workflowState.statusLine && (
                <Box marginBottom={0}>{workflowState.statusLine}</Box>
              )}
              {statusLine && (
                <Box paddingX={2} marginBottom={1}>
                  <Text dimColor>{statusLine}</Text>
                </Box>
              )}
            </Box>
          )}
      </Box>

      {/* Manager Slot: Below Workflow */}
      <ManagerSlot
        enabled={Boolean(props.multiWorkflow)}
        region="belowWorkflow"
        managerSlots={multiWorkflowMgr.managerSlots}
        workflowState={workflowState}
      />
    </Box>
  );
}
