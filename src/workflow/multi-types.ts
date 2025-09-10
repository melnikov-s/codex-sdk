import type { WorkflowFactory } from "./index.js";

export type AvailableWorkflow = WorkflowFactory;
export type InitialWorkflowRef = { id: string } | WorkflowFactory;
