import { afterEach, describe, expect, it, vi } from "vitest";
import { writeMindsMcpStderr } from "../redacted-stderr.js";

describe("Minds MCP redacted stderr logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not write raw Error objects or token-like values", () => {
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    writeMindsMcpStderr(
      "[minds-mcp] failed with github_pat_abcdefghijklmnopqrstuvwxyz",
      new Error("contains minds_secret_value"),
    );

    const line = String(writeSpy.mock.calls[0][0]);
    expect(line).toContain("[minds-mcp] failed with github_pat_[redacted] [Error redacted]");
    expect(line).not.toContain("minds_secret_value");
    expect(line).not.toContain("abcdefghijklmnopqrstuvwxyz");
  });
});
