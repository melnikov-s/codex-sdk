// Deploy Dashboard - showcasing the Slots API in a realistic CI/CD flow
// - Persistent environment banner (aboveHeader)
// - Release summary (belowHeader)
// - Live pipeline progress bar (aboveHistory)
// - Contextual tips (belowHistory)
// - Live canary/health info (aboveInput)
// - Shortcuts/help (belowInput)
// - Slash commands: /deploy, /cancel, /canary <percent>

import { run, createAgentWorkflow } from "../dist/lib.js";
import { Box, Text } from "ink";
import { createElement as h } from "react";

function ProgressBar({ percent, width = 32, color = "green" }) {
  const fullBars = Math.round((percent / 100) * width);
  const emptyBars = Math.max(0, width - fullBars);
  return h(
    Box,
    { flexDirection: "row" },
    h(Text, { color, bold: true }, "⟦"),
    h(Text, { color }, "█".repeat(fullBars)),
    h(Text, { dimColor: true }, "░".repeat(emptyBars)),
    h(Text, { color, bold: true }, "⟧ "),
    h(Text, { dimColor: true }, `${percent}%`),
  );
}

function EnvBanner({ env }) {
  const colors = { prod: "redBright", staging: "yellow", dev: "cyan" };
  return h(
    Box,
    { borderStyle: "round", paddingX: 1 },
    h(
      Text,
      { bold: true, color: colors[env] || "magenta" },
      `🚀 ${env.toUpperCase()} Deploy Dashboard`,
    ),
  );
}

function ReleaseSummary({ version, service, author }) {
  return h(
    Text,
    { dimColor: true },
    `Release ${version} • Service: ${service} • By: ${author}`,
  );
}

const STEPS = [
  "Build",
  "Tests",
  "Dockerize",
  "Push Image",
  "DB Migrations",
  "Rollout",
  "Health Check",
];

export const workflow = createAgentWorkflow(
  "Deploy Dashboard",
  ({ setState, actions }) => {
    let active = false;
    let cancelled = false;
    let percent = 0;
    let stepIndex = 0;
    let canaryPercent = 10;

    function setSlotAboveHistory(node) {
      setState({ slots: { aboveHistory: node } });
    }

    function setSlotAboveInput(node) {
      setState({ slots: { aboveInput: node } });
    }

    function setSlotBelowInput(node) {
      setState({ slots: { belowInput: node } });
    }

    function setHeaderSlots() {
      setState({
        slots: {
          aboveHeader: h(EnvBanner, { env: "prod" }),
          belowHeader: h(ReleaseSummary, {
            version: "v1.8.3",
            service: "payments-api",
            author: "@jane",
          }),
        },
      });
    }

    function setHelp() {
      setSlotBelowInput(
        h(
          Text,
          { dimColor: true },
          "Shortcuts: /deploy • /cancel • /canary <pct> • Type to chat",
        ),
      );
    }

    function renderProgress() {
      const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];
      setSlotAboveHistory(
        h(
          Box,
          { flexDirection: "column" },
          h(Text, { bold: true }, `Pipeline: ${step}`),
          h(ProgressBar, { percent }),
        ),
      );
      setState({
        statusLine: h(
          Text,
          {
            color: percent < 100 ? "yellow" : "green",
          },
          percent < 100
            ? `Deploy in progress • Step ${stepIndex + 1}/${STEPS.length}`
            : "Deploy complete ✓",
        ),
      });
      setSlotAboveInput(
        h(
          Text,
          { color: "magenta" },
          `Canary: ${canaryPercent}% • Current step: ${step}`,
        ),
      );
    }

    async function sleep(ms) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function runDeploy() {
      if (active) {
        return;
      }
      active = true;
      cancelled = false;
      percent = 0;
      stepIndex = 0;

      actions.say("Starting deployment…");

      for (stepIndex = 0; stepIndex < STEPS.length; stepIndex++) {
        for (let i = 0; i < 20; i++) {
          if (cancelled) {
            break;
          }
          percent = Math.min(
            99,
            Math.round(((stepIndex + i / 20) / STEPS.length) * 100),
          );
          renderProgress();
          await sleep(150);
        }
        if (cancelled) {
          break;
        }
        actions.say(`✓ ${STEPS[stepIndex]} complete`);
      }

      if (cancelled) {
        actions.say("Deployment cancelled.");
        setState({
          statusLine: h(Text, { color: "red" }, "Cancelled"),
          slots: { aboveHistory: null, aboveInput: null },
        });
        active = false;
        return;
      }

      percent = 100;
      renderProgress();
      actions.say("🎉 Deployment complete");
      setState({ slots: { aboveHistory: null } });
      active = false;
    }

    function parseCommand(input) {
      const trimmed = String(input).trim();
      if (trimmed.startsWith("/canary")) {
        const parts = trimmed.split(/\s+/);
        const val = Number(parts[1]);
        if (!Number.isNaN(val) && val >= 0 && val <= 100) {
          canaryPercent = val;
          setSlotAboveInput(
            h(Text, { color: "magenta" }, `Canary: ${canaryPercent}%`),
          );
          actions.say(`Canary updated to ${canaryPercent}%`);
        } else {
          actions.say(`Invalid canary value: ${parts[1]}`);
        }
        return true;
      }
      if (trimmed === "/deploy") {
        void runDeploy();
        return true;
      }
      if (trimmed === "/cancel") {
        if (active) {
          cancelled = true;
        }
        return true;
      }
      return false;
    }

    return {
      title: "Release Assistant",
      displayConfig: {
        header: h(
          Text,
          { bold: true, color: "#a0e7e5" },
          "🧭 Release Assistant",
        ),
        formatRoleHeader: (msg) =>
          msg.role === "user"
            ? h(Text, { bold: true, color: "#87cefa" }, "👤 You")
            : msg.role === "assistant"
              ? h(Text, { bold: true, color: "#dda0dd" }, "🤖 Assistant")
              : h(Text, { bold: true, color: "#ffd93d" }, "🛠️ Log"),
      },

      initialize: () => {
        setHeaderSlots();
        setHelp();
        setState({
          slots: {
            belowHistory: h(
              Text,
              { dimColor: true },
              "Tip: Use /canary 5 to start gentle rollout",
            ),
          },
        });
        actions.say("Type /deploy to start a production rollout.");
      },

      message: async (userInput) => {
        actions.addMessage(userInput);
        if (parseCommand(userInput.content)) {
          return;
        }
        // Freeform chat could be handled here; keep it simple for the demo.
        actions.say("Commands: /deploy, /cancel, /canary <pct>");
      },

      stop: () => {
        cancelled = true;
        setState({ statusLine: h(Text, { color: "yellow" }, "Paused") });
      },

      terminate: () => {
        cancelled = true;
        active = false;
        setState({
          loading: false,
          messages: [],
          statusLine: undefined,
          slots: { aboveHistory: null, aboveInput: null, belowInput: null },
        });
      },

      commands: {
        deploy: {
          description: "Start deployment pipeline",
          handler: () => void runDeploy(),
        },
        cancel: {
          description: "Cancel current pipeline",
          handler: () => {
            cancelled = true;
          },
        },
        canary: {
          description: "Set canary percent (usage: /canary 25)",
          handler: (args) => {
            const val = Number((args || "").trim());
            if (!Number.isNaN(val) && val >= 0 && val <= 100) {
              canaryPercent = val;
              setSlotAboveInput(
                h(Text, { color: "magenta" }, `Canary: ${canaryPercent}%`),
              );
            }
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
