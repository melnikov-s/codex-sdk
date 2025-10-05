import type { ApprovalPolicy } from "./approvals";
import type { LibraryConfig } from "./utils/workflow-config.js";
import type { WorkflowController, WorkflowFactory } from "./workflow";
import type { WorkflowManager } from "./workflow/manager-types.js";
import type {
  AvailableWorkflow,
  InitialWorkflowRef,
} from "./workflow/multi-types.js";

import { AppPaletteOverlay } from "./components/AppPaletteOverlay.js";
import { ApprovalPolicyOverlay } from "./components/ApprovalPolicyOverlay.js";
import { HeaderSection } from "./components/HeaderSection.js";
import { WorkflowPickerOverlay } from "./components/WorkflowPickerOverlay.js";
import { WorkflowSwitcherOverlay } from "./components/WorkflowSwitcherOverlay.js";
import { WorkflowTerminals } from "./components/WorkflowTerminals.js";
import { TerminalTabs } from "./components/terminal-tabs";
import { useAppCommands } from "./hooks/use-app-commands.js";
import { useAppHotkeys } from "./hooks/use-app-hotkeys.js";
import { useManagerBridge } from "./hooks/use-manager-bridge.js";
import { useOverlays } from "./hooks/use-overlays.js";
import { useTerminalSize } from "./hooks/use-terminal-size";
import { useWorkflowNavigation } from "./hooks/use-workflow-navigation.js";
import { useWorkflows } from "./hooks/use-workflows.js";
import { colorsByPolicy } from "./utils/approval-colors.js";
import { CLI_VERSION } from "./utils/session.js";
import { shortCwd } from "./utils/short-path.js";
import { clearTerminal } from "./utils/terminal.js";
import { resolveHeaders, resolveStatusLine } from "./utils/ui-config.js";
import { generateWorkflowId } from "./utils/workflow-ids.js";
import { useStdin, Box, Text } from "ink";
import React, { useState, useCallback, useMemo } from "react";

type Props = {
  approvalPolicy: ApprovalPolicy;
  additionalWritableRoots: ReadonlyArray<string>;
  fullStdout: boolean;
  workflows?: Array<AvailableWorkflow>;
  initialWorkflows?: Array<InitialWorkflowRef>;
  workflowFactory?: WorkflowFactory;
  uiConfig?: LibraryConfig;
  onController?: (controller: WorkflowController) => void;
  title?: React.ReactNode;
  workflowManager?: WorkflowManager;
};

export default function App({
  approvalPolicy,
  additionalWritableRoots,
  fullStdout,
  workflows,
  initialWorkflows,
  workflowFactory,
  uiConfig,
  onController,
  title,
  workflowManager,
}: Props): JSX.Element {
  const { internal_eventEmitter } = useStdin();
  internal_eventEmitter.setMaxListeners(20);

  // Terminal header data
  const { rows: terminalRows } = useTerminalSize();
  const PWD = shortCwd();
  const headers = useMemo(() => resolveHeaders(uiConfig), [uiConfig]);

  // Normalize workflows into availableWorkflows
  const availableWorkflows: Array<AvailableWorkflow> = useMemo(() => {
    if (workflows) {
      return workflows;
    }
    if (workflowFactory) {
      return [workflowFactory];
    }
    return [];
  }, [workflows, workflowFactory]);

  // Workflow management
  const {
    currentWorkflows,
    activeWorkflowId,
    setActiveWorkflowId,
    createWorkflow,
    closeWorkflow,
    switchToWorkflow,
    handleTitleChange,
    handleDisplayConfigChange,
    handleLoadingStateChange,
    handleController,
    workflowInstancesRef,
  } = useWorkflows({
    availableWorkflows,
    initialWorkflows,
  });

  // Workflow navigation
  const {
    switchToNextWorkflow,
    switchToPreviousWorkflow,
    switchToNextNonLoading,
  } = useWorkflowNavigation({
    currentWorkflows,
    activeWorkflowId,
    setActiveWorkflowId,
  });

  // Overlay management
  const {
    showWorkflowPicker,
    showWorkflowSwitcher,
    showApprovalOverlay,
    showAppPalette,
    openWorkflowPicker,
    closeWorkflowPicker,
    openWorkflowSwitcher,
    closeWorkflowSwitcher,
    openApprovalOverlay,
    closeApprovalOverlay,
    openAppPalette,
    closeAppPalette,
    handlePickerSelection,
    handleSwitcherSelection,
    handleApprovalSelection,
  } = useOverlays();

  const smartCreateNewWorkflow = useCallback(() => {
    if (availableWorkflows.length === 1) {
      const workflow = availableWorkflows[0];
      if (workflow) {
        const selectedWorkflow = availableWorkflows.find(
          (w) => generateWorkflowId(w) === generateWorkflowId(workflow),
        );
        if (selectedWorkflow) {
          createWorkflow(selectedWorkflow, { activate: true });
        }
      }
    } else {
      openWorkflowPicker();
    }
  }, [availableWorkflows, createWorkflow, openWorkflowPicker]);

  // Hotkeys and commands
  const allHotkeys = useAppHotkeys({
    currentWorkflows,
    activeWorkflowId,
    switchToWorkflow,
    switchToNextWorkflow,
    switchToPreviousWorkflow,
    switchToNextNonLoading,
    openWorkflowPicker: smartCreateNewWorkflow,
    openAppPalette,
    createNewWorkflow: smartCreateNewWorkflow,
  });

  const appCommands = useAppCommands({
    currentWorkflowsLength: currentWorkflows.length,
    availableWorkflowsLength: availableWorkflows.length,
    switchToNextWorkflow,
    switchToPreviousWorkflow,
    openWorkflowSwitcher,
    openWorkflowPicker: smartCreateNewWorkflow,
    closeAppPalette,
    openApprovalOverlay,
  });

  const handleControllerWithCallback = useCallback(
    (controller: WorkflowController, workflowId: string) => {
      handleController(controller, workflowId);
      onController?.(controller);
    },
    [handleController, onController],
  );

  const [currentApprovalPolicy, setCurrentApprovalPolicy] =
    useState<ApprovalPolicy>(approvalPolicy);

  // Workflow Manager Integration
  const [managerTitle, setManagerTitle] = useState<React.ReactNode>(title);

  // Manager bridge to wire up events and state updaters
  useManagerBridge({
    manager: workflowManager,
    currentWorkflows,
    activeWorkflowId,
    createWorkflow,
    closeWorkflow,
    switchToWorkflow,
    switchToNextWorkflow,
    switchToPreviousWorkflow,
    switchToNextNonLoading,
    workflowInstancesRef,
    managerTitle,
    setManagerTitle,
    currentApprovalPolicy,
    setCurrentApprovalPolicy,
  });

  const openWorkflowPickerIfWorkflows = useCallback(() => {
    if (currentWorkflows.length > 0) {
      openWorkflowSwitcher();
    }
  }, [currentWorkflows.length, openWorkflowSwitcher]);

  const handleSwitcherSelectionWithTerminal = useCallback(
    (workflowId: string) => {
      clearTerminal();
      handleSwitcherSelection(workflowId, setActiveWorkflowId);
    },
    [handleSwitcherSelection, setActiveWorkflowId],
  );

  const handleApprovalPolicyChangeWithOverlay = useCallback(
    (newPolicy: ApprovalPolicy) => {
      setCurrentApprovalPolicy(newPolicy);
      handleApprovalSelection(newPolicy, () => {
        // Update policy for all active workflows
        currentWorkflows.forEach((workflow) => {
          const state = workflow.controller?.getState();
          if (state) {
            // Use workflow's approval API to update its policy
            workflow.controller?.getState()?.approvalPolicy;
            // Note: This is a limitation - we can't directly update individual workflow policies
            // from the app level without exposing a setApprovalPolicy method on WorkflowController
          }
        });
      });
    },
    [currentWorkflows, handleApprovalSelection],
  );

  const handlePickerSelectionWithWorkflow = useCallback(
    (workflowId: string) => {
      handlePickerSelection(workflowId, (selectedId) => {
        const selectedWorkflow = availableWorkflows.find(
          (w) => generateWorkflowId(w) === selectedId,
        );
        if (selectedWorkflow) {
          createWorkflow(selectedWorkflow, { activate: true });
        }
      });
    },
    [availableWorkflows, createWorkflow, handlePickerSelection],
  );

  const handleWorkflowSelection = useCallback(
    (workflowId: string) => {
      const selectedWorkflow = availableWorkflows.find(
        (w) => generateWorkflowId(w) === workflowId,
      );
      if (selectedWorkflow) {
        createWorkflow(selectedWorkflow, { activate: true });
      }
    },
    [availableWorkflows, createWorkflow],
  );

  if (currentWorkflows.length === 0) {
    if (availableWorkflows.length === 0) {
      return (
        <Box>
          <Text>No workflows available.</Text>
        </Box>
      );
    }

    if (availableWorkflows.length === 1) {
      const workflow = availableWorkflows[0];
      if (workflow) {
        handleWorkflowSelection(generateWorkflowId(workflow));
        return (
          <Box>
            <Text>Starting workflow...</Text>
          </Box>
        );
      }
    }

    return (
      <Box flexDirection="column" alignItems="flex-start" width="100%">
        <WorkflowPickerOverlay
          title={managerTitle}
          terminalRows={terminalRows}
          version={CLI_VERSION}
          PWD={PWD}
          approvalPolicy={currentApprovalPolicy}
          colorsByPolicy={colorsByPolicy}
          headers={headers}
          availableHotkeys={allHotkeys}
          availableWorkflows={availableWorkflows}
          onSelect={handleWorkflowSelection}
          onCancel={() => {}}
          isActive={true}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" alignItems="flex-start">
      {!showWorkflowPicker &&
        !showWorkflowSwitcher &&
        !showApprovalOverlay &&
        currentWorkflows.length > 0 && (
          <HeaderSection
            title={managerTitle}
            terminalRows={terminalRows}
            version={CLI_VERSION}
            PWD={PWD}
            approvalPolicy={currentApprovalPolicy}
            colorsByPolicy={colorsByPolicy}
            headers={headers}
            workflowHeader={String(
              currentWorkflows.find((w) => w.id === activeWorkflowId)
                ?.displayConfig?.header ||
                currentWorkflows.find((w) => w.id === activeWorkflowId)?.factory
                  .meta?.title ||
                "Untitled Workflow",
            )}
          />
        )}
      <WorkflowTerminals
        currentWorkflows={currentWorkflows}
        activeWorkflowId={activeWorkflowId}
        visible={
          !showWorkflowPicker &&
          !showWorkflowSwitcher &&
          !showAppPalette &&
          !showApprovalOverlay
        }
        approvalPolicy={currentApprovalPolicy}
        additionalWritableRoots={additionalWritableRoots}
        fullStdout={fullStdout}
        uiConfig={uiConfig}
        onController={handleControllerWithCallback}
        onTitleChange={handleTitleChange}
        onDisplayConfigChange={handleDisplayConfigChange}
        onLoadingStateChange={handleLoadingStateChange}
        openWorkflowPicker={openWorkflowPickerIfWorkflows}
        createNewWorkflow={openWorkflowPicker}
        isMulti={currentWorkflows.length > 1}
      />

      {/* Global command palette overlay */}
      {showAppPalette && (
        <AppPaletteOverlay commands={appCommands} onClose={closeAppPalette} />
      )}

      {/* Workflow picker overlay */}
      {showWorkflowPicker && availableWorkflows.length > 0 && (
        <WorkflowPickerOverlay
          title={managerTitle}
          terminalRows={terminalRows}
          version={CLI_VERSION}
          PWD={PWD}
          approvalPolicy={currentApprovalPolicy}
          colorsByPolicy={colorsByPolicy}
          headers={headers}
          availableHotkeys={allHotkeys}
          availableWorkflows={availableWorkflows}
          onSelect={handlePickerSelectionWithWorkflow}
          onCancel={closeWorkflowPicker}
          isActive={!showAppPalette}
        />
      )}

      {/* Workflow switcher overlay */}
      {showWorkflowSwitcher && currentWorkflows.length > 0 && (
        <WorkflowSwitcherOverlay
          title={managerTitle}
          terminalRows={terminalRows}
          version={CLI_VERSION}
          PWD={PWD}
          approvalPolicy={currentApprovalPolicy}
          colorsByPolicy={colorsByPolicy}
          headers={headers}
          availableHotkeys={allHotkeys}
          currentWorkflows={currentWorkflows}
          availableWorkflows={availableWorkflows}
          activeWorkflowId={activeWorkflowId}
          onSelect={(value) => {
            if (value === "__create_new__") {
              closeWorkflowSwitcher();
              if (availableWorkflows.length === 1) {
                const workflow = availableWorkflows[0];
                if (workflow) {
                  handleWorkflowSelection(generateWorkflowId(workflow));
                }
              } else {
                openWorkflowPicker();
              }
            } else if (value === "__close_current__") {
              closeWorkflowSwitcher();
              const toCloseId = activeWorkflowId;
              if (toCloseId) {
                closeWorkflow(toCloseId);
              }
            } else {
              handleSwitcherSelectionWithTerminal(value);
            }
          }}
          onCancel={closeWorkflowSwitcher}
          isActive={!showAppPalette}
        />
      )}

      {/* Global approval policy overlay */}
      {showApprovalOverlay && (
        <ApprovalPolicyOverlay
          title={managerTitle}
          terminalRows={terminalRows}
          version={CLI_VERSION}
          PWD={PWD}
          approvalPolicy={currentApprovalPolicy}
          colorsByPolicy={colorsByPolicy}
          headers={headers}
          availableHotkeys={allHotkeys}
          onSelect={(policyValue: string) =>
            handleApprovalPolicyChangeWithOverlay(policyValue as ApprovalPolicy)
          }
          onCancel={closeApprovalOverlay}
          isActive={!showAppPalette}
        />
      )}

      {/* Tabs at the bottom - show when multiple workflows are active and no overlays are active */}
      {currentWorkflows.length > 1 &&
        !showWorkflowPicker &&
        !showWorkflowSwitcher &&
        !showAppPalette &&
        !showApprovalOverlay && (
          <TerminalTabs
            tabs={currentWorkflows.map((workflow) => ({
              id: workflow.id,
              title: workflow.displayTitle,
              isActive: workflow.id === activeWorkflowId,
              isLoading: workflow.isLoading || false,
            }))}
            onTabClick={(workflowId: string) => {
              clearTerminal();
              setActiveWorkflowId(workflowId);
            }}
            displayConfig={
              currentWorkflows.find((w) => w.id === activeWorkflowId)
                ?.displayConfig
            }
            workflowStatus={resolveStatusLine(uiConfig)}
            availableHotkeys={allHotkeys}
          />
        )}
    </Box>
  );
}
