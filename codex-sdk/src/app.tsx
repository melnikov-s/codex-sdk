import type { ApprovalPolicy } from "./approvals";
import type { LibraryConfig } from "./lib.js";
import type { WorkflowController, WorkflowFactory, WorkflowFactoryWithTitle, MultiWorkflowController } from "./workflow";
import type { ModelMessage } from "ai";

import TerminalChat from "./components/chat/terminal-chat";
import TerminalChatPastRollout from "./components/chat/terminal-chat-past-rollout";
import { checkInGit } from "./utils/check-in-git";
import { CLI_VERSION, type TerminalChatSession } from "./utils/session.js";
import { onExit } from "./utils/terminal";
import { ConfirmInput } from "@inkjs/ui";
import { Box, Text, useApp, useStdin } from "ink";
import React, { useMemo, useState } from "react";

export type AppRollout = {
  session: TerminalChatSession;
  items: Array<ModelMessage>;
};

type Props = {
  rollout?: AppRollout;
  approvalPolicy: ApprovalPolicy;
  additionalWritableRoots: ReadonlyArray<string>;
  fullStdout: boolean;
  uiConfig?: LibraryConfig;
} & (
  | {
      // Single workflow mode
      workflowFactory: WorkflowFactory;
      multiWorkflow?: false;
      onController?: (controller: WorkflowController) => void;
    }
  | {
      // Multi-workflow mode
      workflowFactory?: never;
      multiWorkflow: true;
      availableWorkflows: Array<WorkflowFactoryWithTitle>;
      onMultiController?: (controller: MultiWorkflowController) => void;
      onController?: (controller: WorkflowController | MultiWorkflowController) => void;
    }
);

export default function App(props: Props): JSX.Element {
  const {
    rollout,
    approvalPolicy,
    additionalWritableRoots,
    fullStdout,
    uiConfig,
    onController,
  } = props;
  const app = useApp();
  const [accepted, setAccepted] = useState(() => false);
  const [cwd, inGitRepo] = useMemo(
    () => [process.cwd(), checkInGit(process.cwd())],
    [],
  );
  const { internal_eventEmitter } = useStdin();
  internal_eventEmitter.setMaxListeners(20);

  if (rollout) {
    return (
      <TerminalChatPastRollout
        session={rollout.session}
        items={rollout.items}
      />
    );
  }

  if (!inGitRepo && !accepted) {
    return (
      <Box flexDirection="column">
        <Box borderStyle="round" paddingX={1} width={64}>
          <Text>
            ● <Text bold>Codex SDK</Text>{" "}
            <Text dimColor>
              <Text color="blueBright">v{CLI_VERSION}</Text>
            </Text>
          </Text>
        </Box>
        <Box
          borderStyle="round"
          borderColor="redBright"
          flexDirection="column"
          gap={1}
        >
          <Text>
            <Text color="yellow">Warning!</Text> It can be dangerous to run an
            agent outside of a git repo in case there are changes that you want
            to revert. Do you want to continue?
          </Text>
          <Text>{cwd}</Text>
          <ConfirmInput
            defaultChoice="cancel"
            onCancel={() => {
              app.exit();
              onExit();
              // eslint-disable-next-line
              console.error(
                "Quitting! Run again to accept or from inside a git repo",
              );
            }}
            onConfirm={() => setAccepted(true)}
          />
        </Box>
      </Box>
    );
  }

  if (props.multiWorkflow) {
    // Multi-workflow mode
    return (
      <TerminalChat
        approvalPolicy={approvalPolicy}
        additionalWritableRoots={additionalWritableRoots}
        fullStdout={fullStdout}
        multiWorkflow={true}
        availableWorkflows={props.availableWorkflows}
        onMultiController={props.onMultiController}
        uiConfig={uiConfig}
      />
    );
  } else {
    // Single workflow mode
    return (
      <TerminalChat
        approvalPolicy={approvalPolicy}
        additionalWritableRoots={additionalWritableRoots}
        fullStdout={fullStdout}
        workflowFactory={props.workflowFactory}
        uiConfig={uiConfig}
        onController={onController}
      />
    );
  }
}
