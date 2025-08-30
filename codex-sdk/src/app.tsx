import type { ApprovalPolicy } from "./approvals";
import type { CustomizableHotkeyConfig } from "./hooks/use-customizable-hotkeys.js";
import type {
  LibraryConfig,
  WorkflowManager,
  WorkflowInstance,
} from "./lib.js";
import type {
  DisplayConfig,
  WorkflowController,
  WorkflowFactory,
  WorkflowState,
} from "./workflow";
import type { ModelMessage } from "ai";

import AppCommandPalette, {
  type AppCommand,
} from "./components/app-command-palette.js";
import AppHeader from "./components/chat/app-header";
import TerminalChat from "./components/chat/terminal-chat";
import WorkflowHeader from "./components/chat/workflow-header";
import { TerminalTabs } from "./components/terminal-tabs";
import { WorkflowOverlay } from "./components/workflow-overlay";
import { useGlobalHotkeys } from "./hooks/use-global-hotkeys.js";
import { useMultiWorkflowHotkeys } from "./hooks/use-multi-workflow-hotkeys";
import { useTerminalSize } from "./hooks/use-terminal-size";
import { getEnabledAppCommands } from "./utils/app-commands.js";
import { CLI_VERSION } from "./utils/session.js";
import { shortCwd } from "./utils/short-path.js";
import { clearTerminal } from "./utils/terminal.js";
import { resolveHeaders, resolveStatusLine } from "./utils/ui-config.js";
import { useStdin, Box, Text } from "ink";
import React, { useState, useCallback, useMemo } from "react";

export type AvailableWorkflow = WorkflowFactory;
export type InitialWorkflowRef = { id: string } | WorkflowFactory;

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

type CurrentWorkflow = {
  id: string;
  factoryId: string;
  factory: WorkflowFactory;
  instanceIndex: number;
  displayTitle: string;
  controller?: WorkflowController;
  displayConfig?: DisplayConfig;
  isLoading?: boolean;
};

type ExtendedWorkflowInstance = WorkflowInstance & {
  _updateController: (newController: WorkflowController) => void;
};

type AppStateUpdaters = {
  setTitle: (title: React.ReactNode) => void;
  setApprovalPolicy: (policy: ApprovalPolicy) => void;
  setConfig: (config: LibraryConfig) => void;
  updateHotkeyConfig: (config: Partial<CustomizableHotkeyConfig>) => void;
  createWorkflow: (
    factory: WorkflowFactory,
    options?: { activate?: boolean },
  ) => Promise<{
    title: string;
    factory: WorkflowFactory;
    isActive: boolean;
    state: WorkflowState;
    setState: (
      state: Partial<WorkflowState> | ((prev: WorkflowState) => WorkflowState),
    ) => Promise<void>;
    getState: () => WorkflowState;
    message: (input: string | ModelMessage) => void;
    stop: () => void;
    terminate: () => void;
    isLoading: boolean;
    _updateController: (newController: WorkflowController) => void;
  }>;
  closeWorkflow: (workflow: {
    title: string;
    factory: WorkflowFactory;
  }) => Promise<boolean>;
  switchToWorkflow: (workflow: {
    title: string;
    factory: WorkflowFactory;
  }) => Promise<boolean>;
  getActiveWorkflow: () => {
    title: string;
    factory: WorkflowFactory;
    isActive: boolean;
    state: WorkflowState;
    setState: (
      state: Partial<WorkflowState> | ((prev: WorkflowState) => WorkflowState),
    ) => Promise<void>;
    getState: () => WorkflowState;
    message: (input: string | ModelMessage) => void;
    stop: () => void;
    terminate: () => void;
    isLoading: boolean;
  } | null;
  switchToNextWorkflow: () => boolean;
  switchToPreviousWorkflow: () => boolean;
  switchToNextNonLoadingWorkflow: () => boolean;
};

// Helper function to generate stable IDs from workflow factories
function generateWorkflowId(factory: WorkflowFactory): string {
  // Use meta.id if available, otherwise derive from title, otherwise use a default
  if (factory.meta?.id) {
    return factory.meta.id;
  }
  if (factory.meta?.title) {
    return factory.meta.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  return "untitled-workflow";
}

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

  const colorsByPolicy = {
    "suggest": undefined,
    "auto-edit": "green" as const,
    "full-auto": "green" as const,
  };

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

  const [currentWorkflows, setCurrentWorkflows] = useState<
    Array<CurrentWorkflow>
  >([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>("");

  // Compute display titles with disambiguation
  const computeDisplayTitles = useCallback(
    (workflows: Array<CurrentWorkflow>): Array<CurrentWorkflow> => {
      const titleCounts = new Map<string, number>();
      const titleIndexes = new Map<string, number>();

      workflows.forEach((workflow) => {
        const baseTitle = workflow.factory.meta?.title || "Untitled";
        titleCounts.set(baseTitle, (titleCounts.get(baseTitle) || 0) + 1);
      });

      return workflows.map((workflow) => {
        const baseTitle = workflow.factory.meta?.title || "Untitled";
        const count = titleCounts.get(baseTitle) || 1;

        if (count === 1) {
          return { ...workflow, displayTitle: baseTitle };
        } else {
          const currentIndex = (titleIndexes.get(baseTitle) || 0) + 1;
          titleIndexes.set(baseTitle, currentIndex);
          return { ...workflow, displayTitle: `${baseTitle} #${currentIndex}` };
        }
      });
    },
    [],
  );

  const handleTitleChange = useCallback((id: string, title: string) => {
    setCurrentWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, displayTitle: title } : w)),
    );
  }, []);

  const handleDisplayConfigChange = useCallback(
    (id: string, displayConfig?: DisplayConfig) => {
      setCurrentWorkflows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, displayConfig } : w)),
      );
    },
    [],
  );

  const handleLoadingStateChange = useCallback(
    (id: string, isLoading: boolean) => {
      setCurrentWorkflows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, isLoading } : w)),
      );
    },
    [],
  );

  const handleController = useCallback(
    (controller: WorkflowController, workflowId: string) => {
      setCurrentWorkflows((prev) => {
        const updated = prev.map((w) =>
          w.id === workflowId ? { ...w, controller } : w,
        );

        // Update stored workflow instances with new controller
        const storedInstance = workflowInstancesRef.current.get(workflowId);
        if (storedInstance) {
          storedInstance._updateController(controller);
        }

        return updated;
      });
      onController?.(controller);
    },
    [onController],
  );

  const switchToNextWorkflow = useCallback(() => {
    if (currentWorkflows.length <= 1) {
      return;
    }
    clearTerminal();
    const currentIndex = currentWorkflows.findIndex(
      (w) => w.id === activeWorkflowId,
    );
    const nextIndex = (currentIndex + 1) % currentWorkflows.length;
    setActiveWorkflowId(currentWorkflows[nextIndex]?.id || "");
  }, [currentWorkflows, activeWorkflowId]);

  const switchToPreviousWorkflow = useCallback(() => {
    if (currentWorkflows.length <= 1) {
      return;
    }
    clearTerminal();
    const currentIndex = currentWorkflows.findIndex(
      (w) => w.id === activeWorkflowId,
    );
    const prevIndex =
      (currentIndex - 1 + currentWorkflows.length) % currentWorkflows.length;
    setActiveWorkflowId(currentWorkflows[prevIndex]?.id || "");
  }, [currentWorkflows, activeWorkflowId]);

  const switchToNextNonLoading = useCallback(() => {
    if (currentWorkflows.length <= 1) {
      return false;
    }

    const nonLoadingWorkflows = currentWorkflows.filter((w) => !w.isLoading);
    if (nonLoadingWorkflows.length === 0) {
      return false;
    }

    clearTerminal();
    const currentIndex = nonLoadingWorkflows.findIndex(
      (w) => w.id === activeWorkflowId,
    );

    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % nonLoadingWorkflows.length;

    setActiveWorkflowId(nonLoadingWorkflows[nextIndex]?.id || "");
    return true;
  }, [currentWorkflows, activeWorkflowId]);

  const [showWorkflowSwitcher, setShowWorkflowSwitcher] = useState(false);
  const [showApprovalOverlay, setShowApprovalOverlay] = useState(false);
  const [currentApprovalPolicy, setCurrentApprovalPolicy] =
    useState<ApprovalPolicy>(approvalPolicy);

  const openWorkflowPicker = useCallback(() => {
    if (currentWorkflows.length > 0) {
      setShowWorkflowSwitcher(true);
    }
  }, [currentWorkflows.length]);

  const handleSwitcherSelection = useCallback((workflowId: string) => {
    clearTerminal();
    setShowWorkflowSwitcher(false);
    setActiveWorkflowId(workflowId);
  }, []);

  const handleSwitcherCancel = useCallback(() => {
    setShowWorkflowSwitcher(false);
  }, []);

  const handleApprovalPolicyChange = useCallback(
    (newPolicy: ApprovalPolicy) => {
      setCurrentApprovalPolicy(newPolicy);
      setShowApprovalOverlay(false);
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
    },
    [currentWorkflows],
  );

  const [showWorkflowPicker, setShowWorkflowPicker] = useState(false);
  const [showAppPalette, setShowAppPalette] = useState(false);

  const createNewWorkflow = useCallback(() => {
    setShowWorkflowPicker(true);
  }, []);

  const handlePickerSelection = useCallback(
    (workflowId: string) => {
      setShowWorkflowPicker(false);
      const selectedWorkflow = availableWorkflows.find(
        (w) => generateWorkflowId(w) === workflowId,
      );
      if (selectedWorkflow) {
        const factoryId = generateWorkflowId(selectedWorkflow);
        const id = `${factoryId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newWorkflow: CurrentWorkflow = {
          id,
          factoryId,
          factory: selectedWorkflow,
          instanceIndex: currentWorkflows.filter(
            (w) => w.factoryId === factoryId,
          ).length,
          displayTitle: selectedWorkflow.meta?.title || "Untitled",
        };

        setCurrentWorkflows((prev) => {
          const updated = [...prev, newWorkflow];
          return computeDisplayTitles(updated);
        });
        setActiveWorkflowId(id);
      }
    },
    [availableWorkflows, currentWorkflows, computeDisplayTitles],
  );

  const handlePickerCancel = useCallback(() => {
    setShowWorkflowPicker(false);
  }, []);

  // Workflow Manager Integration
  const [managerTitle, setManagerTitle] = useState<React.ReactNode>(title);

  // Store workflow instances by ID for direct access
  const workflowInstancesRef = React.useRef<
    Map<string, ExtendedWorkflowInstance>
  >(new Map());

  // Set up manager state updaters
  React.useEffect(() => {
    if (workflowManager && "_setAppStateUpdaters" in workflowManager) {
      const manager = workflowManager as WorkflowManager & {
        _setAppStateUpdaters: (updaters: AppStateUpdaters) => void;
      };
      manager._setAppStateUpdaters({
        setTitle: setManagerTitle,
        setApprovalPolicy: setCurrentApprovalPolicy,
        setConfig: (_config: LibraryConfig) => {
          // Config updates will be handled when we implement full config management
        },
        updateHotkeyConfig: (_config: Partial<CustomizableHotkeyConfig>) => {
          // Update hotkey config through context
          // This will be implemented when we update the hotkey integration
        },
        createWorkflow: async (
          factory: WorkflowFactory,
          options?: { activate?: boolean },
        ) => {
          const factoryId = generateWorkflowId(factory);
          const id = `${factoryId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newWorkflow: CurrentWorkflow = {
            id,
            factoryId,
            factory,
            instanceIndex: currentWorkflows.filter(
              (w) => w.factoryId === factoryId,
            ).length,
            displayTitle: factory.meta?.title || "Untitled",
          };

          // Create a WorkflowInstance with mutable controller reference
          let controller: WorkflowController | undefined = undefined;

          const workflowInstance = {
            title: newWorkflow.displayTitle,
            factory: newWorkflow.factory,
            get isActive(): boolean {
              return activeWorkflowId === id;
            },
            get state(): WorkflowState {
              return (
                controller?.getState() || {
                  loading: false,
                  messages: [],
                  inputDisabled: false,
                  queue: [],
                  taskList: [],
                }
              );
            },
            setState: async (
              state:
                | Partial<WorkflowState>
                | ((prev: WorkflowState) => WorkflowState),
            ) => {
              if (controller?.setState) {
                await controller.setState(state);
              }
            },
            getState: (): WorkflowState => {
              return (
                controller?.getState() || {
                  loading: false,
                  messages: [],
                  inputDisabled: false,
                  queue: [],
                  taskList: [],
                }
              );
            },
            message: (input: string | ModelMessage) => {
              if (controller) {
                controller.message(input);
              }
            },
            stop: () => {
              if (controller) {
                controller.stop();
              }
            },
            terminate: () => {
              if (controller) {
                controller.terminate();
              }
            },
            get isLoading(): boolean {
              const workflow = currentWorkflows.find((w) => w.id === id);
              return workflow?.isLoading || false;
            },
            _updateController: (newController: WorkflowController) => {
              controller = newController;
            },
          };

          // Store the workflow instance for controller updates
          workflowInstancesRef.current.set(
            id,
            workflowInstance as ExtendedWorkflowInstance,
          );

          setCurrentWorkflows((prev) => {
            const updated = [...prev, newWorkflow];
            return computeDisplayTitles(updated);
          });

          if (options?.activate) {
            setActiveWorkflowId(id);
          }

          return workflowInstance;
        },
        closeWorkflow: async (workflow: {
          title: string;
          factory: WorkflowFactory;
        }) => {
          const workflowToClose = currentWorkflows.find(
            (w) =>
              w.displayTitle === workflow.title &&
              w.factory === workflow.factory,
          );
          if (workflowToClose) {
            setCurrentWorkflows((prev) =>
              prev.filter((w) => w.id !== workflowToClose.id),
            );
            if (
              activeWorkflowId === workflowToClose.id &&
              currentWorkflows.length > 1
            ) {
              const remaining = currentWorkflows.filter(
                (w) => w.id !== workflowToClose.id,
              );
              setActiveWorkflowId(remaining[0]?.id || "");
            }
            return true;
          }
          return false;
        },
        switchToWorkflow: async (workflow: {
          title: string;
          factory: WorkflowFactory;
        }) => {
          const workflowToSwitch = currentWorkflows.find(
            (w) =>
              w.displayTitle === workflow.title &&
              w.factory === workflow.factory,
          );
          if (workflowToSwitch) {
            clearTerminal();
            setActiveWorkflowId(workflowToSwitch.id);
            return true;
          }
          return false;
        },
        getActiveWorkflow: () => {
          const activeWorkflow = currentWorkflows.find(
            (w) => w.id === activeWorkflowId,
          );
          if (!activeWorkflow) {
            return null;
          }

          return {
            title: activeWorkflow.displayTitle,
            factory: activeWorkflow.factory,
            isActive: true,
            get state(): WorkflowState {
              return (
                activeWorkflow.controller?.getState() || {
                  loading: false,
                  messages: [],
                  inputDisabled: false,
                  queue: [],
                  taskList: [],
                }
              );
            },
            setState: async (
              state:
                | Partial<WorkflowState>
                | ((prev: WorkflowState) => WorkflowState),
            ) => {
              if (activeWorkflow.controller?.setState) {
                await activeWorkflow.controller.setState(state);
              }
            },
            getState: (): WorkflowState =>
              activeWorkflow.controller?.getState() || {
                loading: false,
                messages: [],
                inputDisabled: false,
                queue: [],
                taskList: [],
              },
            message: (input: string | ModelMessage) => {
              if (activeWorkflow.controller) {
                activeWorkflow.controller.message(input);
              }
            },
            stop: () => {
              if (activeWorkflow.controller) {
                activeWorkflow.controller.stop();
              }
            },
            terminate: () => {
              if (activeWorkflow.controller) {
                activeWorkflow.controller.terminate();
              }
            },
            get isLoading(): boolean {
              return activeWorkflow.isLoading || false;
            },
          };
        },
        switchToNextWorkflow: () => {
          switchToNextWorkflow();
          return true;
        },
        switchToPreviousWorkflow: () => {
          switchToPreviousWorkflow();
          return true;
        },
        switchToNextNonLoadingWorkflow: () => {
          return switchToNextNonLoading();
        },
      });
    }
  }, [
    workflowManager,
    currentWorkflows,
    activeWorkflowId,
    switchToNextWorkflow,
    switchToPreviousWorkflow,
    switchToNextNonLoading,
    computeDisplayTitles,
  ]);

  // Hotkeys setup
  const { hotkeys: workflowHotkeys } = useMultiWorkflowHotkeys({
    workflows: currentWorkflows.map(({ id, displayTitle }) => ({
      id,
      title: displayTitle,
    })),
    activeWorkflowId,
    switchToWorkflow: (workflowId: string) => {
      clearTerminal();
      setActiveWorkflowId(workflowId);
    },
    switchToNextWorkflow,
    switchToPreviousWorkflow,
    switchToNextAttention: () => false,
    switchToNextNonLoading,
    openWorkflowPicker,
    createNewWorkflow,
    killCurrentWorkflow: () => {},
    emergencyExit: () => {},
  });

  // Global app palette hotkeys (Cmd/Ctrl+K, Cmd/Ctrl+Shift+P, F1)
  const appHotkeys = [
    {
      key: "k",
      ctrl: true,
      action: () => {
        clearTerminal();
        setShowAppPalette(true);
      },
      description: "App commands",
    },
  ];
  useGlobalHotkeys({
    hotkeys: appHotkeys,
    enabled: true,
  });

  const allHotkeys = [...workflowHotkeys, ...appHotkeys];

  const appCommands: Array<AppCommand> = useMemo(() => {
    const defs = [
      {
        id: "workflow.switch",
        title: "Switch workflow…",
        run: () => setShowWorkflowSwitcher(true),
        disabled: () => currentWorkflows.length === 0,
      },
      {
        id: "workflow.new",
        title: "Create new workflow…",
        run: () => setShowWorkflowPicker(true),
      },

      {
        id: "workflow.next",
        title: "Next workflow",
        run: () => switchToNextWorkflow(),
        disabled: () => currentWorkflows.length <= 1,
      },
      {
        id: "workflow.prev",
        title: "Previous workflow",
        run: () => switchToPreviousWorkflow(),
        disabled: () => currentWorkflows.length <= 1,
      },
      {
        id: "app.approval",
        title: "Change approval policy…",
        run: () => {
          setShowAppPalette(false);
          setShowApprovalOverlay(true);
        },
      },
    ];
    return getEnabledAppCommands(defs).map(({ id, title, run }) => ({
      id,
      title,
      run,
    }));
  }, [currentWorkflows.length, switchToNextWorkflow, switchToPreviousWorkflow]);

  // Initialize workflows on mount
  React.useEffect(() => {
    if (currentWorkflows.length > 0) {
      return;
    }

    if (initialWorkflows && initialWorkflows.length > 0) {
      const newWorkflows: Array<CurrentWorkflow> = [];
      initialWorkflows.forEach((ref) => {
        if ("id" in ref) {
          // Find workflow by generated ID
          const available = availableWorkflows.find(
            (w) => generateWorkflowId(w) === ref.id,
          );
          if (available) {
            const factoryId = generateWorkflowId(available);
            const id = `${factoryId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            newWorkflows.push({
              id,
              factoryId,
              factory: available,
              instanceIndex: 0,
              displayTitle: available.meta?.title || "Untitled",
            });
          }
        } else {
          // Direct factory reference
          const factory = ref;
          const factoryId = generateWorkflowId(factory);
          const id = `${factoryId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          newWorkflows.push({
            id,
            factoryId,
            factory,
            instanceIndex: 0,
            displayTitle: factory.meta?.title || "Untitled",
          });
        }
      });

      if (newWorkflows.length > 0) {
        setCurrentWorkflows(computeDisplayTitles(newWorkflows));
        setActiveWorkflowId(newWorkflows[0]?.id || "");
      }
    }
    // If no initial workflows specified and we have available workflows,
    // start with empty state - user will use /new or workflow picker to create workflows
  }, [
    availableWorkflows,
    initialWorkflows,
    currentWorkflows.length,
    computeDisplayTitles,
  ]);

  const handleWorkflowSelection = useCallback(
    (workflowId: string) => {
      const selectedWorkflow = availableWorkflows.find(
        (w) => generateWorkflowId(w) === workflowId,
      );
      if (selectedWorkflow) {
        const factoryId = generateWorkflowId(selectedWorkflow);
        const id = `${factoryId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newWorkflow: CurrentWorkflow = {
          id,
          factoryId,
          factory: selectedWorkflow,
          instanceIndex: currentWorkflows.filter(
            (w) => w.factoryId === factoryId,
          ).length,
          displayTitle: selectedWorkflow.meta?.title || "Untitled",
        };

        setCurrentWorkflows((prev) => {
          const updated = [...prev, newWorkflow];
          return computeDisplayTitles(updated);
        });
        setActiveWorkflowId(id);
      }
    },
    [availableWorkflows, currentWorkflows, computeDisplayTitles],
  );

  if (currentWorkflows.length === 0) {
    if (availableWorkflows.length === 0) {
      return (
        <Box>
          <Text>No workflows available.</Text>
        </Box>
      );
    }

    const selectItems = availableWorkflows.map((wf) => ({
      label: wf.meta?.title || "Untitled",
      value: generateWorkflowId(wf),
      isLoading: false,
    }));

    return (
      <Box flexDirection="column" alignItems="flex-start" width="100%">
        <WorkflowOverlay
          title={managerTitle}
          promptText="Choose a workflow to start:"
          terminalRows={terminalRows}
          version={CLI_VERSION}
          PWD={PWD}
          approvalPolicy={currentApprovalPolicy}
          colorsByPolicy={colorsByPolicy}
          headers={headers}
          items={selectItems}
          onSelect={handleWorkflowSelection}
          availableHotkeys={allHotkeys}
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
          <Box paddingX={2} flexDirection="column">
            {managerTitle && <Text>{managerTitle}</Text>}
            <AppHeader
              terminalRows={terminalRows}
              version={CLI_VERSION}
              PWD={PWD}
              approvalPolicy={currentApprovalPolicy}
              colorsByPolicy={colorsByPolicy}
              headers={headers}
            />
            <WorkflowHeader
              workflowHeader={
                currentWorkflows.find((w) => w.id === activeWorkflowId)
                  ?.displayConfig?.header ||
                currentWorkflows.find((w) => w.id === activeWorkflowId)?.factory
                  .meta?.title ||
                "Untitled Workflow"
              }
            />
          </Box>
        )}
      {/* Render all TerminalChat instances */}
      {currentWorkflows.map((workflow) => (
        <TerminalChat
          key={workflow.id}
          id={workflow.id}
          visible={
            workflow.id === activeWorkflowId &&
            !showWorkflowPicker &&
            !showWorkflowSwitcher &&
            !showAppPalette &&
            !showApprovalOverlay
          }
          approvalPolicy={currentApprovalPolicy}
          additionalWritableRoots={additionalWritableRoots}
          fullStdout={fullStdout}
          workflowFactory={workflow.factory}
          uiConfig={uiConfig}
          onController={(controller) =>
            handleController(controller, workflow.id)
          }
          onTitleChange={handleTitleChange}
          onDisplayConfigChange={handleDisplayConfigChange}
          onLoadingStateChange={handleLoadingStateChange}
          openWorkflowPicker={openWorkflowPicker}
          createNewWorkflow={createNewWorkflow}
          isMulti={currentWorkflows.length > 1 || Boolean(workflows)}
        />
      ))}

      {/* Global command palette overlay */}
      {showAppPalette && (
        <Box padding={2}>
          <AppCommandPalette
            commands={appCommands}
            onClose={() => setShowAppPalette(false)}
          />
        </Box>
      )}

      {/* Workflow picker overlay */}
      {showWorkflowPicker && availableWorkflows.length > 0 && (
        <WorkflowOverlay
          title={managerTitle}
          promptText="Create new workflow instance:"
          terminalRows={terminalRows}
          version={CLI_VERSION}
          PWD={PWD}
          approvalPolicy={currentApprovalPolicy}
          colorsByPolicy={colorsByPolicy}
          headers={headers}
          availableHotkeys={allHotkeys}
          items={availableWorkflows.map((wf) => ({
            label: wf.meta?.title || "Untitled",
            value: generateWorkflowId(wf),
            isLoading: false,
          }))}
          onSelect={handlePickerSelection}
          onCancel={handlePickerCancel}
          isActive={!showAppPalette}
        />
      )}

      {/* Workflow switcher overlay */}
      {showWorkflowSwitcher && currentWorkflows.length > 0 && (
        <WorkflowOverlay
          title={managerTitle}
          promptText={
            currentWorkflows.length > 1
              ? "Switch to workflow:"
              : "Workflow actions:"
          }
          terminalRows={terminalRows}
          version={CLI_VERSION}
          PWD={PWD}
          approvalPolicy={currentApprovalPolicy}
          availableHotkeys={allHotkeys}
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
            {
              label: "Create new...",
              value: "__create_new__",
              isLoading: false,
            },
          ]}
          onSelect={(value) => {
            if (value === "__create_new__") {
              setShowWorkflowSwitcher(false);
              setShowWorkflowPicker(true);
            } else {
              handleSwitcherSelection(value);
            }
          }}
          onCancel={handleSwitcherCancel}
          isActive={!showAppPalette}
        />
      )}

      {/* Global approval policy overlay */}
      {showApprovalOverlay && (
        <WorkflowOverlay
          title={managerTitle}
          promptText="Change approval policy:"
          terminalRows={terminalRows}
          version={CLI_VERSION}
          PWD={PWD}
          approvalPolicy={currentApprovalPolicy}
          colorsByPolicy={colorsByPolicy}
          headers={headers}
          availableHotkeys={allHotkeys}
          items={[
            { label: "suggest", value: "suggest", isLoading: false },
            { label: "auto-edit", value: "auto-edit", isLoading: false },
            { label: "full-auto", value: "full-auto", isLoading: false },
          ]}
          onSelect={(policyValue: string) =>
            handleApprovalPolicyChange(policyValue as ApprovalPolicy)
          }
          onCancel={() => setShowApprovalOverlay(false)}
          isActive={!showAppPalette}
        />
      )}

      {/* Tabs at the bottom - show in multi-workflow mode when no overlays are active */}
      {Boolean(workflows) &&
        currentWorkflows.length > 0 &&
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
            isMultiWorkflowMode={Boolean(workflows)}
            availableHotkeys={allHotkeys}
          />
        )}
    </Box>
  );
}
