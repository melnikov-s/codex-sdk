import type { ApprovalPolicy } from "../approvals.js";

import { useState, useCallback } from "react";

export interface UseOverlaysReturn {
  showWorkflowPicker: boolean;
  showWorkflowSwitcher: boolean;
  showApprovalOverlay: boolean;
  showAppPalette: boolean;

  openWorkflowPicker: () => void;
  closeWorkflowPicker: () => void;

  openWorkflowSwitcher: () => void;
  closeWorkflowSwitcher: () => void;

  openApprovalOverlay: () => void;
  closeApprovalOverlay: () => void;

  openAppPalette: () => void;
  closeAppPalette: () => void;

  handlePickerSelection: (
    workflowId: string,
    onSelect: (workflowId: string) => void,
  ) => void;
  handleSwitcherSelection: (
    workflowId: string,
    onSelect: (workflowId: string) => void,
  ) => void;
  handleApprovalSelection: (
    policy: ApprovalPolicy,
    onSelect: (policy: ApprovalPolicy) => void,
  ) => void;
}

export function useOverlays(): UseOverlaysReturn {
  const [showWorkflowPicker, setShowWorkflowPicker] = useState(false);
  const [showWorkflowSwitcher, setShowWorkflowSwitcher] = useState(false);
  const [showApprovalOverlay, setShowApprovalOverlay] = useState(false);
  const [showAppPalette, setShowAppPalette] = useState(false);

  const openWorkflowPicker = useCallback(() => {
    setShowWorkflowPicker(true);
  }, []);

  const closeWorkflowPicker = useCallback(() => {
    setShowWorkflowPicker(false);
  }, []);

  const openWorkflowSwitcher = useCallback(() => {
    setShowWorkflowSwitcher(true);
  }, []);

  const closeWorkflowSwitcher = useCallback(() => {
    setShowWorkflowSwitcher(false);
  }, []);

  const openApprovalOverlay = useCallback(() => {
    setShowApprovalOverlay(true);
  }, []);

  const closeApprovalOverlay = useCallback(() => {
    setShowApprovalOverlay(false);
  }, []);

  const openAppPalette = useCallback(() => {
    setShowAppPalette(true);
  }, []);

  const closeAppPalette = useCallback(() => {
    setShowAppPalette(false);
  }, []);

  const handlePickerSelection = useCallback(
    (workflowId: string, onSelect: (workflowId: string) => void) => {
      setShowWorkflowPicker(false);
      onSelect(workflowId);
    },
    [],
  );

  const handleSwitcherSelection = useCallback(
    (workflowId: string, onSelect: (workflowId: string) => void) => {
      setShowWorkflowSwitcher(false);
      onSelect(workflowId);
    },
    [],
  );

  const handleApprovalSelection = useCallback(
    (policy: ApprovalPolicy, onSelect: (policy: ApprovalPolicy) => void) => {
      setShowApprovalOverlay(false);
      onSelect(policy);
    },
    [],
  );

  return {
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
  };
}
