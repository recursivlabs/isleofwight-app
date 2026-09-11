import { describe, expect, it } from "vitest";
import { Scopes } from "@recursiv/mcp";
import {
  DEFAULT_MINDS_MCP_SCOPES,
  DEFAULT_MINDS_MCP_WRITE_SCOPES,
  mindsPlatformToolsEnabled,
  mindsWriteToolsEnabled,
  parseScopeList,
  resolveMindsGrantedScopes,
} from "./scope-policy.js";

describe("Minds MCP scope policy", () => {
  it("defaults to read-only social/content scopes instead of all Recursiv tools", () => {
    const scopes = resolveMindsGrantedScopes({});

    expect(scopes).toBeInstanceOf(Set);
    expect(scopes).toEqual(new Set(DEFAULT_MINDS_MCP_SCOPES));
    for (const writeScope of DEFAULT_MINDS_MCP_WRITE_SCOPES) {
      expect(scopes).not.toContain(writeScope);
    }
    expect(scopes).not.toContain(Scopes.PROJECTS_WRITE);
    expect(scopes).not.toContain(Scopes.DATABASES_WRITE);
    expect(scopes).not.toContain(Scopes.STORAGE_WRITE);
    expect(scopes).not.toContain(Scopes.WALLET_WRITE);
    expect(scopes).not.toContain(Scopes.BILLING_WRITE);
    expect(scopes).not.toContain(Scopes.ADMIN);
  });

  it("allows explicit all-scopes mode only when requested by env", () => {
    expect(parseScopeList("*")).toBeNull();
    expect(parseScopeList("all")).toBeNull();
    expect(resolveMindsGrantedScopes({ MINDS_API_KEY_SCOPES: "*" })).toBeNull();
  });

  it("prefers Minds scope env over Recursiv scope env", () => {
    const scopes = resolveMindsGrantedScopes({
      MINDS_API_KEY_SCOPES: "posts:read,chat:read",
      RECURSIV_API_KEY_SCOPES: "admin",
    });

    expect(scopes).toEqual(new Set(["posts:read", "chat:read"]));
  });

  it("requires explicit platform tool opt-in", () => {
    expect(mindsPlatformToolsEnabled({})).toBe(false);
    expect(
      mindsPlatformToolsEnabled({ MINDS_MCP_ENABLE_PLATFORM_TOOLS: "1" }),
    ).toBe(true);
    expect(
      mindsPlatformToolsEnabled({ MINDS_MCP_ENABLE_PLATFORM_TOOLS: "true" }),
    ).toBe(true);
    expect(
      mindsPlatformToolsEnabled({ MINDS_MCP_ENABLE_PLATFORM_TOOLS: "yes" }),
    ).toBe(true);
  });

  it("requires explicit write tool opt-in for default scopes", () => {
    expect(mindsWriteToolsEnabled({})).toBe(false);
    expect(mindsWriteToolsEnabled({ MINDS_MCP_ENABLE_WRITES: "1" })).toBe(true);

    const scopes = resolveMindsGrantedScopes({ MINDS_MCP_ENABLE_WRITES: "1" });
    for (const writeScope of DEFAULT_MINDS_MCP_WRITE_SCOPES) {
      expect(scopes).toContain(writeScope);
    }
  });
});
