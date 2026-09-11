import { expect, type Page, test } from '@playwright/test';
import { authCooldownMs, E2E_HONORABLE_COOLDOWN_SECONDS } from './authCooldown';

// Read-mostly smoke against staging. It signs in and browses. It must NOT
// create posts, follows, or DMs — the only write is the sign-in session.
//
// Selector strategy: the app is React Native Web, so there are few semantic
// roles. We anchor on stable visible text and input placeholders from the
// source (app/index.tsx, app/(tabs)/*, components/PostCard.tsx).

const EMAIL = process.env.STAGING_QA_EMAIL;
const PASSWORD = process.env.STAGING_QA_PASSWORD;

// One serial story: sign in once, then walk the surfaces in the same page.
test.describe.configure({ mode: 'serial' });

// Every post card byline renders exactly one "· <time>" text node
// (components/PostCard.tsx). It is the cheapest reliable "a post rendered"
// marker, and clicking it bubbles to the card's onPress -> post detail.
const postTimeMarker = /^·\s/;

test.describe('staging smoke @smoke', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    if (!EMAIL || !PASSWORD) {
      throw new Error(
        'STAGING_QA_EMAIL and STAGING_QA_PASSWORD are not set. ' +
          'This smoke fails loudly instead of skipping silently.',
      );
    }
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('sign-in renders an authenticated surface @auth', async () => {
    test.setTimeout(4 * 60_000);
    await page.goto('/');
    // Landing carries the email field itself; the password path is a quiet
    // link. The old button label stays accepted while staging serves a build
    // from before this change.
    await page.getByText(/^(Use password instead|Log in with password)$/).first().click();
    await page.getByPlaceholder('Email or username').fill(EMAIL as string);
    const password = page.getByPlaceholder('Password', { exact: true });
    await password.fill(PASSWORD as string);
    // The password input wires onSubmitEditing to the login handler. A rapid
    // merge burst can legitimately exhaust staging's shared auth window, so
    // honor one bounded server-declared cooldown rather than immediately
    // hammering the same endpoint through Playwright's whole-story retry.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/api/auth/sign-in/email'),
        { timeout: 30_000 },
      );
      await password.press('Enter');
      const response = await responsePromise;
      if (response.status() !== 429) break;

      const retryAfter = response.headers()['retry-after'] ?? null;
      // The e2e job's budget cannot honor the engine's full 15-minute window;
      // beyond E2E_HONORABLE_COOLDOWN_SECONDS, fail fast with the declared
      // value instead of dying later as an opaque timeout (run 33033676911).
      const waitMs = authCooldownMs(response.status(), retryAfter, E2E_HONORABLE_COOLDOWN_SECONDS);
      if (waitMs === null) {
        throw new Error(
          `Staging sign-in rate-limited with Retry-After=${retryAfter}s, beyond the ` +
            `${E2E_HONORABLE_COOLDOWN_SECONDS}s this job's budget can honor — failing fast.`,
        );
      }
      if (attempt === 1) break;

      console.warn(
        `Staging sign-in rate-limited; retrying once after ${Math.floor(waitMs / 1_000) - 1}s server cooldown.`,
      );
      // The honored wait must not eat the test's own 4-minute budget: a 480s
      // cooldown under the unextended timeout dies inside this very wait.
      test.setTimeout(test.info().timeout + waitMs);
      await page.waitForTimeout(waitMs);
    }
    // The feed tab switcher only renders signed in (components/FeedTabs.tsx).
    await expect(page.getByText('For You', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Following', { exact: true }).first()).toBeVisible();
  });

  // Content-independent journeys run BEFORE the content-dependent ones: a
  // serial-group failure skips everything after it, and an empty staging
  // feed must not hide the compose and chat coverage.

  test('composer is reachable @compose', async () => {
    await page.goto('/create');
    await expect(page.getByPlaceholder("What's happening?")).toBeVisible({ timeout: 30_000 });
    // Deliberately no submit: this smoke never posts.
  });

  test('chat list renders @chat', async () => {
    await page.goto('/chat');
    // The chat screen's own search box — NOT the side-nav "Messages" section,
    // which renders on every authed web screen and would false-pass.
    await expect(page.getByPlaceholder('Search messages')).toBeVisible({ timeout: 30_000 });
  });

  test('feed renders posts or its designed empty state @feed', async () => {
    await page.goto('/');
    // A smoke proves the feed SCREEN works, not that the org has content.
    // With posts: the "· <time>" byline renders. Without: the designed
    // empty state renders (app/(tabs)/index.tsx). A broken feed shows
    // neither and still fails here.
    const post = page.getByText(postTimeMarker).first();
    const emptyState = page
      .getByText(/Build your feed|No trending posts yet/)
      .first();
    await expect(post.or(emptyState)).toBeVisible({ timeout: 30_000 });
  });

  test('post detail renders when the feed has content @post', async () => {
    const post = page.getByText(postTimeMarker).first();
    const hasContent = await post.isVisible().catch(() => false);
    test.skip(!hasContent, 'Staging feed has no posts — detail journey needs content to exist');
    await post.click();
    await expect(page).toHaveURL(/\/post\//, { timeout: 30_000 });
    // The detail screen's reply box proves the post view rendered, not just
    // the route change.
    await expect(page.getByPlaceholder('Write a reply...')).toBeVisible({ timeout: 30_000 });
  });
});
