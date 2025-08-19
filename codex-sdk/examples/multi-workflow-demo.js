#!/usr/bin/env node

// Import all example workflows
import { codebaseQuizWorkflow } from './codebase-quiz.js';
import { codingAgentWorkflow } from './coding-agent.js';
import { deployDashboardWorkflow } from './deploy-dashboard.js';
import { projectSetupWorkflow } from './project-setup-assistant.js';
import { queueDemoWorkflow } from './queue-demo.js';
import { researchAssistantWorkflow } from './research-assistant.js';
import { codeReviewWorkflow } from './task-list-demo.js';
import { textAdventureWorkflow } from './text-adventure-game.js';
import { runMultiWorkflow, createWorkflow } from '../dist/lib.js';
import { Box, Text } from 'ink';
import React from 'react';

// Register available workflow TYPES with static titles
const workflows = [
  createWorkflow('🛠️ Coding Agent', codingAgentWorkflow),
  createWorkflow('📚 Research Assistant', researchAssistantWorkflow),
  createWorkflow('🔍 Code Review', codeReviewWorkflow),
  createWorkflow('📋 Queue Demo', queueDemoWorkflow),
  createWorkflow('⚔️ Adventure Game', textAdventureWorkflow),
  createWorkflow('🎓 Codebase Quiz', codebaseQuizWorkflow),
  createWorkflow('🚀 Deploy Dashboard', deployDashboardWorkflow),
  createWorkflow('⚙️ Project Setup', projectSetupWorkflow),
];

// Create React components for manager slots
const DashboardHeader = () => 
  React.createElement(Box, { 
    flexDirection: "column", 
    paddingX: 2, 
    paddingY: 1, 
    borderStyle: "round", 
    borderColor: "blue" 
  },
    React.createElement(Text, { color: "blue", bold: true }, 
      "🎯 Multi-Workflow Demo - All Codex SDK Examples Combined!"
    )
  );

const KeyboardShortcuts = (currentWorkflowState) => 
  React.createElement(Box, { flexDirection: "column", paddingX: 2, marginY: 1 },
    React.createElement(Box, { flexDirection: "row", gap: 2, marginBottom: 1 },
      React.createElement(Text, { bold: true, color: "cyan" }, "⌨️  Keyboard Shortcuts:"),
      React.createElement(Text, { dimColor: true }, 
        `Status: ${currentWorkflowState?.loading ? "⏳ Processing" : "✅ Ready"}`
      ),
      React.createElement(Text, { dimColor: true }, 
        `Messages: ${currentWorkflowState?.messages?.length || 0}`
      )
    ),
    React.createElement(Box, { flexDirection: "row", gap: 4 },
      React.createElement(Box, { flexDirection: "column" },
        React.createElement(Text, { dimColor: true }, "• Ctrl+1-9         Switch to workflows 1-9"),
        React.createElement(Text, { dimColor: true }, "• Ctrl+Alt+1-2     Switch to workflows 10-11"),
        React.createElement(Text, { dimColor: true }, "• Ctrl+Tab         Next workflow"),
        React.createElement(Text, { dimColor: true }, "• Ctrl+Shift+Tab   Previous workflow"),
        React.createElement(Text, { dimColor: true }, "• Ctrl+`           Open workflow picker")
      ),
      React.createElement(Box, { flexDirection: "column" },
        React.createElement(Text, { dimColor: true }, "• Ctrl+C           Kill current workflow"),
        React.createElement(Text, { dimColor: true }, "• Ctrl+Shift+C     Emergency exit application"),
        React.createElement(Text, { dimColor: true }, "• Ctrl+W           Close current workflow gracefully"),
        React.createElement(Text, { dimColor: true }, "• Ctrl+T           Create new workflow (future)")
      )
    )
  );

const FeaturesList = () => 
  React.createElement(Box, { 
    flexDirection: "column", 
    paddingX: 2, 
    paddingY: 1, 
    borderStyle: "round", 
    borderColor: "green" 
  },
    React.createElement(Text, { bold: true, color: "green" }, "💡 Features:"),
    React.createElement(Text, { dimColor: true }, "• Visual tabs showing workflow status"),
    React.createElement(Text, { dimColor: true }, "• State isolation - each workflow independent"),
    React.createElement(Text, { dimColor: true }, "• Attention indicators for workflows needing input"),
    React.createElement(Text, { dimColor: true }, "• Smart navigation between non-loading workflows"),
    React.createElement(Text, { dimColor: true }, "• Event system for workflow lifecycle management"),
    React.createElement(Text, { dimColor: true }, "• Manager slot system for persistent UI across workflow switches")
  );

// Start the multi-workflow system (launcher-first)
const controller = runMultiWorkflow(workflows, {
  approvalPolicy: 'suggest',
});

// Set up manager slots to display information persistently across workflow switches
controller.slots.set("aboveTabs", React.createElement(DashboardHeader));
controller.slots.set("aboveWorkflow", KeyboardShortcuts); // Function that receives current workflow state
controller.slots.set("belowWorkflow", React.createElement(FeaturesList));

// Enhanced event logging with workflow titles
// (Events logged via UI; avoid console in examples to satisfy linter)
