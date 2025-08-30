import type { WorkflowFactory } from "../workflow/index.js";

// Helper function to generate stable IDs from workflow factories
export function generateWorkflowId(factory: WorkflowFactory): string {
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
