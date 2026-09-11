/**
 * @minds/sdk — official TypeScript client for the Minds platform.
 *
 * Wraps `@recursiv/sdk`. The Recursiv platform powers Minds; this SDK is
 * a brand-shaped layer with full parity over Recursiv's resources. To
 * contribute at the platform layer (resources, transport, runtime), see
 * https://github.com/recursivlabs/recursiv.
 */
export { Minds } from './client.js';
export type { MindsConfig } from './client.js';
export { PublicPostsResource } from './public-posts.js';
export type { PublicPost, PublicPostListParams, PublicPostListResponse, PublicPostResponse } from './public-posts.js';
export { PublicProfilesResource } from './public-profiles.js';
export type {
  PublicProfile,
  PublicProfileListParams,
  PublicProfileListResponse,
  PublicProfileResponse,
} from './public-profiles.js';
export { PublicCommunitiesResource } from './public-communities.js';
export { PublicTrpcError } from './public-trpc.js';
export type {
  PublicCommunity,
  PublicCommunityListParams,
  PublicCommunityListResponse,
  PublicCommunityResponse,
} from './public-communities.js';

// Re-export the full Recursiv surface so consumers never have to reach
// for two packages. Anything Recursiv exports — resource classes, error
// classes, SSE helpers, types — is available from @minds/sdk too.
export * from '@recursiv/sdk';
