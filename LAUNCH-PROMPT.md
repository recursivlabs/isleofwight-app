# Minds 2.0 launch goal

Drive Minds 2.0 to a production launch across web, iOS, Android, API, MCP, CLI, SDK, packages, and
public docs. Work continuously and autonomously. Optimize for a product that feels complete, fast,
reliable, and understandable—not for agent activity, artifact counts, audits, or controller elegance.

## Pre-launch operating mode

Production currently has only Bill and Jack. Use this rare low-cost window to move quickly: make
reasonable reversible decisions, ship behind full-green required CI, test the changed behavior, learn
from the running product, and fix forward. Do not pause for clarification unless the choice is
destructive, irreversible, security-sensitive, or genuinely changes product direction.

Choose the next task by real product impact:

1. Repair broken core journeys: sign in, feed, create, media, discovery, profiles, chat, and
   notifications.
2. Complete and improve launch surfaces: web, native apps, API, MCP, CLI, SDK, packages, and docs.
3. Improve reliability, speed, accessibility, privacy, moderation, and user trust.
4. Do platform, CI, deployment, or housekeeping work only when it directly unblocks the above,
   removes a demonstrated recurring cost, or prevents material harm.

Every cycle should ship a user-visible improvement, fix a real defect, or directly unblock one. Do
not create proof-of-proof, duplicate audits, ceremonial micro-PRs, agent-only infrastructure, or
controller edits unless a concrete product decision depends on them. If process work produces no
patch or decision, record the blocker briefly and take the next product task.

## Proportional verification

- Reversible UI/client/docs/dev-experience change: focused tests, existing required CI, and one direct
  smoke if runtime behavior can differ.
- Shared API or cross-surface contract: focused regression coverage and one meaningful staging/live
  exercise. Verify materially different behavior, not every wrapper around the same contract.
- Hard-risk change: retain strict review, rollback, and named-human boundaries for tenant isolation,
  secrets, permissions, payments/billing, destructive data changes, production migrations, account
  deletion, privacy, moderation enforcement, and production data integrity.

Required CI must be green. Fix or remove flaky/redundant checks that do not protect a credible failure
mode. Prefer a real browser, device, or API result over narrative evidence. Use the smallest proof that
answers: “Does this work where users encounter it?”

## How to work

Start from fresh `main`; preserve unrelated work; use one branch and PR per coherent product change.
Read `docs/goal-prompt.md` for current dependencies and hard boundaries, with §1.P governing during
pre-launch. Run `bash scripts/loop-status.sh` before choosing work, but do not let stale ladder
bookkeeping outrank an obvious broken user journey.

Use the Minds and Recursiv MCPs as the live control plane: read and claim current tasks, heartbeat
while working, inspect staging, and use supported deployment/project tools. Use GitHub for source,
checks, PRs, and releases. Never bypass SDK/platform architecture with app-local raw API workarounds.
Use browser/device checks for experience claims and API/database checks only where they answer a real
behavior or risk question.

Implement, test, commit, push, open a clear PR, repair failures on that same PR, and merge when current,
fully green, and valid. Deploy through the supported path and verify the changed behavior live when the
change requires it. Then immediately take the next highest-impact unblocked task.

Stop only for a hard-risk boundary, destructive ambiguity, genuinely red CI you cannot repair, an
unresolved conflict with another owner, or a product decision reserved for Bill or Jack. Otherwise
choose, ship, observe, and continue. After public launch, tighten controls using actual traffic,
incidents, and blast radius rather than hypothetical risks.
