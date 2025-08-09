// Fantasy Adventure Game - showcasing user_select tool capabilities:
// - Location-based exploration with multiple action choices
// - NPC interaction with dialogue options
// - Inventory and quest management
// - Dynamic storytelling with player agency
// - Custom display configuration for immersive fantasy experience
import { run, createAgentWorkflow } from "../dist/lib.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const workflow = createAgentWorkflow(
  ({ setState, state, appendMessage, handleToolCall, tools }) => {
    let gameActive = false;
    let playerState = {
      location: "village_square",
      inventory: ["rusty_sword", "health_potion"],
      health: 100,
      gold: 50,
      quests: []
    };

    const gameWorld = {
      village_square: {
        name: "Village Square",
        description: "A bustling square with cobblestone paths. The village fountain gurgles peacefully in the center.",
        npcs: ["merchant", "guard", "old_woman"],
        exits: ["tavern", "blacksmith", "forest_path", "temple"]
      },
      tavern: {
        name: "The Prancing Pony Tavern",
        description: "A warm, dimly lit tavern filled with the aroma of ale and roasted meat.",
        npcs: ["bartender", "mysterious_stranger", "bard"],
        exits: ["village_square", "tavern_upstairs"]
      },
      blacksmith: {
        name: "Ironforge Smithy",
        description: "Hot forge fires crackle as the blacksmith hammers away at glowing metal.",
        npcs: ["blacksmith"],
        exits: ["village_square"]
      },
      forest_path: {
        name: "Forest Path",
        description: "A winding dirt path leading into the dark woods. Strange sounds echo from within.",
        npcs: ["forest_hermit"],
        exits: ["village_square", "deep_forest"]
      },
      temple: {
        name: "Temple of Light",
        description: "A serene temple with golden light streaming through stained glass windows.",
        npcs: ["priest", "temple_guard"],
        exits: ["village_square"]
      }
    };

    async function runAgent() {
      setState({ loading: true });

      while (state.loading) {
        try {
          const currentLocation = gameWorld[playerState.location];
          const systemPrompt = `You are a Dungeon Master running a fantasy adventure game! Create an immersive D&D-style experience.

PLAYER STATUS:
- Location: ${currentLocation.name}
- Health: ${playerState.health}/100
- Gold: ${playerState.gold}
- Inventory: ${playerState.inventory.join(", ")}
- Active Quests: ${playerState.quests.length > 0 ? playerState.quests.join(", ") : "None"}

CURRENT LOCATION: ${currentLocation.name}
${currentLocation.description}

AVAILABLE NPCS: ${currentLocation.npcs.join(", ")}
AVAILABLE EXITS: ${currentLocation.exits.join(", ")}

GAME MASTER RULES:
1. Use user_select for ALL player actions - never just narrate without giving choices
2. Always provide 4-6 meaningful action options using user_select
3. Include options like: "Talk to [NPC]", "Go to [Location]", "Examine [Object]", "Use [Item]"
4. Create engaging dialogue for NPCs with personality
5. Add random encounters, quests, and discoveries
6. Manage player health, inventory, and gold based on actions
7. Make the world feel alive and reactive to player choices

ACTION TYPES TO INCLUDE:
- Movement: "Go to the Tavern", "Enter the Forest"
- Social: "Talk to the Merchant", "Chat with the Guard"
- Exploration: "Examine the fountain", "Search the area"
- Combat: "Attack the bandit", "Defend yourself"
- Items: "Use health potion", "Buy from merchant"
- Special: "Cast a spell", "Attempt to pickpocket"

Always include timeout (30000) and defaultValue parameters in user_select calls.
Be descriptive and immersive - this is high fantasy roleplay!`;

          const response = await generateText({
            model: openai("gpt-4o"),
            system: systemPrompt,
            messages: state.transcript,
            tools: {user_select: tools.user_select},
            toolChoice: "required",
          });

          const aiMessage = response.response.messages[0];
          if (!aiMessage) {
            break;
          }

          appendMessage(aiMessage);

          const toolResponse = await handleToolCall(aiMessage);
          if (toolResponse) {
            appendMessage(toolResponse);
            
            // Parse the player's action and update game state
            if (Array.isArray(toolResponse.content)) {
              const result = toolResponse.content.find(part => part.type === 'tool-result');
              if (result?.output) {
                try {
                  // Handle new AI SDK structure: result.output.value instead of result.result
                  const outputValue = result.output.type === 'json' ? result.output.value : result.output.value;
                  if (typeof outputValue === 'string') {
                    const parsed = JSON.parse(outputValue);
                    if (parsed.output) {
                      updateGameState(parsed.output);
                    }
                  } else if (typeof outputValue === 'object' && outputValue.output) {
                    updateGameState(outputValue.output);
                  }
                } catch (e) {
                  // fallback
                }
              }
            }
          } else if (response.finishReason === "stop") {
            appendMessage({
              role: "ui",
              content: "💭 What would you like to do? (Type your action or wait for options...)",
            });
            setState({ loading: false });
            break;
          }
        } catch (error) {
          appendMessage({
            role: "ui",
            content: `❌ Error: ${error.message || "Unknown error"}`,
          });
          break;
        }
      }
    }

    function updateGameState(action) {
      // Parse common actions and update player state
      const actionLower = action.toLowerCase();
      
      if (actionLower.includes("go to") || actionLower.includes("enter")) {
        // Handle movement
        const location = Object.keys(gameWorld).find(key => 
          actionLower.includes(key.replace(/_/g, " ")) || 
          actionLower.includes(gameWorld[key].name.toLowerCase())
        );
        if (location && gameWorld[playerState.location].exits.includes(location)) {
          playerState.location = location;
        }
      }
      
      if (actionLower.includes("health potion") && actionLower.includes("use")) {
        if (playerState.inventory.includes("health_potion")) {
          playerState.health = Math.min(100, playerState.health + 30);
          playerState.inventory = playerState.inventory.filter(item => item !== "health_potion");
        }
      }
    }

    return {
      // Custom display configuration for fantasy adventure theme
      displayConfig: {
        header: "⚔️ Fantasy Adventure Quest ⚔️",
        theme: {
          primary: "#d4af37",      // Gold for primary actions
          accent: "#8a2be2",       // Purple for magical elements  
          success: "#228b22",      // Forest green for success
          warning: "#ff8c00",      // Dark orange for warnings
          error: "#dc143c",        // Crimson for errors/combat
          muted: "#696969"         // Dim gray for secondary text
        },
        messageTypes: {
          assistant: {
            label: "🧙‍♂️ Dungeon Master",
            color: "primary",
            bold: true,
            onMessage: (message) => {
              const content = Array.isArray(message.content) 
                ? message.content.find(part => part.type === 'text')?.text || ''
                : message.content;
              
              // Add atmospheric indicators for different types of narration
              if (content.includes('combat') || content.includes('attack') || content.includes('damage')) {
                return `⚔️ ${content}`;
              }
              if (content.includes('magic') || content.includes('spell') || content.includes('enchant')) {
                return `✨ ${content}`;
              }
              if (content.includes('treasure') || content.includes('gold') || content.includes('loot')) {
                return `💰 ${content}`;
              }
              if (content.includes('quest') || content.includes('mission')) {
                return `📜 ${content}`;
              }
              return `🎭 ${content}`;
            }
          },
          user: {
            label: "🦸‍♀️ Adventurer", 
            color: "accent",
            bold: true
          },
          toolCall: {
            label: "🎲 Action Menu",
            color: "success", 
            border: {
              style: "round",
              color: "accent"
            },
            spacing: {
              marginLeft: 1,
              marginTop: 1
            },
            onMessage: (message) => {
              if (Array.isArray(message.content)) {
                const toolCall = message.content.find(part => part.type === 'tool-call');
                if (toolCall?.toolName === 'user_select') {
                  const args = toolCall.args;
                  return `🗡️ ${args.message}\n⚡ Actions: ${args.options.map(opt => opt.label).join(' | ')}`;
                }
              }
              return '🎮 Preparing your options...';
            }
          },
          toolResponse: {
            label: "⚡ Your Choice",
            color: "success",
            bold: true,
            spacing: {
              marginLeft: 2
            },
            onMessage: (message) => {
              if (Array.isArray(message.content)) {
                const result = message.content.find(part => part.type === 'tool-result');
                if (result?.output) {
                  try {
                    // Handle new AI SDK structure: result.output.value instead of result.result
                    const outputValue = result.output.type === 'json' ? result.output.value : result.output.value;
                    if (typeof outputValue === 'string') {
                      const parsed = JSON.parse(outputValue);
                      if (parsed.output) {
                        return `🎯 You chose: "${parsed.output}"`;
                      }
                    } else if (typeof outputValue === 'object' && outputValue.output) {
                      return `🎯 You chose: "${outputValue.output}"`;
                    }
                  } catch (e) {
                    // fallback
                  }
                }
              }
              return message.content;
            }
          },
          ui: {
            label: "🏰 Game World",
            color: "warning",
            bold: true,
            onMessage: (message) => {
              const content = message.content;
              if (content.includes('Welcome') || content.includes('adventure begins')) {
                return `🌟 ${content}`;
              }
              if (content.includes('died') || content.includes('Game Over')) {
                return `💀 ${content}`;
              }
              if (content.includes('level up') || content.includes('victory')) {
                return `🏆 ${content}`;
              }
              if (content.includes('paused') || content.includes('stopped')) {
                return `⏸️ ${content}`;
              }
              if (content.includes('Error')) {
                return `❌ ${content}`;
              }
              if (content.includes('Health:') || content.includes('Status:')) {
                return `📊 ${content}`;
              }
              return `🌍 ${content}`;
            }
          }
        }
      },

      initialize: async () => {
        setState({
          messages: [
            {
              role: "ui",
              content:
                "🏰 Welcome to the Fantasy Adventure Quest! ⚔️\n\n" +
                "You are a brave adventurer who has just arrived in the peaceful village of Millbrook.\n" +
                "The village square bustles with activity, and adventure awaits around every corner!\n\n" +
                `📊 STATUS: Health: ${playerState.health}/100 | Gold: ${playerState.gold} | Location: ${gameWorld[playerState.location].name}\n` +
                `🎒 INVENTORY: ${playerState.inventory.join(", ")}\n\n` +
                "Type 'start' to begin your adventure, or describe what you'd like to do! 🌟",
            },
          ],
        });
      },
      message: async (userInput) => {
        const content = userInput.content.toLowerCase().trim();

        if (!gameActive && (content === "start" || content.includes("start") || content.includes("adventure"))) {
          gameActive = true;
          appendMessage(userInput);
          appendMessage({
            role: "ui",
            content:
              `🌟 Your adventure begins in ${gameWorld[playerState.location].name}!\n\n` +
              `${gameWorld[playerState.location].description}\n\n` +
              "🎭 The Dungeon Master will now present you with choices. You can always type custom actions too! ⚔️",
          });
          runAgent();
        } else if (!gameActive) {
          appendMessage(userInput);
          appendMessage({
            role: "ui",
            content: "🏰 Type 'start' when you're ready to begin your fantasy adventure!",
          });
        } else {
          // Game is active, user provided custom input
          appendMessage(userInput);
          appendMessage({
            role: "ui",
            content: `📜 The Dungeon Master considers your action... (Location: ${gameWorld[playerState.location].name})`,
          });
          runAgent();
        }
      },
      stop: () => {
        setState({ loading: false });
        appendMessage({
          role: "ui",
          content: "⏸️ Adventure paused. Your character rests briefly... Type anything to continue your quest!",
        });
      },
      terminate: () => {
        gameActive = false;
        playerState = {
          location: "village_square",
          inventory: ["rusty_sword", "health_potion"],
          health: 100,
          gold: 50,
          quests: []
        };
        setState({
          loading: false,
          messages: [],
        });
      },
    };
  }
);

run(workflow);
