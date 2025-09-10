import type { WorkflowState } from "../src/workflow/index.js";

import { describe, expect, it } from "vitest";

describe("Terminal Chat State Management", () => {
  describe("smartSetState implementation", () => {
    it("should merge state correctly with object form", () => {
      let workflowState: WorkflowState = {
        loading: false,
        messages: [],
        inputDisabled: false,
      };

      // Simulate the actual smartSetState from terminal-chat.tsx
      const smartSetState = (
        updater:
          | Partial<WorkflowState>
          | ((prev: WorkflowState) => WorkflowState),
      ) => {
        workflowState = ((prev) => {
          if (typeof updater === "function") {
            // Function form - return as-is
            return updater(prev);
          }

          // Object form - merge at top level only (arrays/objects are replaced)
          return { ...prev, ...updater };
        })(workflowState);
      };

      // Test 1: Update loading only
      smartSetState({ loading: true });
      expect(workflowState).toEqual({
        loading: true,
        messages: [],
        inputDisabled: false,
      });

      // Test 2: Replace messages
      smartSetState({
        messages: [{ role: "ui", content: "Hello" }],
      });
      expect(workflowState).toEqual({
        loading: true,
        messages: [{ role: "ui", content: "Hello" }],
        inputDisabled: false,
      });

      // Test 3: Replace messages again (should replace, not append)
      smartSetState({
        messages: [{ role: "assistant", content: "Hi there!" }],
      });
      expect(workflowState).toEqual({
        loading: true,
        messages: [{ role: "assistant", content: "Hi there!" }],
        inputDisabled: false,
      });
      expect(workflowState.messages).toHaveLength(1); // Only 1 message, not 2

      // Test 4: Clear messages
      smartSetState({
        messages: [],
      });
      expect(workflowState).toEqual({
        loading: true,
        messages: [],
        inputDisabled: false,
      });

      // Test 5: Function form to append messages
      smartSetState((prev) => ({
        ...prev,
        messages: [...prev.messages, { role: "ui", content: "Appended" }],
      }));
      expect(workflowState).toEqual({
        loading: true,
        messages: [{ role: "ui", content: "Appended" }],
        inputDisabled: false,
      });

      // Test 6: Function form to replace entire state
      smartSetState(() => ({
        loading: false,
        messages: [],
        inputDisabled: true,
      }));
      expect(workflowState).toEqual({
        loading: false,
        messages: [],
        inputDisabled: true,
      });
    });

    it("should handle edge cases correctly", () => {
      let workflowState: WorkflowState = {
        loading: false,
        messages: [{ role: "user", content: "Initial" }],
        inputDisabled: false,
      };

      const smartSetState = (
        updater:
          | Partial<WorkflowState>
          | ((prev: WorkflowState) => WorkflowState),
      ) => {
        workflowState = ((prev) => {
          if (typeof updater === "function") {
            return updater(prev);
          }

          return { ...prev, ...updater };
        })(workflowState);
      };

      // Test empty message array (should replace with empty)
      smartSetState({ messages: [] });
      expect(workflowState.messages).toEqual([]);

      // Add messages back
      smartSetState({
        messages: [{ role: "user", content: "New message" }],
      });
      expect(workflowState.messages).toHaveLength(1);

      // Test only inputDisabled update
      smartSetState({ inputDisabled: true });
      expect(workflowState).toEqual({
        loading: false,
        messages: [{ role: "user", content: "New message" }],
        inputDisabled: true,
      });

      // Test function form with partial update
      smartSetState((prev) => ({
        ...prev,
        loading: true,
      }));
      expect(workflowState).toEqual({
        loading: true,
        messages: [{ role: "user", content: "New message" }],
        inputDisabled: true,
      });

      // Test function form appending messages manually
      smartSetState((prev) => ({
        ...prev,
        messages: [...prev.messages, { role: "ui", content: "Manual append" }],
      }));
      expect(workflowState.messages).toHaveLength(2);
      expect(workflowState.messages[1]).toEqual({
        role: "ui",
        content: "Manual append",
      });
    });

    it("should work with real workflow message patterns", () => {
      let workflowState: WorkflowState = {
        loading: false,
        messages: [],
        inputDisabled: false,
      };

      const smartSetState = (
        updater:
          | Partial<WorkflowState>
          | ((prev: WorkflowState) => WorkflowState),
      ) => {
        workflowState = ((prev) => {
          if (typeof updater === "function") {
            return updater(prev);
          }

          return { ...prev, ...updater };
        })(workflowState);
      };

      // Simulate a typical workflow sequence
      // 1. Initialize (replace messages)
      smartSetState({
        messages: [{ role: "ui", content: "Agent initialized" }],
      });

      // 2. User input (append using function form)
      smartSetState((prev) => ({
        ...prev,
        messages: [...prev.messages, { role: "user", content: "Hello agent" }],
      }));

      // 3. Start processing
      smartSetState({ loading: true });

      // 4. Add assistant response (append using function form)
      smartSetState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: "Hello! How can I help you today?",
          },
        ],
      }));

      // 5. Complete processing
      smartSetState({ loading: false });

      // Verify final state
      expect(workflowState).toEqual({
        loading: false,
        inputDisabled: false,
        messages: [
          { role: "ui", content: "Agent initialized" },
          { role: "user", content: "Hello agent" },
          { role: "assistant", content: "Hello! How can I help you today?" },
        ],
      });

      // 6. Interrupt/stop (append using function form)
      smartSetState({ loading: false });
      smartSetState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          { role: "ui", content: "Execution interrupted" },
        ],
      }));

      expect(workflowState.messages).toHaveLength(4);
      expect(workflowState.messages[3]).toEqual({
        role: "ui",
        content: "Execution interrupted",
      });

      // 7. Clear all messages (replace)
      smartSetState({ messages: [] });
      expect(workflowState.messages).toHaveLength(0);
    });
  });
});
