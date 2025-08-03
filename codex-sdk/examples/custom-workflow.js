// Interactive 20 Questions Game - showcasing user_select tool capabilities:
// - Yes/No questions using user_select with confirmation-style options
// - Multiple choice guesses with "None of the above" escape hatch
// - Timeout functionality for when user steps away
// - Natural flow control when user provides custom input
// - Custom display configuration for enhanced visual experience
import { run, createAgentWorkflow } from "../dist/lib.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const workflow = createAgentWorkflow(
  ({ setState, state, appendMessage, handleToolCall, tools }) => {
    let questionCount = 0;
    let gameActive = false;

    async function runAgent() {
      setState({ loading: true });

      while (state.loading) {
        try {
          const systemPrompt = `You are playing 20 Questions! Your goal is to guess what the user is thinking of.

RULES:
1. You have ${20 - questionCount} questions remaining
2. Ask strategic yes/no questions using the user_select tool
3. When you're confident, make guesses using user_select with multiple options + "None of the above"
4. If user selects "None of the above", they'll provide clarification - use that info!
5. Be clever and strategic - narrow down categories first, then get specific

CURRENT STATUS: ${questionCount}/20 questions used
${gameActive ? "GAME ACTIVE - Keep asking questions!" : "GAME NOT STARTED"}

Use the user_select tool for ALL interactions:
- For yes/no questions: [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]
- For guesses: [{"label": "A dog", "value": "dog"}, {"label": "A car", "value": "car"}, {"label": "A book", "value": "book"}]
- Always include timeout and defaultValue parameters`;

          const response = await generateText({
            model: openai("gpt-4o"),
            system: systemPrompt,
            messages: state.transcript,
            tools,
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
            questionCount++;

            // Check if we've hit the question limit
            if (questionCount >= 20) {
              appendMessage({
                role: "ui",
                content:
                  "🎮 Game Over! I've used all 20 questions. You win! 🎉",
              });
              gameActive = false;
              setState({ loading: false });
              break;
            }
          } else if (response.finishReason === "stop") {
            // User selected "None of the above" - they'll provide custom input
            appendMessage({
              role: "ui",
              content:
                "💭 Please provide more details to help me understand better...",
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

    return {
      // Custom display configuration showcasing the new theming system
      displayConfig: {
        header: "Let's play 20 questions!",
        theme: {
          primary: "#00ff88",      // Bright green for primary actions
          accent: "#ff6b35",       // Orange for highlights  
          success: "#28a745",      // Green for success states
          warning: "#ffc107",      // Yellow for warnings
          error: "#dc3545",        // Red for errors
          muted: "#6c757d"         // Gray for secondary text
        },
        messageTypes: {
          assistant: {
            label: "🤖 Game Master",
            color: "primary",
            bold: true,
            onMessage: (message) => {
              // Add some game-specific formatting to AI responses
              const content = Array.isArray(message.content) 
                ? message.content.find(part => part.type === 'text')?.text || ''
                : message.content;
              
              // Add question counter if this looks like a question
              if (content.includes('?')) {
                return `🎯 ${content}`;
              }
              return content;
            }
          },
          user: {
            label: "🧠 Player", 
            color: "accent",
            bold: true
          },
          toolCall: {
            label: "🎮 Interactive Question",
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
              // Extract tool call details for better display
              if (Array.isArray(message.content)) {
                const toolCall = message.content.find(part => part.type === 'tool-call');
                if (toolCall?.toolName === 'user_select') {
                  const args = toolCall.args;
                  return `❓ ${args.message}\n📝 Options: ${args.options.map(opt => opt.label).join(' | ')}`;
                }
              }
              return 'Processing your selection...';
            }
          },
          toolResponse: {
            label: "✅ Your Answer",
            color: "success",
            bold: true,
            spacing: {
              marginLeft: 2
            },
            onMessage: (message) => {
              // Parse tool response to show user's choice clearly
              if (Array.isArray(message.content)) {
                const result = message.content.find(part => part.type === 'tool-result');
                if (result?.result) {
                  try {
                    const parsed = JSON.parse(result.result);
                    if (parsed.output) {
                      return `🎯 You selected: "${parsed.output}"`;
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
            label: "🎲 Game System",
            color: "warning",
            bold: true,
            onMessage: (message) => {
              // Add emoji indicators for different UI message types
              const content = message.content;
              if (content.includes('Game Over')) {
                return `🏁 ${content}`;
              }
              if (content.includes('Game Started')) {
                return `🚀 ${content}`;
              }
              if (content.includes('Welcome')) {
                return `🎪 ${content}`;
              }
              if (content.includes('Error')) {
                return `❌ ${content}`;
              }
              if (content.includes('paused')) {
                return `⏸️ ${content}`;
              }
              return content;
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
                "🎯 Welcome to 20 Questions! 🎲\n\n" +
                "Think of ANYTHING - object, person, place, concept, etc.\n" +
                "I'll try to guess it in 20 questions or less!\n\n" +
                "Ready? Type 'start' to begin the game! 🚀",
            },
          ],
        });
      },
      message: async (userInput) => {
        const content = userInput.content.toLowerCase().trim();

        if (!gameActive && (content === "start" || content.includes("start"))) {
          gameActive = true;
          questionCount = 0;
          appendMessage(userInput);
          appendMessage({
            role: "ui",
            content:
              "🎮 Game Started! I have 20 questions to guess what you're thinking of.\n" +
              "Remember: You can always select 'None of the above' if my options don't fit! 🧠",
          });
          runAgent();
        } else if (!gameActive) {
          appendMessage(userInput);
          appendMessage({
            role: "ui",
            content: "🎯 Type 'start' when you're ready to play 20 Questions!",
          });
        } else {
          // Game is active, user provided custom input after "None of the above"
          appendMessage(userInput);
          appendMessage({
            role: "ui",
            content: `💡 Got it! Using that info to ask better questions... (${20 - questionCount} questions left)`,
          });
          runAgent();
        }
      },
      stop: () => {
        setState({ loading: false });
        appendMessage({
          role: "ui",
          content: "⏸️ Game paused. Type anything to continue!",
        });
      },
      terminate: () => {
        gameActive = false;
        questionCount = 0;
        setState({
          loading: false,
          messages: [],
        });
      },
    };
  }
);

run(workflow);
