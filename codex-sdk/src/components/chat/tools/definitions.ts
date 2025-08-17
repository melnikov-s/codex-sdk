import { tool } from "ai";
import { z } from "zod";

export function createShellTool() {
  const ShellToolParametersSchema = z.object({
    cmd: z
      .array(z.string())
      .describe("The command and its arguments to execute."),
    workdir: z.string().describe("The working directory for the command."),
    timeout: z
      .number()
      .describe(
        "The maximum time to wait for the command to complete in milliseconds.",
      ),
  });

  return tool({
    description:
      "Run a command in the terminal, can be git or shell, or any other command available on the system.",
    inputSchema: ShellToolParametersSchema,
  });
}

export function createApplyPatchTool() {
  const ApplyPatchParametersSchema = z.object({
    cmd: z
      .array(z.string())
      .describe("The apply_patch invocation and payload."),
    workdir: z.string().describe("The working directory for the command."),
    timeout: z
      .number()
      .describe(
        "The maximum time to wait for the command to complete in milliseconds.",
      ),
  });

  return tool({
    description:
      'Use `apply_patch` to edit files: {"cmd":["apply_patch","*** Begin Patch\\n*** Update File: path/to/file.py\\n@@ def example():\\n-  pass\\n+  return 123\\n*** End Patch"]}.',
    inputSchema: ApplyPatchParametersSchema,
  });
}

export function createUserSelectTool() {
  const UserSelectSchema = z.object({
    message: z.string().describe("Selection prompt to show the user"),
    options: z
      .array(z.string())
      .describe("Array of option strings for user to choose from"),
    defaultValue: z
      .string()
      .describe(
        "Value to use if user doesn't respond in time (must match one of the options)",
      ),
  });

  return tool({
    description:
      "Show user a selection of options. Can be used for confirmations (Yes/No), prompted input, or pure selections. Automatically includes 'None of the above' option allowing custom input.",
    inputSchema: UserSelectSchema,
  });
}
