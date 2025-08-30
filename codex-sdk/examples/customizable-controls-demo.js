#!/usr/bin/env node

import { createAgentWorkflow, runWorkflows } from "../dist/lib.js";

const demoWorkflow = createAgentWorkflow({
  name: "customizable-controls-demo",
  description: "Demo showing customizable keyboard controls",
  systemPrompt: `You are a helpful assistant demonstrating customizable keyboard controls.

When the user interacts with you, explain that they can use:
- Ctrl+O: Previous workflow (customizable)
- Ctrl+P: Next workflow (customizable)
- Ctrl+Shift+O: Open workflow picker (customizable)
- Ctrl+K: App commands (customizable)

The controls are now always visible at the bottom of overlays.`,
});

// Custom hotkey configuration
const customHotkeyConfig = {
  previousWorkflow: { key: "h", ctrl: true },
  nextWorkflow: { key: "l", ctrl: true },
  appCommands: { key: "k", ctrl: true, shift: true },
};

runWorkflows([demoWorkflow], {
  title: "Customizable Controls Demo",
  approvalPolicy: "suggest",
  hotkeyConfig: customHotkeyConfig,
});
