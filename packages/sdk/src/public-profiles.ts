import { PublicTrpcClient } from './public-trpc.js';

export type PublicProfile = Record<string, unknown> & {
  id: string;
  username?: string | null;
  name?: string | null;
  bio?: string | null;
  image?: string | null;
};

export interface PublicProfileResponse {
  data: PublicProfile;
}

export interface PublicProfileListResponse {
  data: PublicProfile[];
  meta: { has_more: boolean };
}

export interface PublicProfileListParams {
  limit?: number;
  offset?: number;
}

// The public users.followers/users.following procedures intentionally cap
// anonymous relationship pages at 50. Keep the SDK inside that contract even
// when an app asks for the larger page sizes supported by authenticated REST.
const PUBLIC_RELATIONSHIP_PAGE_LIMIT = 50;

/** Anonymous, privacy-filtered profile reads for public Minds pages. */
export class PublicProfilesResource {
  private readonly trpc: PublicTrpcClient;

  constructor(baseUrl: string, timeout = 30_000) {
    this.trpc = new PublicTrpcClient(baseUrl, timeout);
  }

  async getByUsername(username: string): Promise<PublicProfileResponse> {
    return { data: await this.trpc.query<PublicProfile>('users.getByUsername', { username }) };
  }

  async get(id: string): Promise<PublicProfileResponse> {
    return { data: await this.trpc.query<PublicProfile>('users.get', { id }) };
  }

  async followers(userId: string, params: PublicProfileListParams = {}): Promise<PublicProfileListResponse> {
    return this.listRelationship('users.followers', userId, params);
  }

  async following(userId: string, params: PublicProfileListParams = {}): Promise<PublicProfileListResponse> {
    return this.listRelationship('users.following', userId, params);
  }

  private async listRelationship(
    procedure: 'users.followers' | 'users.following',
    userId: string,
    params: PublicProfileListParams,
  ): Promise<PublicProfileListResponse> {
    const limit = Math.min(params.limit ?? PUBLIC_RELATIONSHIP_PAGE_LIMIT, PUBLIC_RELATIONSHIP_PAGE_LIMIT);
    const offset = params.offset ?? 0;
    const data = await this.trpc.query<PublicProfile[]>(procedure, { userId, limit, offset });
    return { data, meta: { has_more: data.length >= limit } };
  }
}
