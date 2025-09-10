import type { WorkflowFactory } from "../workflow/index.js";

export interface WorkflowWithTitle {
  factory: WorkflowFactory;
  displayTitle: string;
}

// Compute display titles with disambiguation
export function computeDisplayTitles<T extends WorkflowWithTitle>(
  workflows: Array<T>,
): Array<T> {
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
}
