import { Minds } from '@minds/sdk';
import { BASE_URL, PROJECT_ID } from './recursiv';

interface SignInOtpAuth {
  sendOtp(
    input: { email: string },
    appContext?: { projectId?: string; organizationId?: string },
  ): Promise<{ success: boolean }>;
}

// Both the normal Minds sign-in and the MCP OAuth bridge must use this exact
// transport. @recursiv/sdk 0.7.11 retries one transient send failure, while the
// matching server reuses a still-valid code so that retry cannot invalidate the
// email already in the user's inbox.
const signInOtpAuth: SignInOtpAuth = new Minds({
  baseUrl: BASE_URL,
  allowNoKey: true,
  timeout: 30_000,
  maxRetries: 1,
}).auth;

/** Send a project-scoped Minds sign-in code through the shared SDK path. */
export async function sendSignInOtp(
  email: string,
  auth: SignInOtpAuth = signInOtpAuth,
): Promise<void> {
  await auth.sendOtp({ email }, { projectId: PROJECT_ID });
}
