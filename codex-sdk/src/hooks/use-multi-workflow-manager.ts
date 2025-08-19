import type { ApprovalPolicy } from "../approvals.js";
import type { LibraryConfig } from "../lib.js";
import type {
  Workflow,
  WorkflowFactory,
  WorkflowFactoryWithTitle,
  MultiWorkflowController,
  WorkflowEvent,
  WorkflowInfo,
  AttentionState,
  WorkflowState,
  ManagerSlotRegion,
  ManagerSlotState,
} from "../workflow/index.js";
import type { ModelMessage } from "ai";
import type { ReactNode } from "react";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

export interface WorkflowInstance {
  id: string;
  title: string;
  factory: WorkflowFactory;
  workflow: Workflow | null;
  attention: AttentionState;
  status: 'loading' | 'idle' | 'waiting' | 'error';
  createdAt: Date;
  state: WorkflowState;
}

export interface UseMultiWorkflowManagerParams {
  availableWorkflows: Array<WorkflowFactoryWithTitle>;
  initialApprovalPolicy: ApprovalPolicy;
  additionalWritableRoots: ReadonlyArray<string>;
  uiConfig: LibraryConfig;
  onController?: (controller: MultiWorkflowController) => void;
  selectionApi: {
    openSelection: (
      items: Array<{ label: string; value: string }>,
      options: { label?: string; timeout?: number; defaultValue: string },
    ) => Promise<string>;
    setOverlayMode: (mode: "selection" | "none") => void;
  };
  promptApi: {
    openPrompt: (
      message: string,
      options: { required?: boolean; defaultValue: string; timeout?: number },
    ) => Promise<string>;
    openConfirmation: (
      message: string,
      options: { timeout?: number; defaultValue: boolean },
    ) => Promise<boolean>;
  };
  // Pass through the single workflow manager for the active workflow
  singleWorkflowManager: {
    workflow: Workflow | null;
    state: WorkflowState;
    smartSetState: (state: Partial<WorkflowState> | ((prev: WorkflowState) => WorkflowState)) => Promise<void>;
    syncRef: React.MutableRefObject<WorkflowState>;
    actions: unknown;
    stateGetters: unknown;
    approvalPolicy: ApprovalPolicy;
    setApprovalPolicy: (policy: ApprovalPolicy) => void;
    confirmationPrompt: unknown;
    explanation: unknown;
    submitConfirmation: unknown;
    inputSetterRef: React.MutableRefObject<((value: string) => void) | undefined>;
  };
}

export function useMultiWorkflowManager(params: UseMultiWorkflowManagerParams) {
  const {
    initialApprovalPolicy,
    additionalWritableRoots: _additionalWritableRoots,
    uiConfig: _uiConfig,
    onController,
    selectionApi: _selectionApi,
    promptApi: _promptApi,
    singleWorkflowManager,
  } = params;

  const [workflows, setWorkflows] = useState<Array<WorkflowInstance>>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>("");
  const [managerSlots, setManagerSlots] = useState<ManagerSlotState>({});
  const [eventListeners, setEventListeners] = useState<
    Map<string, Array<(workflowId: string, data?: unknown) => void>>
  >(new Map());
  const [catalog] = useState<Array<WorkflowFactoryWithTitle>>(params.availableWorkflows || []);

  const workflowsRef = useRef<Map<string, WorkflowInstance>>(new Map());
  
  // Generate unique ID for workflows
  const generateWorkflowId = useCallback(() => {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Create default attention state
  const createDefaultAttention = useCallback((): AttentionState => ({
    requiresInput: false,
    hasNotification: false,
    priority: 'medium',
    lastActivity: new Date(),
  }), []);

  // Manager slot actions (mirror workflow setSlot/clearSlot)
  const setManagerSlot = useCallback(
    (region: ManagerSlotRegion, content: ReactNode | ((state: WorkflowState) => ReactNode) | null) =>
      setManagerSlots((prev) => ({
        ...prev,
        [region]: content,
      })),
    [setManagerSlots],
  );

  const clearManagerSlot = useCallback(
    (region: ManagerSlotRegion) =>
      setManagerSlots((prev) => ({
        ...prev,
        [region]: null,
      })),
    [setManagerSlots],
  );

  const clearAllManagerSlots = useCallback(
    () => setManagerSlots({}),
    [setManagerSlots],
  );

  // Emit workflow events
  const emitEvent = useCallback((event: WorkflowEvent) => {
    const listeners = eventListeners.get(event.type) || [];
    listeners.forEach(handler => handler(event.workflowId, event.data));
  }, [eventListeners]);

  // Create a simplified workflow instance
  const createWorkflowInstance = useCallback((
    id: string,
    title: string,
    factory: WorkflowFactory
  ): WorkflowInstance => {
    const instance: WorkflowInstance = {
      id,
      title,
      factory,
      workflow: null, // Will be created when this becomes active
      attention: createDefaultAttention(),
      status: 'loading',
      createdAt: new Date(),
      state: {
        loading: false,
        messages: [],
        inputDisabled: false,
        queue: [],
        taskList: [],
        statusLine: undefined,
        slots: undefined,
        approvalPolicy: initialApprovalPolicy,
      },
    };

    return instance;
  }, [createDefaultAttention, initialApprovalPolicy]);

  // Create a new workflow instance from a titled factory
  const createInstance = useCallback((factoryWithTitle: WorkflowFactoryWithTitle, options?: { activate?: boolean; title?: string }): string => {
    const id = generateWorkflowId();
    const instance = createWorkflowInstance(id, options?.title || factoryWithTitle.title, factoryWithTitle);
    
    setWorkflows(prev => [...prev, instance]);
    workflowsRef.current.set(id, instance);

    if (options?.activate || workflows.length === 0) {
      setActiveWorkflowId(id);
    }

    emitEvent({
      type: 'created',
      workflowId: id,
      timestamp: new Date(),
    });

    return id;
  }, [
    generateWorkflowId,
    createWorkflowInstance,
    workflows.length,
    emitEvent,
  ]);

  // Remove a workflow
  const removeInstance = useCallback((id: string, options?: {
    graceful?: boolean;
    force?: boolean;
  }) => {
    const instance = workflowsRef.current.get(id);
    if (!instance) {return;}

    if (instance.workflow) {
      if (options?.force) {
        instance.workflow.terminate?.();
      } else {
        instance.workflow.stop?.();
        setTimeout(() => instance.workflow?.terminate?.(), 1000);
      }
    }

    workflowsRef.current.delete(id);
    setWorkflows(prev => prev.filter(w => w.id !== id));

    // If this was the active workflow, switch to another
    if (activeWorkflowId === id) {
      const remaining = workflows.filter(w => w.id !== id);
      setActiveWorkflowId(remaining.length > 0 ? remaining[0]?.id || "" : "");
    }

    emitEvent({
      type: 'destroyed',
      workflowId: id,
      timestamp: new Date(),
    });
  }, [workflows, activeWorkflowId, emitEvent]);

  // Switch to a workflow
  const switchToInstance = useCallback((id: string) => {
    const instance = workflowsRef.current.get(id);
    if (!instance) {return;}

    setActiveWorkflowId(id);
    
    emitEvent({
      type: 'activated',
      workflowId: id,
      timestamp: new Date(),
    });
  }, [emitEvent]);

  // Get active workflow instance
  const getActiveInstance = useCallback(() => {
    return workflowsRef.current.get(activeWorkflowId) || null;
  }, [activeWorkflowId]);

  // List all workflows
  const listInstances = useCallback((): Array<WorkflowInfo> => {
    return workflows.map(w => ({
      id: w.id,
      title: w.title,
      status: w.status,
      attention: w.attention,
      isActive: w.id === activeWorkflowId,
      createdAt: w.createdAt,
    }));
  }, [workflows, activeWorkflowId]);

  // Get workflows requiring attention
  const getWorkflowsRequiringAttention = useCallback((): Array<string> => {
    return workflows
      .filter(w => w.attention.requiresInput || w.attention.hasNotification || w.status === 'error')
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.attention.priority] - priorityOrder[a.attention.priority];
      })
      .map(w => w.id);
  }, [workflows]);

  // Switch to next workflow requiring attention
  const switchToNextAttention = useCallback((): boolean => {
    const attentionWorkflows = getWorkflowsRequiringAttention();
    if (attentionWorkflows.length === 0) {return false;}
    
    const currentIndex = attentionWorkflows.indexOf(activeWorkflowId);
    const nextIndex = (currentIndex + 1) % attentionWorkflows.length;
    const nextWorkflowId = attentionWorkflows[nextIndex];
    
    if (nextWorkflowId) {
      switchToInstance(nextWorkflowId);
    }
    return true;
  }, [getWorkflowsRequiringAttention, activeWorkflowId, switchToInstance]);

  // Switch to next non-loading workflow
  const switchToNextNonLoading = useCallback((): boolean => {
    const nonLoadingWorkflows = workflows.filter(w => w.status !== 'loading');
    if (nonLoadingWorkflows.length === 0) {return false;}
    
    const currentIndex = nonLoadingWorkflows.findIndex(w => w.id === activeWorkflowId);
    const nextIndex = (currentIndex + 1) % nonLoadingWorkflows.length;
    const nextWorkflow = nonLoadingWorkflows[nextIndex];
    if (!nextWorkflow) {return false;}
    const nextWorkflowId = nextWorkflow.id;
    
    switchToInstance(nextWorkflowId);
    return true;
  }, [workflows, activeWorkflowId, switchToInstance]);

  // Switch to previous non-loading workflow
  const switchToPreviousNonLoading = useCallback((): boolean => {
    const nonLoadingWorkflows = workflows.filter(w => w.status !== 'loading');
    if (nonLoadingWorkflows.length === 0) {return false;}
    
    const currentIndex = nonLoadingWorkflows.findIndex(w => w.id === activeWorkflowId);
    const prevIndex = (currentIndex - 1 + nonLoadingWorkflows.length) % nonLoadingWorkflows.length;
    const prevWorkflow = nonLoadingWorkflows[prevIndex];
    if (!prevWorkflow) {return false;}
    const prevWorkflowId = prevWorkflow.id;
    
    switchToInstance(prevWorkflowId);
    return true;
  }, [workflows, activeWorkflowId, switchToInstance]);

  // Update workflow attention state
  const updateWorkflowAttention = useCallback((
    workflowId: string, 
    updates: Partial<AttentionState>
  ) => {
    setWorkflows(prev => prev.map(w => 
      w.id === workflowId 
        ? { 
            ...w, 
            attention: { 
              ...w.attention, 
              ...updates,
              lastActivity: new Date() 
            }
          }
        : w
    ));
  }, []);

  // Update workflow status
  const updateWorkflowStatus = useCallback((
    workflowId: string,
    status: 'loading' | 'idle' | 'waiting' | 'error'
  ) => {
    setWorkflows(prev => prev.map(w => 
      w.id === workflowId ? { ...w, status } : w
    ));
  }, []);

  // Event handling
  const onWorkflowEvent = useCallback((
    eventType: WorkflowEvent['type'],
    handler: (workflowId: string, data?: unknown) => void
  ): (() => void) => {
    setEventListeners(prev => {
      const newMap = new Map(prev);
      const handlers = newMap.get(eventType) || [];
      newMap.set(eventType, [...handlers, handler]);
      return newMap;
    });

    return () => {
      setEventListeners(prev => {
        const newMap = new Map(prev);
        const handlers = newMap.get(eventType) || [];
        newMap.set(eventType, handlers.filter(h => h !== handler));
        return newMap;
      });
    };
  }, []);

  // Send message to specific workflow
  const sendToWorkflow = useCallback((id: string, message: ModelMessage) => {
    // For now, only active workflow can receive messages
    if (id === activeWorkflowId && singleWorkflowManager.workflow) {
      singleWorkflowManager.workflow.message(message);
    }
  }, [activeWorkflowId, singleWorkflowManager.workflow]);

  // Broadcast to all workflows
  const broadcastToAll = useCallback((message: ModelMessage, excludeActive?: boolean) => {
    // For now, only active workflow can receive messages
    if (!excludeActive && singleWorkflowManager.workflow) {
      singleWorkflowManager.workflow.message(message);
    }
  }, [singleWorkflowManager.workflow]);

  // No auto-initialization; launcher-first model

  // Create the controller with stable references
  const controller: MultiWorkflowController = useMemo(() => ({
    headless: false,
    
    // Manager slots - exact same pattern as workflow actions.setSlot()
    slots: {
      set: setManagerSlot,
      clear: clearManagerSlot,
      clearAll: clearAllManagerSlots,
    },

    // Basic workflow methods (delegate to single workflow manager)
    message: (input: string | ModelMessage) => {
      if (singleWorkflowManager.workflow) {
        if (typeof input === 'string') {
          singleWorkflowManager.workflow.message({ role: 'user', content: input });
        } else {
          singleWorkflowManager.workflow.message(input);
        }
      }
    },
    
    stop: () => {
      if (singleWorkflowManager.workflow) {
        singleWorkflowManager.workflow.stop();
      }
    },
    
    terminate: (_code?: number) => {
      if (singleWorkflowManager.workflow) {
        singleWorkflowManager.workflow.terminate();
      }
    },
    
    getState: () => singleWorkflowManager.state,

    // Instance methods
    createInstance,
    removeInstance,
    switchToInstance,
    closeInstance: (id: string) => removeInstance(id, { graceful: true }),
    killInstance: (id: string) => removeInstance(id, { force: true }),
    
    listInstances,
    getActiveInstance: () => activeWorkflowId || null,
    findInstance: (predicate) => {
      const found = listInstances().find(predicate);
      return found ? found.id : null;
    },
    listAvailableWorkflows: () => catalog.map(f => ({ title: f.title, factory: f })),
    openLauncher: () => {
      // No direct overlay control here; this will be wired by the UI using onController
    },
    
    sendToWorkflow,
    broadcastToAll,
    
    getWorkflowsRequiringAttention,
    switchToNextAttention,
    switchToNextNonLoading,
    switchToPreviousNonLoading,
    updateWorkflowAttention,
    updateWorkflowStatus,
    markAttentionHandled: (id: string) => {
      setWorkflows(prev => prev.map(w => 
        w.id === id 
          ? { ...w, attention: { ...w.attention, requiresInput: false, hasNotification: false } }
          : w
      ));
    },
    
    onWorkflowEvent,
    offWorkflowEvent: () => {}, // TODO: Implement proper removal
  }), [
    setManagerSlot,
    clearManagerSlot,
    clearAllManagerSlots,
    singleWorkflowManager.workflow,
    singleWorkflowManager.state,
    createInstance,
    removeInstance,
    switchToInstance,
    listInstances,
    activeWorkflowId,
    sendToWorkflow,
    broadcastToAll,
    getWorkflowsRequiringAttention,
    switchToNextAttention,
    switchToNextNonLoading,
    switchToPreviousNonLoading,
    updateWorkflowAttention,
    updateWorkflowStatus,
    onWorkflowEvent,
    catalog,
  ]);

  // Surface controller to parent
  useEffect(() => {
    if (onController) {
      onController(controller);
    }
  }, [onController, controller]);

  return {
    workflows,
    activeWorkflowId,
    activeInstance: getActiveInstance(),
    controller,
    managerSlots,
    createInstance,
    removeInstance,
    switchToInstance,
    listInstances,
    getWorkflowsRequiringAttention,
    switchToNextAttention,
    switchToNextNonLoading,
    switchToPreviousNonLoading,
    updateWorkflowAttention,
    updateWorkflowStatus,
  };
}
