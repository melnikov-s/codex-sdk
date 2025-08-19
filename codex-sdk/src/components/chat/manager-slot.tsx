import type { ManagerSlotRegion, WorkflowState, ManagerSlotState } from "../../workflow";
import type { ReactNode } from "react";

import React, { useCallback } from "react";

type Props = {
  enabled: boolean;
  region: ManagerSlotRegion;
  managerSlots: ManagerSlotState;
  workflowState: WorkflowState;
};

export default function ManagerSlot(props: Props): React.ReactElement | null {
  const render = useCallback(() => {
    if (!props.enabled) {
      return null;
    }
    const content = props.managerSlots[props.region];
    if (!content) {
      return null;
    }
    if (typeof content === "function") {
      const fn = content as (state: WorkflowState) => ReactNode;
      return <>{fn(props.workflowState)}</>;
    }
    return <>{content}</>;
  }, [props.enabled, props.managerSlots, props.region, props.workflowState]);

  return render();
}


