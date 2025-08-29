export type AppCommandDef = {
  id: string;
  title: string;
  run: () => void;
  disabled?: () => boolean;
};

export function getEnabledAppCommands(
  defs: Array<AppCommandDef>,
): Array<AppCommandDef> {
  return defs.filter((d) => !d.disabled || !d.disabled());
}

