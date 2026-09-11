/**
 * Environment setup for the Minds MCP entry — MUST be imported before
 * `@recursiv/mcp`.
 *
 * Several shared registrars capture their env-based defaults at MODULE scope
 * (`@recursiv/mcp` memory, self-evaluate, swarms and agents tools all read
 * RECURSIV_ORGANIZATION_ID / RECURSIV_PROJECT_ID when their module first
 * evaluates). ES module imports are evaluated before the importing module's
 * body runs, so any dotenv loading or MINDS_* → RECURSIV_* mirroring done in
 * index.ts's body happens too late for those tools: they keep whatever the
 * process inherited from the parent platform. This module exists so the
 * mirroring runs as an import side effect, ahead of the shared package.
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyMindsOrganizationEnvironment,
  applyMindsProjectEnvironment,
} from "./org-env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", "..", ".env") });

// The shared @recursiv/mcp registrars own RED-tool approval gates and env
// defaults. Mirror Minds env names before that package evaluates so a
// Minds-only deployment gets the same approval and default-scope behavior —
// and so an explicitly configured Minds scope beats values inherited from a
// parent platform process.
if (!process.env.RECURSIV_API_KEY && process.env.MINDS_API_KEY) {
  process.env.RECURSIV_API_KEY = process.env.MINDS_API_KEY;
}
if (!process.env.RECURSIV_BASE_URL && process.env.MINDS_API_URL) {
  process.env.RECURSIV_BASE_URL = process.env.MINDS_API_URL;
}
applyMindsOrganizationEnvironment(process.env);
applyMindsProjectEnvironment(process.env);
