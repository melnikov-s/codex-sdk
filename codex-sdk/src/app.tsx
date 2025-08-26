import type { ApprovalPolicy } from "./approvals";
import type { LibraryConfig } from "./lib.js";
import type {
  DisplayConfig,
  WorkflowController,
  WorkflowFactory,
} from "./workflow";

import AppHeader from "./components/chat/app-header";
import TerminalChat from "./components/chat/terminal-chat";
import { TerminalChatSelect } from "./components/chat/terminal-chat-select";
import WorkflowHeader from "./components/chat/workflow-header";
import { TerminalTabs } from "./components/terminal-tabs";
import { useMultiWorkflowHotkeys } from "./hooks/use-multi-workflow-hotkeys";
import { useTerminalSize } from "./hooks/use-terminal-size";
import { CLI_VERSION } from "./utils/session.js";
import { shortCwd } from "./utils/short-path.js";
import { clearTerminal } from "./utils/terminal.js";
import { resolveHeaders } from "./utils/ui-config.js";
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
};

type CurrentWorkflow = {
  id: string;
  factoryId: string;
  factory: WorkflowFactory;
  instanceIndex: number;
  displayTitle: string;
  controller?: WorkflowController;
  displayConfig?: DisplayConfig;
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

  const handleController = useCallback(
    (controller: WorkflowController, workflowId: string) => {
      setCurrentWorkflows((prev) =>
        prev.map((w) => (w.id === workflowId ? { ...w, controller } : w)),
      );
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

  const [showWorkflowSwitcher, setShowWorkflowSwitcher] = useState(false);

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

  const [showWorkflowPicker, setShowWorkflowPicker] = useState(false);

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

  const closeCurrentWorkflow = useCallback(() => {
    const currentWorkflow = currentWorkflows.find(
      (w) => w.id === activeWorkflowId,
    );
    if (!currentWorkflow) {
      return;
    }

    // Terminate the workflow controller
    if (currentWorkflow.controller) {
      currentWorkflow.controller.terminate();
    }

    // Remove the workflow from the list
    setCurrentWorkflows((prev) => {
      const filtered = prev.filter((w) => w.id !== activeWorkflowId);
      return computeDisplayTitles(filtered);
    });

    // If this was the last workflow, go back to workflow selection
    if (currentWorkflows.length <= 1) {
      clearTerminal();
      setActiveWorkflowId("");
      setShowWorkflowPicker(true);
      return;
    }

    // Switch to the next workflow (or first if closing the last one)
    const currentIndex = currentWorkflows.findIndex(
      (w) => w.id === activeWorkflowId,
    );
    const remainingWorkflows = currentWorkflows.filter(
      (w) => w.id !== activeWorkflowId,
    );

    if (remainingWorkflows.length > 0) {
      const nextIndex =
        currentIndex >= remainingWorkflows.length ? 0 : currentIndex;
      const nextWorkflow = remainingWorkflows[nextIndex];
      clearTerminal();
      setActiveWorkflowId(nextWorkflow?.id || "");
    }
  }, [currentWorkflows, activeWorkflowId, computeDisplayTitles]);

  // Hotkeys setup
  useMultiWorkflowHotkeys({
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
    openWorkflowPicker,
    createNewWorkflow,
    closeCurrentWorkflow,
    killCurrentWorkflow: () => {},
    emergencyExit: () => {},
  });

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
    }));

    return (
      <Box flexDirection="column">
        <Box paddingX={2} flexDirection="column">
          {title && <Text>{title}</Text>}
          <AppHeader
            terminalRows={terminalRows}
            version={CLI_VERSION}
            PWD={PWD}
            approvalPolicy={approvalPolicy}
            colorsByPolicy={colorsByPolicy}
            headers={headers}
          />
        </Box>
        <Box padding={2}>
          <Text>Choose a workflow to start:</Text>
          <Text> </Text>
          <TerminalChatSelect
            items={selectItems}
            onSelect={handleWorkflowSelection}
            onCancel={() => {}}
            isActive={true}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {!showWorkflowPicker &&
        !showWorkflowSwitcher &&
        currentWorkflows.length > 0 && (
          <Box paddingX={2} flexDirection="column">
            {title && <Text>{title}</Text>}
            <AppHeader
              terminalRows={terminalRows}
              version={CLI_VERSION}
              PWD={PWD}
              approvalPolicy={approvalPolicy}
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
            !showWorkflowSwitcher
          }
          approvalPolicy={approvalPolicy}
          additionalWritableRoots={additionalWritableRoots}
          fullStdout={fullStdout}
          workflowFactory={workflow.factory}
          uiConfig={uiConfig}
          onController={(controller) =>
            handleController(controller, workflow.id)
          }
          onTitleChange={handleTitleChange}
          onDisplayConfigChange={handleDisplayConfigChange}
          openWorkflowPicker={openWorkflowPicker}
          createNewWorkflow={createNewWorkflow}
          closeCurrentWorkflow={closeCurrentWorkflow}
        />
      ))}

      {/* Workflow picker overlay */}
      {showWorkflowPicker && availableWorkflows.length > 0 && (
        <Box flexDirection="column">
          <Box paddingX={2} flexDirection="column">
            {title && <Text>{title}</Text>}
            <AppHeader
              terminalRows={terminalRows}
              version={CLI_VERSION}
              PWD={PWD}
              approvalPolicy={approvalPolicy}
              colorsByPolicy={colorsByPolicy}
              headers={headers}
            />
          </Box>
          <Box padding={2}>
            <Text>Create new workflow instance:</Text>
            <Text> </Text>
            <TerminalChatSelect
              items={availableWorkflows.map((wf) => ({
                label: wf.meta?.title || "Untitled",
                value: generateWorkflowId(wf),
              }))}
              onSelect={handlePickerSelection}
              onCancel={handlePickerCancel}
              isActive={true}
            />
          </Box>
        </Box>
      )}

      {/* Workflow switcher overlay */}
      {showWorkflowSwitcher && currentWorkflows.length > 0 && (
        <Box flexDirection="column">
          <Box paddingX={2} flexDirection="column">
            {title && <Text>{title}</Text>}
            <AppHeader
              terminalRows={terminalRows}
              version={CLI_VERSION}
              PWD={PWD}
              approvalPolicy={approvalPolicy}
              colorsByPolicy={colorsByPolicy}
              headers={headers}
            />
          </Box>
          <Box padding={2}>
            <Text>
              {currentWorkflows.length > 1
                ? "Switch to workflow:"
                : "Workflow actions:"}
            </Text>
            <Text> </Text>
            <TerminalChatSelect
              items={[
                ...(currentWorkflows.length > 1
                  ? currentWorkflows.map((workflow) => ({
                      label: `${workflow.displayTitle}${workflow.id === activeWorkflowId ? " (current)" : ""}`,
                      value: workflow.id,
                    }))
                  : []),
                { label: "Create new...", value: "__create_new__" },
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
              isActive={true}
            />
          </Box>
        </Box>
      )}

      {/* Tabs at the bottom - only show if no overlays are active */}
      {currentWorkflows.length > 1 &&
        !showWorkflowPicker &&
        !showWorkflowSwitcher && (
          <TerminalTabs
            tabs={currentWorkflows.map((workflow) => ({
              id: workflow.id,
              title: workflow.displayTitle,
              isActive: workflow.id === activeWorkflowId,
            }))}
            onTabClick={(workflowId: string) => {
              clearTerminal();
              setActiveWorkflowId(workflowId);
            }}
            displayConfig={
              currentWorkflows.find((w) => w.id === activeWorkflowId)
                ?.displayConfig
            }
          />
        )}
    </Box>
  );
}
