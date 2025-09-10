import { onExit } from "./terminal.js";

/**
 * Attach process exit handlers for graceful cleanup
 */
export function attachExitHandlers(handleExit: () => void): () => void {
  const handleProcessExit = () => {
    onExit(); // This will attempt to unmount Ink
    process.exit(0);
  };

  process.on("SIGINT", handleProcessExit);
  process.on("SIGQUIT", handleProcessExit);
  process.on("SIGTERM", handleProcessExit);

  // Fallback for Ctrl-C when stdin is in raw-mode (which Ink uses)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    const onRawData = (data: Buffer | string): void => {
      const str = Buffer.isBuffer(data)
        ? data.toString("utf8")
        : data.toString();
      if (str === "\u0003") {
        // ETX, Ctrl+C
        handleProcessExit();
      }
    };
    process.stdin.on("data", onRawData);
    // Ensure stdin cleanup on exit
    process.on("exit", () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onRawData);
      }
    });
  }

  // Ensure terminal clean-up always runs
  process.once("exit", onExit);

  // Override the provided handleExit to call the process exit
  const originalHandleExit = handleExit;
  const newHandleExit = () => {
    originalHandleExit();
    handleProcessExit();
  };

  return newHandleExit;
}
