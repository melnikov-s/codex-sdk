import React from "react";

export type SmartSetState<T> = (
  updater: Partial<T> | ((prev: T) => T),
) => Promise<void>;

export function useSmartState<T>(initialState: T): {
  state: T;
  setState: SmartSetState<T>;
  syncRef: React.MutableRefObject<T>;
} {
  const [state, setState] = React.useState<T>(initialState);
  const syncRef = React.useRef<T>(initialState);

  const smartSetState = React.useCallback<SmartSetState<T>>(
    async (updater) => {
      let newState: T;
      if (typeof updater === "function") {
        // Functional form replaces state with the returned object
        newState = (updater as (prev: T) => T)(syncRef.current);
      } else {
        // Top-level shallow merge; everything else replaced
        newState = { ...(syncRef.current as object), ...(updater as object) } as T;
      }
      syncRef.current = newState;
      setState(newState);
      return Promise.resolve();
    },
    [],
  );

  return { state, setState: smartSetState, syncRef };
}


