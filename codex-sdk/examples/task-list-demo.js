import { run, createAgentWorkflow } from "../dist/lib.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { readdirSync, statSync } from "fs";
import { Text } from "ink";
import { extname } from "path";
import React from "react";

export const workflow = createAgentWorkflow(
  "Task List Demo",
  ({ state, setState, actions }) => {
    const getCodeFiles = () => {
      const files = [];
      const codeExtensions = [
        ".js",
        ".ts",
        ".tsx",
        ".jsx",
        ".py",
        ".go",
        ".rs",
        ".java",
      ];

      try {
        const entries = readdirSync(".");
        for (const entry of entries) {
          if (entry.startsWith(".") || entry === "node_modules") {
            continue;
          }

          try {
            const stat = statSync(entry);
            if (stat.isFile() && codeExtensions.includes(extname(entry))) {
              files.push(entry);
            }
          } catch {
            continue;
          }
        }
      } catch {
        // No files found
      }

      return files.slice(0, 5); // Limit to 5 files
    };

    return {
      initialize: async () => {
        setState({
          messages: [
            {
              role: "ui",
              content: "🔍 Code Review Assistant - Analyzing codebase...",
            },
          ],
        });

        actions.setLoading(true);

        // Get code files
        const files = getCodeFiles();

        if (files.length === 0) {
          actions.setLoading(false);
          actions.say(
            "No code files found in current directory. Create some .js, .ts, or .py files first!",
          );
          return;
        }

        // Analyze codebase with LLM
        const result = await generateText({
          model: openai("gpt-4o-mini"),
          system: `You are a senior code reviewer. Analyze this codebase and create 3-5 specific, actionable review tasks.

Return your response as:
TASKS:
- HIGH: [specific issue description]
- MEDIUM: [specific issue description]
- LOW: [specific issue description]

Be specific about files and what needs to be done.`,
          messages: [
            {
              role: "user",
              content: `Please analyze this codebase. Files found: ${files.join(", ")}\n\nCreate specific code review tasks for improvement.`,
            },
          ],
        });

        // Parse tasks from LLM response
        const taskLines = result.text
          .split("\n")
          .filter(
            (line) =>
              line.includes("HIGH:") ||
              line.includes("MEDIUM:") ||
              line.includes("LOW:"),
          );

        // Add tasks to task list
        for (const line of taskLines) {
          const cleanTask = line.replace(/^-\s*/, "").trim();
          if (cleanTask) {
            actions.addTask({ label: cleanTask, completed: false });
          }
        }

        actions.setLoading(false);
        actions.say(
          `📋 Analysis complete! I found ${taskLines.length} areas for improvement in your codebase.`,
        );
        // Kick off immediately by suggesting the first task
        const nextTask = (state.taskList || []).find((t) => !t.completed);
        if (nextTask) {
          actions.say(`🎯 Let's start with: "${nextTask.label}"`);
        }
      },

      message: async (input) => {
        actions.addMessage(input);
        actions.setLoading(true);

        const userMessage = input.content.toLowerCase();

        if (userMessage === "done" || userMessage.includes("completed")) {
          actions.toggleTask(); // Toggle next incomplete task
          const nextTask = state.taskList.find((t) => !t.completed);
          if (nextTask) {
            actions.say(
              `✅ Task marked complete! Next up: "${nextTask.label}"`,
            );
          } else {
            actions.say(
              "🎉 All tasks completed! Great work on improving your codebase.",
            );
          }
        } else if (userMessage.includes("help")) {
          const nextTask = state.taskList.find((t) => !t.completed);
          if (nextTask) {
            const result = await generateText({
              model: openai("gpt-4o-mini"),
              system:
                "Provide specific, actionable steps to fix this code issue. Be concise and helpful.",
              messages: [
                {
                  role: "user",
                  content: `How do I fix: ${nextTask.label}?`,
                },
              ],
            });

            actions.say(
              `💡 **Help:**\n\n${result.text}\n\nSay "done" when you've fixed this issue.`,
            );
          } else {
            actions.say("No pending tasks! All issues have been resolved.");
          }
        } else {
          // General conversation
          const result = await generateText({
            model: openai("gpt-4o-mini"),
            system:
              "You are a code review assistant. Help the user with their questions about code improvement and development.",
            messages: state.transcript.slice(-3),
          });

          // Use handleModelResult for proper LLM response handling
          await actions.handleModelResult(result);
        }

        actions.setLoading(false);
      },

      stop: () => {
        actions.setLoading(false);
        actions.say("Agent paused. Task list preserved.");
      },

      terminate: () => {
        setState({
          loading: false,
          messages: [],
          taskList: [],
          queue: [],
        });
      },

      commands: {},

      displayConfig: {
        header: React.createElement(
          Text,
          { bold: true, color: "magenta" },
          "🔍 Code Review Assistant",
        ),
        formatRoleHeader: (message) => {
          if (message.role === "assistant") {
            return React.createElement(
              Text,
              { bold: true, color: "green" },
              "🤖 Code Reviewer",
            );
          }
          if (message.role === "user") {
            return React.createElement(
              Text,
              { bold: true, color: "cyan" },
              "👨‍💻 Developer",
            );
          }
          if (message.role === "ui") {
            return React.createElement(
              Text,
              { bold: true, color: "yellow" },
              "📋 System",
            );
          }
          return React.createElement(Text, { bold: true }, message.role);
        },
      },
    };
  },
);

// Run directly if this file is executed (not imported)
// eslint-disable-next-line no-undef
if (import.meta.url === `file://${process.argv[1]}`) {
  run(workflow);
}
