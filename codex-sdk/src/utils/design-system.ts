/**
 * Unified Design System for Codex SDK
 *
 * This provides consistent colors, spacing, and styling across all components
 * to create a cohesive, professional appearance.
 */

// Simplified 4-Color System
export const colors = {
  // Main highlight color - used everywhere for emphasis
  highlight: "blue" as const,

  // Currently selected/active state
  selected: "green" as const,

  // De-emphasized/dimmed elements
  muted: "gray" as const,

  // Normal text
  normal: "white" as const,

  // Only keep essential semantic colors
  error: "red" as const,
} as const;

// Spacing Scale - Consistent spacing values
export const spacing = {
  none: 0,
  xs: 0.5,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
} as const;

// Component-specific styling presets
export const componentStyles = {
  // Header elements
  header: {
    primary: { color: colors.normal, bold: true },
    accent: { color: colors.highlight },
  },

  // Interactive elements
  interactive: {
    active: { color: colors.normal, backgroundColor: colors.selected },
    inactive: { color: colors.muted },
    hover: { color: colors.highlight },
  },

  // Command/code elements - all use highlight color
  command: {
    name: { color: colors.highlight, bold: true },
    output: { color: colors.normal },
  },

  // Help and documentation - all use highlight color
  help: {
    command: { color: colors.highlight },
    shortcut: { color: colors.highlight },
    description: { color: colors.normal },
    section: { color: colors.muted, bold: true, dimColor: true },
  },

  // Workflow tabs
  tabs: {
    active: {
      color: "black" as const,
      backgroundColor: colors.selected,
      bold: true,
    },
    inactive: {
      color: colors.muted,
      dimColor: true,
    },
    header: {
      color: colors.normal,
      bold: true,
      marginBottom: spacing.sm,
    },
    instruction: {
      color: colors.muted,
      dimColor: true,
      marginTop: spacing.sm,
    },
  },
} as const;

// Approval policy colors
export const approvalColors = {
  "suggest": undefined,
  "auto-edit": colors.selected,
  "full-auto": colors.selected,
} as const;

// Message type colors - variations of main theme for differentiation
export const messageColors = {
  assistant: "blueBright" as const, // AI responses - bright blue
  user: colors.highlight, // You - main blue
  toolCall: colors.highlight, // Commands - main blue
  toolResponse: colors.selected, // Results - green
  ui: colors.muted, // System - muted gray
} as const;
