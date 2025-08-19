import { useEffect } from "react";

export function useInitialLauncher(params: {
  isMulti: boolean | undefined;
  workflowsCount: number;
  setOverlayMode: (mode: "launcher" | "none") => void;
}) {
  const { isMulti, workflowsCount, setOverlayMode } = params;
  useEffect(() => {
    if (!isMulti) {return;}
    if (workflowsCount === 0) {
      setOverlayMode("launcher");
    }
  }, [isMulti, workflowsCount, setOverlayMode]);
}


