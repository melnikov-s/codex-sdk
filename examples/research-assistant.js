// Research Assistant Chat - showcases Slots in a real chat UX
// - Chat loop powered by your model via Vercel AI SDK
// - Live Sources panel (aboveHistory)
// - Session banner (aboveHeader) and context note (belowHeader)
// - Quick tips (belowHistory)
// - Input helpers (aboveInput/belowInput)

import { run, createAgentWorkflow } from "../dist/lib.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { Box, Text } from "ink";
import { createElement as h } from "react";

function SourcesPanel({ sources }) {
  return h(
    Box,
    { flexDirection: "column", borderStyle: "round", paddingX: 1 },
    h(Text, { bold: true, color: "#ffd93d" }, "Sources"),
    sources.length === 0
      ? h(
          Text,
          { dimColor: true },
          "No sources added yet. Paste URLs or mention papers.",
        )
      : sources.map((s, i) => h(Text, { key: String(i) }, `• ${s}`)),
  );
}

export const workflow = createAgentWorkflow(
  {
    title: "Research Assistant",
    description: "AI research assistant with live sources and context",
    icon: "🔍",
  },
  ({ setState, state, actions, tools }) => {
    let sources = [];
    let style = "APA";

    function updateSlots() {
      setState({
        slots: {
          aboveHeader: h(
            Text,
            { bold: true, color: "#a0e7e5" },
            "📚 Research Session",
          ),
          belowHeader: h(Text, { dimColor: true }, `Citation style: ${style}`),
          aboveHistory: h(SourcesPanel, { sources }),
          belowHistory: h(
            Text,
            { dimColor: true },
            "Tip: Use /style apa|mla|chicago to switch citation style",
          ),
          aboveInput: h(
            Text,
            { color: "#a8e6cf" },
            `Sources: ${sources.length}`,
          ),
          belowInput: h(
            Text,
            { dimColor: true },
            "Shortcuts: /style, /clear-sources",
          ),
        },
      });
    }

    function extractUserSources(text) {
      const urls = Array.from(text.matchAll(/https?:\/\/\S+/g)).map(
        (m) => m[0],
      );
      const mentions = Array.from(
        text.matchAll(/\b(arXiv:\s*\d{4}\.\d{4,5}|doi:\s*\S+)\b/gi),
      ).map((m) => m[0]);
      return [...urls, ...mentions];
    }

    function handleUserCommands(text) {
      const t = text.trim();
      if (t.startsWith("/style ")) {
        const next = t.split(/\s+/)[1]?.toUpperCase();
        if (next && ["APA", "MLA", "CHICAGO"].includes(next)) {
          style = next;
          updateSlots();
          actions.say(`Citation style set to ${style}`);
        } else {
          actions.say(`Unknown style. Try: /style apa|mla|chicago`);
        }
        return true;
      }
      if (t === "/clear-sources") {
        sources = [];
        updateSlots();
        actions.say("Cleared sources.");
        return true;
      }
      return false;
    }

    return {
      title: "Research Assistant",
      displayConfig: {
        header: h(
          Text,
          { bold: true, color: "#e8b4ff" },
          "🔎 Research Assistant",
        ),
      },

      initialize: () => {
        updateSlots();
        setState({
          messages: [
            {
              role: "ui",
              content:
                "Paste relevant links or describe your research question.",
            },
          ],
        });
      },

      message: async (userInput) => {
        actions.addMessage(userInput);

        // Commands & source extraction
        if (handleUserCommands(String(userInput.content))) {
          return;
        }

        const newSources = extractUserSources(String(userInput.content));
        if (newSources.length > 0) {
          for (const s of newSources) {
            if (!sources.includes(s)) {
              sources.push(s);
            }
          }
          updateSlots();
        }

        // Chat to the model with transcript
        const result = await generateText({
          model: openai("gpt-4o"),
          system: `You are a research assistant. Incorporate user's sources when helpful. Cite inline in ${style} style. If you need more sources, ask for them.`,
          messages: state.transcript,
          tools: tools.definitions,
        });

        await actions.handleModelResult(result);
        updateSlots();
      },

      stop: () => {
        setState({ statusLine: h(Text, { color: "yellow" }, "Paused") });
      },

      terminate: () => {
        setState({
          loading: false,
          messages: [],
          statusLine: undefined,
          slots: {
            aboveHeader: null,
            belowHeader: null,
            aboveHistory: null,
            belowHistory: null,
            aboveInput: null,
            belowInput: null,
          },
        });
        sources = [];
      },

      commands: {
        "style": {
          description: "Set citation style (usage: /style apa|mla|chicago)",
          handler: (args) => {
            const next = String(args || "")
              .trim()
              .toUpperCase();
            if (["APA", "MLA", "CHICAGO"].includes(next)) {
              style = next;
              updateSlots();
            }
          },
        },
        "clear-sources": {
          description: "Clear the sources panel",
          handler: () => {
            sources = [];
            updateSlots();
          },
        },
      },
    };
  },
);

// Run directly if this file is executed (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  run(workflow);
}
