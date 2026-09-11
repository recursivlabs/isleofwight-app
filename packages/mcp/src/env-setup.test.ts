import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENV_KEYS = [
  "MINDS_API_KEY",
  "MINDS_API_URL",
  "MINDS_ORG_ID",
  "MINDS_ORGANIZATION_ID",
  "MINDS_PROJECT_ID",
  "RECURSIV_API_KEY",
  "RECURSIV_BASE_URL",
  "RECURSIV_ORG_ID",
  "RECURSIV_ORGANIZATION_ID",
  "RECURSIV_PROJECT_ID",
] as const;

const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("env-setup", () => {
  it("mirrors Minds scopes over inherited Recursiv values as an import side effect", async () => {
    // Simulate a hosted process: parent RECURSIV_* values already present,
    // Minds-specific values explicitly configured. The module body must make
    // the Minds scopes win the moment it is imported — before @recursiv/mcp's
    // module-scope env captures can run.
    process.env.MINDS_ORG_ID = "minds-org";
    process.env.RECURSIV_ORGANIZATION_ID = "parent-org";
    process.env.RECURSIV_ORG_ID = "legacy-parent-org";
    process.env.MINDS_PROJECT_ID = "minds-project";
    process.env.RECURSIV_PROJECT_ID = "parent-project";
    process.env.MINDS_API_KEY = "minds-key";
    process.env.RECURSIV_API_KEY = "parent-key";
    process.env.MINDS_API_URL = "https://api.minds.example/api/v1";
    process.env.RECURSIV_BASE_URL = "https://api.parent.example";

    await import("./env-setup.js");

    // Explicit Minds scopes are authoritative.
    expect(process.env.RECURSIV_ORGANIZATION_ID).toBe("minds-org");
    expect(process.env.RECURSIV_ORG_ID).toBe("minds-org");
    expect(process.env.RECURSIV_PROJECT_ID).toBe("minds-project");
    // Credentials and base URL keep fill-if-empty semantics.
    expect(process.env.RECURSIV_API_KEY).toBe("parent-key");
    expect(process.env.RECURSIV_BASE_URL).toBe("https://api.parent.example");
  });

  it("is imported by index.ts before @recursiv/mcp, so the mirrors beat module-scope env captures", () => {
    // @recursiv/mcp's memory, self-evaluate, swarms and agents registrars read
    // RECURSIV_ORGANIZATION_ID / RECURSIV_PROJECT_ID at MODULE scope. ES module
    // imports evaluate in declaration order before the importer's body, so the
    // env mirroring is only effective if env-setup is imported first. This pins
    // the real entry source; reordering the imports fails it.
    const source = readFileSync(resolve(__dirname, "index.ts"), "utf8");
    const envSetupAt = source.indexOf('import "./env-setup.js"');
    const recursivMcpAt = source.indexOf('from "@recursiv/mcp"');

    expect(envSetupAt).toBeGreaterThanOrEqual(0);
    expect(recursivMcpAt).toBeGreaterThan(0);
    expect(envSetupAt).toBeLessThan(recursivMcpAt);

    // And nothing in index.ts still calls dotenv config() in its body — that
    // path runs after every import and is exactly the too-late failure mode.
    expect(source).not.toContain('from "dotenv"');
  });
});
