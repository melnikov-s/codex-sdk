import type { Model } from "src/utils/providers.js";

import TypeaheadOverlay from "./typeahead-overlay.js";
import { Box, Text } from "ink";
import React from "react";
import { getAvailableModels } from "src/utils/ai.js";

type Props = {
  currentModel: string;
  onSelect: (model: Model) => void;
  onExit: () => void;
};

export default function ModelOverlay({
  currentModel,
  onSelect,
  onExit,
}: Props): JSX.Element {
  return (
    <TypeaheadOverlay
      title="Select model"
      description={
        <Box flexDirection="column">
          <Text>
            Current model: <Text color="greenBright">{currentModel}</Text>
          </Text>
          <Text dimColor>press tab to switch to provider selection</Text>
        </Box>
      }
      initialItems={getAvailableModels().map((model) => ({
        label: model,
        value: model,
      }))}
      currentValue={currentModel}
      onSelect={(selectedModel) => onSelect(selectedModel as Model)}
      onExit={onExit}
    />
  );
}
