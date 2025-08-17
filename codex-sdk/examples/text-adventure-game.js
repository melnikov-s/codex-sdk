// Fantasy Adventure Game - showcasing user_select tool capabilities:
// - Location-based exploration with multiple action choices
// - NPC interaction with dialogue options
// - Inventory and quest management
// - Dynamic storytelling with player agency
// - Custom display configuration for immersive fantasy experience
import { run, createAgentWorkflow } from "../dist/lib.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { Text } from "ink";
import { createElement as h } from "react";

const workflow = createAgentWorkflow(({ setState, state, actions, tools }) => {
  let gameActive = false;
  let playerState = {
    location: "The Crossroads",
    inventory: ["rusty_sword", "health_potion"],
    health: 100,
  };

  // Helper function to create a persistent status line. Keeps surface area minimal.
  function createStatusLine() {
    return h(
      Text,
      { bold: true, color: "#a8e6cf" },
      `${playerState.location} • Health: ${playerState.health}/100 • Items: ${playerState.inventory.join(", ") || "none"}`,
    );
  }

  async function runAgent() {
    setState({
      loading: true,
      statusLine: createStatusLine(),
      slots: {
        aboveInput: h(
          Text,
          { color: "#ffd93d" },
          'Tip: Use items with "Use: <Item>" or move with "Move to: <Place>"',
        ),
      },
    });

    while (state.loading) {
      try {
        const systemPrompt = `You are a Dungeon Master for a free-form, open-world medieval fantasy adventure (Dungeons & Dragons tone). Maintain continuity across turns.

PLAYER STATE (persisted between turns):
- Location: ${playerState.location}
- Health: ${playerState.health}/100
- Inventory: ${playerState.inventory.join(", ") || "empty"}

DIRECTIVES:
1) Use the user_select tool for ALL player actions. Do not narrate outcomes without first presenting choices.
2) Provide 4-6 concise, meaningful options that advance the story: movement, interaction, exploration, items, or combat.
3) Movement options MUST use the format: "Move to: <Location Name>".
4) Item usage options SHOULD use the format: "Use: <Item Name>" matching items in inventory when relevant.
5) Keep the setting coherent and medieval fantasy themed; invent locations, NPCs, and challenges freely.
6) After the user chooses, you may narrate outcomes, but do not assume inventory or health changes; prefer proposing explicit actions that lead to those changes.
7) Avoid referencing any predefined map or exits; this is a free-form world.

Always include timeout (30000) and defaultValue in user_select calls.`;

        const result = await generateText({
          model: openai("gpt-4o"),
          system: systemPrompt,
          messages: state.transcript,
          tools: { user_select: tools.definitions.user_select },
          toolChoice: "required",
        });

        const toolResponses = await actions.handleModelResult(result);

        // Parse each tool response and update game state if applicable
        for (const tr of toolResponses) {
          if (Array.isArray(tr.content)) {
            const toolResultPart = tr.content.find(
              (part) => part.type === "tool-result",
            );
            if (toolResultPart?.output) {
              try {
                const outputValue = toolResultPart.output.value;
                if (typeof outputValue === "string") {
                  const parsed = JSON.parse(outputValue);
                  if (parsed.output) {
                    updateGameState(parsed.output);
                  }
                } else if (
                  typeof outputValue === "object" &&
                  outputValue &&
                  "output" in outputValue
                ) {
                  updateGameState(outputValue.output);
                }
              } catch (e) {
                // ignore parse errors
              }
            }
          }
        }
        if (result.finishReason === "stop") {
          actions.addMessage({
            role: "ui",
            content:
              "💭 What would you like to do? (Type your action or wait for options...)",
          });
          setState({
            loading: false,
            statusLine: createStatusLine(),
            slots: { aboveInput: null },
          });
          break;
        }
      } catch (error) {
        actions.addMessage({
          role: "ui",
          content: `❌ Error: ${error.message || "Unknown error"}`,
        });
        setState({
          loading: false,
          statusLine: createStatusLine(),
          slots: { aboveInput: null },
        });
        break;
      }
    }
  }

  function updateGameState(action) {
    const selected = String(action).trim();
    const actionLower = selected.toLowerCase();

    // Movement: "Move to: <Location Name>" or common verbs
    const movePrefixes = [
      "move to:",
      "move to ",
      "go to ",
      "travel to ",
      "enter ",
    ];
    for (const prefix of movePrefixes) {
      if (actionLower.startsWith(prefix)) {
        const newLocationRaw = selected.slice(prefix.length).trim();
        if (newLocationRaw) {
          playerState.location = newLocationRaw;
          setState({
            statusLine: createStatusLine(),
            slots: {
              aboveInput: h(
                Text,
                { color: "#ffd93d" },
                `Path chosen: ${playerState.location}`,
              ),
            },
          });
          return;
        }
      }
    }

    // Items: "Use: <Item Name>" or "use <item>"
    const useMatch =
      selected.match(/^Use:\s*(.+)$/i) || selected.match(/^use\s+(.+)$/i);
    if (useMatch) {
      const itemName = useMatch[1].trim().toLowerCase().replace(/\s+/g, "_");
      if (
        itemName === "health_potion" &&
        playerState.inventory.includes("health_potion")
      ) {
        playerState.health = Math.min(100, playerState.health + 30);
        playerState.inventory = playerState.inventory.filter(
          (item) => item !== "health_potion",
        );
        setState({
          statusLine: createStatusLine(),
          slots: { aboveInput: h(Text, { color: "#ffd93d" }, "Potion used!") },
        });
        return;
      }
    }

    if (
      actionLower.includes("combat") ||
      actionLower.includes("attack") ||
      actionLower.includes("fight")
    ) {
      setState({
        statusLine: createStatusLine(),
      });
    }
  }

  return {
    // Beautiful, elegant display configuration
    displayConfig: {
      header: h(
        Text,
        { bold: true, color: "#e8b4ff" },
        "✨ Fantasy Adventure Quest",
      ),

      formatRoleHeader: (message) => {
        const styles = {
          assistant: { color: "#ff9a9e", label: "🧙 Dungeon Master" },
          user: { color: "#a8e6cf", label: "⚔️ You" },
          tool: { color: "#ffd93d", label: "✨ Action" },
          ui: { color: "#88d3ce", label: "📖 Story" },
        };
        const style = styles[message.role] || {
          color: "#b19cd9",
          label: message.role,
        };
        return h(Text, { bold: true, color: style.color }, style.label);
      },

      formatMessage: (message) => {
        const content = Array.isArray(message.content)
          ? message.content.find((part) => part.type === "text")?.text || ""
          : message.content;

        if (message.role === "assistant") {
          if (Array.isArray(message.content)) {
            const toolCall = message.content.find(
              (part) => part.type === "tool-call",
            );
            if (toolCall?.toolName === "user_select") {
              const args = toolCall.args || toolCall.input || {};
              const prompt =
                args.message || args.prompt || "What would you like to do?";
              return h(Text, { color: "#ffa8cc", italic: true }, `${prompt}`);
            }
          }
          return h(Text, { color: "#f8f8ff" }, content);
        }

        if (message.role === "tool") {
          if (Array.isArray(message.content)) {
            const result = message.content.find(
              (part) => part.type === "tool-result",
            );
            if (result?.output) {
              try {
                const outputValue = result.output.value;
                if (typeof outputValue === "string") {
                  const parsed = JSON.parse(outputValue);
                  if (parsed.output) {
                    return h(
                      Text,
                      { color: "#98fb98", bold: true },
                      `→ "${parsed.output}"`,
                    );
                  }
                } else if (
                  typeof outputValue === "object" &&
                  outputValue.output
                ) {
                  return h(
                    Text,
                    { color: "#98fb98", bold: true },
                    `→ "${outputValue.output}"`,
                  );
                }
              } catch (e) {
                // fall through to default below
              }
            }
          }
          return h(Text, { color: "#dda0dd" }, String(content ?? ""));
        }

        if (message.role === "ui") {
          return h(Text, { color: "#87ceeb" }, content);
        }

        return h(Text, { color: "#fff8dc" }, content);
      },
    },

    initialize: async () => {
      setState({
        messages: [
          {
            role: "ui",
            content:
              "🏰 Welcome to the Fantasy Adventure Quest! ⚔️\n\n" +
              "This is a free-form medieval fantasy adventure. There is no fixed map—discover locations, NPCs, and mysteries as you go.",
          },
        ],
        statusLine: createStatusLine(),
      });
      // Start the story loop immediately
      gameActive = true;
      actions.say(
        `🌟 Your adventure begins at ${playerState.location}! The Dungeon Master will present you with choices.`,
      );
      runAgent();
    },
    message: async (userInput) => {
      const _content = userInput.content.toLowerCase().trim();

      if (gameActive) {
        // Game is active, user provided custom input
        actions.addMessage([
          userInput,
          {
            role: "ui",
            content: `📜 The Dungeon Master considers your action... (Location: ${playerState.location})`,
          },
        ]);
        setState({
          statusLine: createStatusLine(),
        });
        runAgent();
      } else {
        actions.addMessage(userInput);
      }
    },
    stop: () => {
      setState({
        loading: false,
        statusLine: createStatusLine(),
        slots: { aboveInput: null },
      });
      actions.addMessage({
        role: "ui",
        content:
          "⏸️ Adventure paused. Your character rests briefly... Type anything to continue your quest!",
      });
    },
    terminate: () => {
      gameActive = false;
      playerState = {
        location: "The Crossroads",
        inventory: ["rusty_sword", "health_potion"],
        health: 100,
      };
      setState({
        loading: false,
        messages: [],
        statusLine: undefined,
        slots: { aboveInput: null },
      });
    },
  };
});

run(workflow);
