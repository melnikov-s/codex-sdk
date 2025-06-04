import { describe, it, expect, vi } from "vitest";
import * as TermUtils from "../src/utils/terminal.js";

// -------------------------------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------------------------------

describe("clearTerminal", () => {
  it("writes escape sequence to stdout", () => {
    const originalQuiet = process.env["CODEX_QUIET_MODE"];
    delete process.env["CODEX_QUIET_MODE"];

    process.env["CODEX_QUIET_MODE"] = "0";

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    TermUtils.clearTerminal();

    expect(writeSpy).toHaveBeenCalledWith("\x1b[3J\x1b[H\x1b[2J");

    writeSpy.mockRestore();

    if (originalQuiet !== undefined) {
      process.env["CODEX_QUIET_MODE"] = originalQuiet;
    } else {
      delete process.env["CODEX_QUIET_MODE"];
    }
  });
});
