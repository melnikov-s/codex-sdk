import type { WorkflowFactory } from "../../../workflow";

import { useEffect } from "react";

export function useWorkflowFactorySync(params: {
  isMulti: boolean | undefined;
  activeInstanceFactory: WorkflowFactory | undefined;
  activeFactory: WorkflowFactory;
  setActiveFactory: (factory: WorkflowFactory) => void;
}) {
  const { isMulti, activeInstanceFactory, activeFactory, setActiveFactory } = params;

  useEffect(() => {
    if (!isMulti) {return;}
    const nextFactory = activeInstanceFactory;
    if (nextFactory && nextFactory !== activeFactory) {
      setActiveFactory(nextFactory);
    }
  }, [isMulti, activeInstanceFactory, activeFactory, setActiveFactory]);
}


