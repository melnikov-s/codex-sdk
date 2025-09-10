import type { ApprovalPolicy } from "../approvals.js";

export const colorsByPolicy: Record<ApprovalPolicy, "green" | undefined> = {
  "suggest": undefined,
  "auto-edit": "green" as const,
  "full-auto": "green" as const,
};
