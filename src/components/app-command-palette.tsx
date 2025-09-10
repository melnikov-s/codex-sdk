import TypeaheadOverlay from "./typeahead-overlay.js";
import { Box, Text } from "ink";
import React, { useMemo } from "react";

export type AppCommand = {
  id: string;
  title: string;
  run: () => void;
};

export default function AppCommandPalette({
  commands,
  onClose,
}: {
  commands: Array<AppCommand>;
  onClose: () => void;
}): JSX.Element {
  const items = useMemo(
    () => commands.map((c) => ({ label: c.title, value: c.id })),
    [commands],
  );

  return (
    <Box flexDirection="column">
      <TypeaheadOverlay
        title="Command Palette"
        description={<Text>Select an action to run</Text>}
        initialItems={items}
        onSelect={(id: string) => {
          const cmd = commands.find((c) => c.id === id);
          if (cmd) {
            cmd.run();
          }
          onClose();
        }}
        onExit={onClose}
      />
    </Box>
  );
}
