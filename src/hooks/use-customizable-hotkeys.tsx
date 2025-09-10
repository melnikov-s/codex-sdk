/* eslint-disable react-refresh/only-export-components */
import type { HotkeyAction } from "./use-global-hotkeys.js";

import React, { createContext, useContext } from "react";

export interface CustomizableHotkeyConfig {
  previousWorkflow: Partial<
    Pick<HotkeyAction, "key" | "ctrl" | "meta" | "shift">
  >;
  nextWorkflow: Partial<Pick<HotkeyAction, "key" | "ctrl" | "meta" | "shift">>;
  nextNonLoading: Partial<
    Pick<HotkeyAction, "key" | "ctrl" | "meta" | "shift">
  >;
  appCommands: Partial<Pick<HotkeyAction, "key" | "ctrl" | "meta" | "shift">>;
}

export const defaultHotkeyConfig: CustomizableHotkeyConfig = {
  previousWorkflow: { key: "o", ctrl: true },
  nextWorkflow: { key: "p", ctrl: true },
  nextNonLoading: { key: "n", ctrl: true },
  appCommands: { key: "k", ctrl: true },
};

export interface HotkeyContextValue {
  config: CustomizableHotkeyConfig;
  updateConfig: (newConfig: Partial<CustomizableHotkeyConfig>) => void;
}

export const HotkeyContext = createContext<HotkeyContextValue>({
  config: defaultHotkeyConfig,
  updateConfig: () => {},
});

export const useHotkeyConfig = () => useContext(HotkeyContext);

export interface HotkeyProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<CustomizableHotkeyConfig>;
}

export function HotkeyProvider({
  children,
  initialConfig,
}: HotkeyProviderProps): JSX.Element {
  const [config, setConfig] = React.useState<CustomizableHotkeyConfig>({
    ...defaultHotkeyConfig,
    ...initialConfig,
  });

  const updateConfig = React.useCallback(
    (newConfig: Partial<CustomizableHotkeyConfig>) => {
      setConfig((prev) => ({ ...prev, ...newConfig }));
    },
    [],
  );

  const contextValue = React.useMemo(
    () => ({
      config,
      updateConfig,
    }),
    [config, updateConfig],
  );

  return (
    <HotkeyContext.Provider value={contextValue}>
      {children}
    </HotkeyContext.Provider>
  );
}
