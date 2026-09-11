import prompts from 'prompts';
import { createClient } from '../lib/client.js';
import { loadApiKey, loadStoredApiKey, saveApiKey, clearApiKey } from '../lib/credentials.js';
import { log, printJson, exitWithError } from '../lib/output.js';

export const MINDS_PROJECT_ID = process.env.MINDS_PROJECT_ID
  ?? '019d5190-f0c0-717e-a1bd-ef9c335292b9';

/** Least-privilege scopes needed by the CLI's implemented authenticated commands. */
export const MINDS_CLI_SCOPES = [
  'posts:read', 'posts:write',
  'users:read',
  'communities:read',
  'chat:read', 'chat:write',
  'agents:read',
  'notifications:read',
] as const;

interface LoginOptions {
  apiKey?: boolean;
}

/**
 * Best-effort revocation of the key login replaced, called only AFTER its
 * replacement is safely on disk — a failed save must not kill the working
 * key. Logout learned the revocation itself in #692; without it,
 * `login → login` strands a live server-side credential the user can no
 * longer see. Revokes only the key that was in ~/.minds/credentials — never
 * an env-supplied key or the shared ~/.recursiv fallback — and never the
 * key that was saved.
 */
async function retireReplacedKey(
  replacedKey: string | undefined,
  savedKey: string,
): Promise<void> {
  if (!replacedKey || replacedKey === savedKey) return;
  const minds = createClient({ apiKey: replacedKey });
  try {
    await minds.auth.revokeCurrentKey();
    log.info('Revoked the previously stored API key on the server.');
  } catch {
    log.warn(
      'Could not revoke the previously stored API key on the server — it may still be active. '
        + 'You can revoke it from your Minds settings.',
    );
  }
}

/**
 * When the freshly minted key cannot be persisted, the user has never seen
 * it and has no way to ever use or revoke it — so revoke it and retire the
 * OTP session rather than strand two live credentials server-side (the
 * contract recursiv#2850/#2852 applied to the mint's own failure paths,
 * applied here to the persist step).
 */
async function discardMintedCredentials(
  minds: ReturnType<typeof createClient>,
  result: { apiKey: string; session?: { token?: string } },
): Promise<void> {
  try {
    await createClient({ apiKey: result.apiKey }).auth.revokeCurrentKey();
    log.info('Revoked the just-minted API key on the server.');
  } catch {
    log.warn(
      'Could not revoke the just-minted API key — it may remain active. '
        + 'You can revoke it from your Minds settings.',
    );
  }
  if (result.session?.token) {
    try {
      await minds.auth.signOut(result.session.token);
    } catch {
      log.warn('Could not retire the temporary OTP session.');
    }
  }
}

async function loginWithApiKey(): Promise<void> {
  const existing = loadStoredApiKey();
  if (existing) {
    log.warn('You already have an API key stored. Continuing will overwrite it.');
  }

  const { apiKey } = await prompts({
    type: 'password',
    name: 'apiKey',
    message: 'Paste your Minds API key (starts with sk_live_ or sk_test_)',
  });

  if (!apiKey) {
    exitWithError('No API key provided.');
  }

  if (!/^sk_(live|test)_[a-zA-Z0-9]{20,}$/.test(apiKey)) {
    log.warn('Key format does not match expected sk_live_/sk_test_ pattern. Saving anyway.');
  }

  try {
    saveApiKey(apiKey);
  } catch (err) {
    // The pasted key is not CLI-minted, so it is never revoked here; and the
    // previously stored key has not been touched yet, so it keeps working.
    exitWithError(
      `Could not write ~/.minds/credentials (${err instanceof Error ? err.message : String(err)}). No key was revoked: the pasted key and the previously stored one are both untouched.`,
    );
  }
  await retireReplacedKey(existing, apiKey);
  log.success('API key saved to ~/.minds/credentials');
}

export async function loginCommand(opts: LoginOptions = {}): Promise<void> {
  if (opts.apiKey) {
    await loginWithApiKey();
    return;
  }

  const existing = loadStoredApiKey();
  if (existing) {
    log.warn('You already have an API key stored. Continuing will overwrite it.');
  }

  const { email: rawEmail } = await prompts({
    type: 'text',
    name: 'email',
    message: 'Email address',
  });
  const email = rawEmail?.trim().toLowerCase();
  if (!email) {
    exitWithError('No email address provided.');
  }

  const minds = createClient({ allowNoKey: true });
  await minds.auth.sendOtp({ email }, { projectId: MINDS_PROJECT_ID });
  log.info(`We sent a sign-in code to ${email}.`);

  const { otp: rawOtp } = await prompts({
    type: 'password',
    name: 'otp',
    message: 'Six-digit sign-in code',
  });
  const otp = rawOtp?.trim();
  if (!otp) {
    exitWithError('No sign-in code provided.');
  }

  const result = await minds.auth.verifyOtpAndCreateKey(
    { email, otp },
    {
      name: `minds-cli-${Date.now()}`,
      description: 'Minds CLI session',
      scopes: [...MINDS_CLI_SCOPES],
      projectId: MINDS_PROJECT_ID,
    },
  );

  // The new key exists server-side from here on. Persist it BEFORE revoking
  // anything: if the write fails, the previously stored key must keep
  // working, and the minted key — which the user has never seen and now
  // never will — must not be left alive server-side.
  try {
    saveApiKey(result.apiKey);
  } catch (err) {
    await discardMintedCredentials(minds, result);
    exitWithError(
      `Could not write ~/.minds/credentials (${err instanceof Error ? err.message : String(err)}). The previously stored key, if any, was not revoked and keeps working.`,
    );
  }

  await retireReplacedKey(existing, result.apiKey);

  // OTP verification also creates a short-lived browser-style session. The
  // CLI only needs its project-bound API key, so retire the extra credential.
  if (result.session?.token) {
    try {
      await minds.auth.signOut(result.session.token);
    } catch {
      log.warn('Signed in, but could not retire the temporary OTP session.');
    }
  }

  const account = result.user?.email ?? email;
  log.success(`Signed in as ${account}. Credentials saved to ~/.minds/credentials`);
}

export async function logoutCommand(): Promise<void> {
  const stored = loadStoredApiKey();

  if (stored) {
    // Revoke exactly the credential we stored — never an env-supplied key or
    // the shared ~/.recursiv fallback, which logout did not create.
    const minds = createClient({ apiKey: stored });
    try {
      await minds.auth.revokeCurrentKey();
      log.info('Revoked the stored API key on the server.');
    } catch {
      log.warn(
        'Could not revoke the stored API key on the server — it may still be active. '
          + 'You can revoke it from your Minds settings.',
      );
    }
  }

  try {
    clearApiKey();
  } catch (err) {
    // Revocation already reported its own outcome above; a file we cannot
    // delete must not be reported as cleared.
    exitWithError(
      `Could not delete ~/.minds/credentials (${err instanceof Error ? err.message : String(err)}). Delete the file manually — see above for whether its key was revoked.`,
    );
  }

  if (loadApiKey()) {
    log.warn(
      'A key from MINDS_API_KEY/RECURSIV_API_KEY or ~/.recursiv/credentials still applies — '
        + 'the CLI stays signed in through it.',
    );
  }
  log.success(stored ? 'Signed out. Cleared ~/.minds/credentials' : 'Cleared ~/.minds/credentials');
}

export async function whoamiCommand(opts: { json?: boolean }): Promise<void> {
  const minds = createClient();
  const me = await minds.users.me();
  if (opts.json) return printJson(me);
  const user = (me as { data?: { id: string; name: string; email: string; username: string } }).data;
  if (!user) return exitWithError('Could not fetch profile.');
  log.info(`Signed in as ${user.name} (${user.email})`);
  log.dim(`  user_id:  ${user.id}`);
  log.dim(`  username: @${user.username}`);
}
