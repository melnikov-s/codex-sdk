import type { AppCommand } from "./app-command-palette.js";

import AppCommandPalette from "./app-command-palette.js";
import { Box } from "ink";
import React from "react";

export interface AppPaletteOverlayProps {
  commands: Array<AppCommand>;
  onClose: () => void;
}

export function AppPaletteOverlay({
  commands,
  onClose,
}: AppPaletteOverlayProps): JSX.Element {
  return (
    <Box padding={2}>
      <AppCommandPalette commands={commands} onClose={onClose} />
    </Box>
  );
}
