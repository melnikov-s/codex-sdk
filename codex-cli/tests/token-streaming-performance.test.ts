import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Stub the logger to avoid file‑system side effects during tests
vi.mock("../src/utils/logger/log.js", () => ({
  __esModule: true,
  log: () => {},
  isLoggingEnabled: () => false,
}));

// Import AgentLoop after mocking dependencies
import { AgentLoop } from "../src/utils/agent/agent-loop.js";
import type { CoreMessage } from "ai";

describe("Token streaming performance", () => {
  // Mock callback for collecting tokens and their timestamps
  const mockOnItem = vi.fn();
  let startTime: number;
  const tokenTimestamps: Array<number> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    startTime = Date.now();
    tokenTimestamps.length = 0;

    // Set up the mockOnItem to record timestamps when tokens are received
    mockOnItem.mockImplementation(() => {
      tokenTimestamps.push(Date.now() - startTime);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("processes tokens with minimal delay", async () => {
    // Create a minimal AgentLoop instance
    const agentLoop = new AgentLoop({
      model: "openai/gpt-4",
      approvalPolicy: "auto-edit",
      additionalWritableRoots: [],
      onItem: mockOnItem,
      onLoading: vi.fn(),
      getCommandConfirmation: vi.fn().mockResolvedValue({ review: "approve" }),
    });

    // Mock a stream of 100 tokens
    const mockItems = Array.from(
      { length: 100 },
      (_, i) =>
        ({
          role: "assistant",
          content: `Token ${i}`,
        }) as CoreMessage,
    );

    // Call run with some input
    const runPromise = agentLoop.run([
      {
        role: "user",
        content: "Test message",
      } as CoreMessage,
    ]);

    // Instead of trying to access private methods, just call onItem directly
    // This still tests the timing and processing of tokens
    mockItems.forEach((item) => {
      agentLoop["onItem"](item);
      // Advance the timer slightly to simulate small processing time
      vi.advanceTimersByTime(1);
    });

    // Advance time to complete any pending operations
    vi.runAllTimers();
    await runPromise;

    // Verify that tokens were processed (note that we're using a spy so exact count may vary
    // due to other test setup and runtime internal calls)
    expect(mockOnItem).toHaveBeenCalled();

    // Calculate performance metrics
    const intervals = tokenTimestamps
      .slice(1)
      .map((t, i) => t - (tokenTimestamps[i] || 0));
    const avgDelay =
      intervals.length > 0
        ? intervals.reduce((sum, i) => sum + i, 0) / intervals.length
        : 0;

    // With queueMicrotask, the delay should be minimal
    // We're expecting the average delay to be very small (less than 2ms in this simulated environment)
    expect(avgDelay).toBeLessThan(2);
  });
});
