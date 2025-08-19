#!/usr/bin/env node

// Demo script showing manager slot functionality
import { runMultiWorkflow, createWorkflow } from '../src/lib.js';
import { Box, Text } from 'ink';
import React from 'react';

// Simple demo workflows
const simpleWorkflowFactory = () => ({
  message: () => {},
  stop: () => {},
  terminate: () => {},
});

// Create workflows for the demo (static titles)
const workflows = [
  createWorkflow('🛠️ Demo Workflow 1', simpleWorkflowFactory('Demo 1')),
  createWorkflow('🔧 Demo Workflow 2', simpleWorkflowFactory('Demo 2')),
  createWorkflow('⚙️ Demo Workflow 3', simpleWorkflowFactory('Demo 3')),
];


// Start the multi-workflow system
const controller = runMultiWorkflow(workflows, {
  approvalPolicy: 'suggest',
});

// Demo 1: Static content in manager slots
controller.slots.set("aboveTabs", 
  React.createElement(Box, { 
    flexDirection: 'column', 
    paddingX: 2, 
    paddingY: 1, 
    borderStyle: 'round', 
    borderColor: 'blue' 
  }, 
    React.createElement(Text, { color: 'blue', bold: true }, '🚀 Manager Slots Demo'),
    React.createElement(Text, { dimColor: true }, 'This header persists across all workflows')
  )
);

// Demo 2: Function-based content that updates with workflow state
controller.slots.set("aboveWorkflow", (currentWorkflowState) => 
  React.createElement(Box, { flexDirection: 'row', gap: 2, paddingX: 2 },
    React.createElement(Text, { bold: true, color: 'cyan' }, '📊 Live Status:'),
    React.createElement(Text, { 
      color: currentWorkflowState?.loading ? 'yellow' : 'green' 
    }, currentWorkflowState?.loading ? '⏳ Processing' : '✅ Ready'),
    React.createElement(Text, { dimColor: true }, 
      `Messages: ${currentWorkflowState?.messages?.length || 0}`
    ),
    React.createElement(Text, { dimColor: true }, 
      `Queue: ${currentWorkflowState?.queue?.length || 0}`
    )
  )
);

// Demo 3: Keyboard shortcuts help
controller.slots.set("belowWorkflow",
  React.createElement(Box, { 
    flexDirection: 'column', 
    paddingX: 2, 
    paddingY: 1, 
    borderStyle: 'round', 
    borderColor: 'green' 
  },
    React.createElement(Text, { bold: true, color: 'green' }, '⌨️ Quick Reference:'),
    React.createElement(Box, { flexDirection: 'row', gap: 4 },
      React.createElement(Box, { flexDirection: 'column' },
        React.createElement(Text, { dimColor: true }, '• Ctrl+1-3    Switch workflows'),
        React.createElement(Text, { dimColor: true }, '• Ctrl+Tab   Next workflow'),
        React.createElement(Text, { dimColor: true }, '• Ctrl+C     Kill workflow')
      ),
      React.createElement(Box, { flexDirection: 'column' },
        React.createElement(Text, { dimColor: true }, '• Ctrl+W     Close workflow'),
        React.createElement(Text, { dimColor: true }, '• Ctrl+`     Workflow picker'),
        React.createElement(Text, { dimColor: true }, '• Type and press Enter to test')
      )
    )
  )
);

