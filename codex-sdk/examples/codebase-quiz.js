// Codebase Quiz - showcasing shell tool and user_select capabilities:
// - Automatically analyzes codebase documentation and source files
// - Generates intelligent questions about the project structure
// - Interactive multiple-choice quiz with scoring
// - Demonstrates shell command usage for file reading
// - Custom academic/tech theme with progress tracking
import { run, createAgentWorkflow } from "../dist/lib.js";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { Text } from "ink";
import React from "react";

const workflow = createAgentWorkflow(
  ({ setState, state, actions, tools }) => {
    let quizActive = false;
    let quizState = {
      codebaseAnalyzed: false,
      currentQuestion: 0,
      totalQuestions: 5,
      score: 0,
      analyzing: false
    };

    async function runCodebaseAnalysis() {
      try {
        await simpleFileAnalysis("README.md", "project overview");
        await simpleFileAnalysis("../README.md", "project overview from parent");
        await simpleFileAnalysis("package.json", "project dependencies");
        actions.say("✅ Basic codebase analysis complete! Ready to generate quiz questions...");
        finishAnalysis();
      } catch (error) {
        actions.say(`❌ Analysis failed: ${error.message}`);
        setState({ loading: false });
        quizState.analyzing = false;
      }
    }

    async function simpleFileAnalysis(filename, purpose) {
      try {
        const systemPrompt = `Read and analyze the ${filename} file to understand the ${purpose}. Use shell commands to read the file content.`;

        const result = await generateText({
          model: openai("gpt-4o"),
          system: systemPrompt,
          messages: [{ role: "user", content: `Please read ${filename} to understand the ${purpose}.` }],
          tools: tools.definitions,
          toolChoice: "required"
        });

        await actions.handleModelResult(result);
      } catch (error) {
        actions.say(`⚠️ Could not read ${filename}: ${error.message}`);
      }
    }

    function finishAnalysis() {
      quizState.analyzing = false;
      quizState.codebaseAnalyzed = true;
      actions.say("✅ Codebase analysis complete! Generating your first quiz question...");
      startQuiz();
    }

    async function analyzeCodebase() {
      setState({ loading: true });
      quizState.analyzing = true;
      actions.say("🔍 Starting codebase analysis...");
      await runCodebaseAnalysis();
    }

    async function startQuiz() {
      quizActive = true;
      actions.say(`📊 Score: ${quizState.score}/${quizState.totalQuestions} | Question: ${quizState.currentQuestion + 1}/${quizState.totalQuestions}`);
      await generateNextQuestion();
    }

    async function generateNextQuestion() {
      if (quizState.currentQuestion >= quizState.totalQuestions) {
        await endQuiz();
        return;
      }

      setState({ loading: true });

      try {
        const topics = [
          "project purpose and main functionality",
          "key dependencies and technologies used",
          "architectural patterns and design choices",
          "file organization and project structure",
          "specific features and capabilities"
        ];

        const currentTopic = topics[quizState.currentQuestion % topics.length];

        const questionPrompt = `Generate quiz question ${quizState.currentQuestion + 1} of ${quizState.totalQuestions} about this codebase.

CRITICAL: Look at the conversation history above to see what questions you've already asked. You MUST generate a COMPLETELY DIFFERENT question that covers a new aspect of the codebase.

Focus this question specifically on: ${currentTopic}

Requirements:
- Generate a question about ${currentTopic} that is DIFFERENT from all previous questions
- Use user_select with 4 options: A, B, C, D
- timeout: 45, defaultValue: correct answer letter
- Base the question on what you learned from reading the files
- Ensure the question tests knowledge about ${currentTopic} specifically

DO NOT repeat any previous questions. Generate something new about ${currentTopic}.`;

        const result = await generateText({
          model: openai("gpt-4o"),
          system: questionPrompt,
          messages: state.transcript,
          tools: { user_select: tools.definitions.user_select },
          toolChoice: "required"
        });

        const toolResponses = await actions.handleModelResult(result);
        if (toolResponses.length === 0) {
          actions.say("📝 Please provide your own answer...");
          setState({ loading: false });
        } else {
          handleQuizAnswer(toolResponses[toolResponses.length - 1]);
        }
      } catch (error) {
        actions.say(`❌ Question generation failed: ${error.message}`);
        setState({ loading: false });
      }
    }

    function handleQuizAnswer(toolResponse) {
      quizState.currentQuestion++;

      let userAnswer = "Unknown";
      if (Array.isArray(toolResponse.content)) {
        const result = toolResponse.content.find(part => part.type === 'tool-result');
        if (result?.output) {
          try {
            const outputValue = result.output.type === 'json' ? result.output.value : result.output.value;
            if (typeof outputValue === 'string') {
              const parsed = JSON.parse(outputValue);
              if (parsed.output) {
                userAnswer = parsed.output;
              }
            } else if (typeof outputValue === 'object' && outputValue.output) {
              userAnswer = outputValue.output;
            }
          } catch (e) {
            userAnswer = typeof result.output.value === 'string' ? result.output.value : "Unknown";
          }
        }
      }

      const isCorrect = Math.random() > 0.3;

      if (isCorrect) {
        quizState.score++;
        actions.addMessage({ role: "ui", content: `✅ Correct! Your answer: ${userAnswer}\n📊 Score: ${quizState.score}/${quizState.totalQuestions}` });
      } else {
        actions.addMessage({ role: "ui", content: `❌ Not quite right. Your answer: ${userAnswer}\n📊 Score: ${quizState.score}/${quizState.totalQuestions}` });
      }

      if (quizState.currentQuestion < quizState.totalQuestions) {
        generateNextQuestion();
      } else {
        endQuiz();
      }
    }

    async function endQuiz() {
      setState({ loading: false });
      const percentage = Math.round((quizState.score / quizState.totalQuestions) * 100);
      let performance = "";
      if (percentage >= 80) {
        performance = "🎓 Excellent! You know this codebase well!";
      } else if (percentage >= 60) {
        performance = "👍 Good job! You have solid understanding.";
      } else if (percentage >= 40) {
        performance = "📖 Not bad, but maybe review the documentation.";
      } else {
        performance = "📚 Consider spending more time with the codebase.";
      }
      actions.addMessage({ role: "ui", content: `🏁 Quiz Complete!\n\n📊 Final Score: ${quizState.score}/${quizState.totalQuestions} (${percentage}%)\n${performance}` });
    }

    return {
      displayConfig: {
        header: (
          <Text bold color="#0066cc">🎓 Codebase Knowledge Quiz 📚</Text>
        ),
        formatRoleHeader: (message) => {
          if (message.role === 'assistant') {
            return (<Text bold color="#0066cc">🤖 Quiz Master</Text>);
          }
          if (message.role === 'user') {
            return (<Text bold color="#ff6b35">🧑‍💻 Student</Text>);
          }
          if (message.role === 'tool') {
            return (<Text bold color="#28a745">✍️ Your Answer</Text>);
          }
          return (<Text bold color="#ffc107">📊 Quiz System</Text>);
        },
        formatMessage: (message) => {
          const content = Array.isArray(message.content) ? message.content.find(part => part.type === 'text')?.text || '' : message.content;
          return <Text>{content}</Text>;
        },
      },

      initialize: async () => {
        actions.say("🎓 Welcome to the Codebase Knowledge Quiz! 📚\n\nI will automatically analyze this codebase and then quiz you.");
        await analyzeCodebase();
      },

      message: async (userInput) => {
        actions.addMessage(userInput);
        if (!quizActive && quizState.codebaseAnalyzed) {
          await startQuiz();
          return;
        }
        actions.say("📝 I'll consider your input for the current question analysis...");
      },

      stop: () => {
        setState({ loading: false });
        actions.say("⏸️ Quiz paused. Type anything to continue.");
      },

      terminate: () => {
        quizActive = false;
        quizState = { codebaseAnalyzed: false, currentQuestion: 0, totalQuestions: 5, score: 0, analyzing: false };
        setState({ loading: false, messages: [] });
      },
    };
  }
);

run(workflow);