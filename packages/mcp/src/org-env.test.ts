import { describe, expect, it } from "vitest";
import {
  applyMindsOrganizationEnvironment,
  applyMindsProjectEnvironment,
} from "./org-env.js";

describe("applyMindsOrganizationEnvironment", () => {
  it("makes MINDS_ORG_ID win over inherited Recursiv organization values", () => {
    const env = {
      MINDS_ORG_ID: "minds-org",
      RECURSIV_ORGANIZATION_ID: "parent-org",
      RECURSIV_ORG_ID: "legacy-parent-org",
    };

    expect(applyMindsOrganizationEnvironment(env)).toBe("minds-org");
    expect(env.RECURSIV_ORGANIZATION_ID).toBe("minds-org");
    expect(env.RECURSIV_ORG_ID).toBe("minds-org");
  });

  it("prefers the canonical Minds name when both Minds aliases are present", () => {
    const env = {
      MINDS_ORGANIZATION_ID: "canonical-minds-org",
      MINDS_ORG_ID: "legacy-minds-org",
      RECURSIV_ORGANIZATION_ID: "parent-org",
      RECURSIV_ORG_ID: "legacy-parent-org",
    };

    expect(applyMindsOrganizationEnvironment(env)).toBe("canonical-minds-org");
    expect(env.RECURSIV_ORGANIZATION_ID).toBe("canonical-minds-org");
    expect(env.RECURSIV_ORG_ID).toBe("canonical-minds-org");
  });

  it("preserves Recursiv defaults when no Minds organization is configured", () => {
    const env = {
      RECURSIV_ORGANIZATION_ID: "parent-org",
      RECURSIV_ORG_ID: "legacy-parent-org",
    };

    expect(applyMindsOrganizationEnvironment(env)).toBeUndefined();
    expect(env.RECURSIV_ORGANIZATION_ID).toBe("parent-org");
    expect(env.RECURSIV_ORG_ID).toBe("legacy-parent-org");
  });
});

describe("applyMindsProjectEnvironment", () => {
  it("makes MINDS_PROJECT_ID win over an inherited Recursiv project value", () => {
    const env = {
      MINDS_PROJECT_ID: "minds-project",
      RECURSIV_PROJECT_ID: "parent-project",
    };

    expect(applyMindsProjectEnvironment(env)).toBe("minds-project");
    expect(env.RECURSIV_PROJECT_ID).toBe("minds-project");
  });

  it("preserves the Recursiv default when no Minds project is configured", () => {
    const env = {
      RECURSIV_PROJECT_ID: "parent-project",
    };

    expect(applyMindsProjectEnvironment(env)).toBeUndefined();
    expect(env.RECURSIV_PROJECT_ID).toBe("parent-project");
  });

  it("treats a whitespace-only Minds project id as unset", () => {
    const env = {
      MINDS_PROJECT_ID: "   ",
      RECURSIV_PROJECT_ID: "parent-project",
    };

    expect(applyMindsProjectEnvironment(env)).toBeUndefined();
    expect(env.RECURSIV_PROJECT_ID).toBe("parent-project");
  });
});
