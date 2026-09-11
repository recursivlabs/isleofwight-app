/**
 * @minds/api — typed REST contract for the Minds API.
 *
 * This package documents and types the public Minds REST surface. It
 * does NOT implement an HTTP server — for that, the canonical client
 * is `@minds/sdk` and the canonical server is `@recursiv/server`. This
 * package exists for:
 *
 * 1. Sharing request/response types between full-stack code without
 *    pulling in the entire SDK.
 * 2. Documenting the canonical API surface for Minds Cloud tenants who
 *    want to call the REST API directly (e.g., from non-JS runtimes
 *    that aren't @minds/sdk's target).
 * 3. Providing the base URL and endpoint constants in one place.
 *
 * Anything Recursiv exposes is exposed here too — types are re-exported
 * verbatim from `@minds/sdk`. Endpoint paths follow Recursiv's
 * `/api/v1/*` convention.
 */

/** Default Minds API base URL. Override via env or constructor in @minds/sdk. */
export const MINDS_API_BASE_URL = 'https://api.minds.com/api/v1';

/** Default Minds origin (without the /api/v1 suffix). */
export const MINDS_API_ORIGIN = 'https://api.minds.com';

/** Better Auth surface lives at the origin, not under /api/v1. */
export const MINDS_AUTH_BASE_URL = `${MINDS_API_ORIGIN}/api/auth`;

/**
 * Stable, human-readable map of REST endpoints. Useful for documentation,
 * for clients in non-TypeScript runtimes, and for analytics/observability
 * tooling that wants to group requests by logical endpoint.
 */
export const MINDS_API_ENDPOINTS = {
  // Auth (Better Auth surface — under /api/auth/*, not /api/v1/*)
  auth: {
    sendOtp: 'POST /api/auth/email-otp/send-verification-otp',
    verifyOtp: 'POST /api/auth/sign-in/email-otp',
    signIn: 'POST /api/auth/sign-in/email',
    signUp: 'POST /api/auth/sign-up/email',
    signOut: 'POST /api/auth/sign-out',
    forgetPassword: 'POST /api/auth/forget-password',
    getSession: 'GET /api/auth/get-session',
    apiKeys: 'POST /api/v1/api-keys',
  },

  // Social
  posts: {
    list: 'GET /api/v1/posts',
    get: 'GET /api/v1/posts/:id',
    create: 'POST /api/v1/posts',
    update: 'PATCH /api/v1/posts/:id',
    delete: 'DELETE /api/v1/posts/:id',
    react: 'POST /api/v1/posts/:id/reactions',
    unreact: 'DELETE /api/v1/posts/:id/reactions',
    search: 'GET /api/v1/posts/search',
  },
  communities: {
    list: 'GET /api/v1/communities',
    get: 'GET /api/v1/communities/:id',
    create: 'POST /api/v1/communities',
    update: 'PUT /api/v1/communities/:id',
    delete: 'DELETE /api/v1/communities/:id',
    join: 'POST /api/v1/communities/:id/join',
    leave: 'POST /api/v1/communities/:id/leave',
    members: 'GET /api/v1/communities/:id/members',
  },
  profiles: {
    me: 'GET /api/v1/profiles/me',
    getByUsername: 'GET /api/v1/profiles/by-username/:username',
    update: 'PUT /api/v1/profiles/me',
    follow: 'POST /api/v1/profiles/:id/follow',
    unfollow: 'DELETE /api/v1/profiles/:id/follow',
    followers: 'GET /api/v1/profiles/:id/followers',
    following: 'GET /api/v1/profiles/:id/following',
    search: 'GET /api/v1/profiles/search',
  },
  chat: {
    conversations: 'GET /api/v1/chat/conversations',
    conversation: 'GET /api/v1/chat/conversations/:id',
    messages: 'GET /api/v1/chat/conversations/:id/messages',
    send: 'POST /api/v1/chat/messages',
    sendAsAgent: 'POST /api/v1/chat/messages/as-agent',
    dm: 'POST /api/v1/chat/dm',
    createGroup: 'POST /api/v1/chat/conversations/group',
    deleteConversation: 'DELETE /api/v1/chat/conversations/:id',
    react: 'POST /api/v1/chat/messages/:id/react',
    markAsRead: 'POST /api/v1/chat/conversations/:id/read',
  },
  notifications: {
    list: 'GET /api/v1/notifications',
    markAsRead: 'POST /api/v1/notifications/:id/read',
    markAllAsRead: 'POST /api/v1/notifications/read-all',
    registerToken: 'POST /api/v1/notifications/tokens',
  },
  agents: {
    list: 'GET /api/v1/agents',
    get: 'GET /api/v1/agents/:id',
    create: 'POST /api/v1/agents',
    update: 'PUT /api/v1/agents/:id',
    delete: 'DELETE /api/v1/agents/:id',
    chat: 'POST /api/v1/agents/:id/chat',
    chatStream: 'POST /api/v1/agents/:id/chat/stream',
    listDiscoverable: 'GET /api/v1/agents/discoverable',
    ensurePersonal: 'POST /api/v1/agents/ensure-personal',
  },
  curator: {
    run: 'POST /api/v1/curator/run',
    seedDeck: 'GET /api/v1/curator/seed-deck',
  },
  reports: {
    create: 'POST /api/v1/reports',
    list: 'GET /api/v1/reports',
  },
  linkPreview: {
    get: 'GET /api/v1/link-preview',
  },

  // Platform (full surface — see Recursiv docs for details)
  projects: 'GET|POST /api/v1/projects',
  organizations: 'GET|POST /api/v1/organizations',
  billing: 'GET /api/v1/billing/*',
  wallet: 'GET /api/v1/wallet/*',
  uploads: 'POST /api/v1/uploads/*',
  databases: 'GET|POST /api/v1/databases/*',
  deployments: 'GET|POST /api/v1/deployments/*',
  webhooks: 'GET|POST|DELETE /api/v1/webhooks/*',
  email: 'GET|POST /api/v1/email/*',
  protocols: 'GET|POST /api/v1/protocols/*',
  inviteCodes: 'GET|POST /api/v1/invite-codes/*',
  admin: 'GET|POST /api/v1/admin/*',
} as const;

/**
 * Request and response types for every endpoint in the Minds API.
 * These pass through verbatim from `@minds/sdk` (which inherits them
 * from `@recursiv/sdk`). Use them in full-stack code where the client
 * and server want to share types without depending on the full SDK.
 */
export type * from '@minds/sdk';
