import { PublicTrpcClient } from './public-trpc.js';

export type PublicCommunity = Record<string, unknown> & {
  id: string;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  image?: string | null;
  privacy?: 'public' | 'private' | string;
  memberCount?: number | null;
  postCount?: number | null;
  importHidden?: boolean | null;
};

export interface PublicCommunityResponse {
  data: PublicCommunity;
}

export interface PublicCommunityListParams {
  limit?: number;
  offset?: number;
  privacy?: 'public';
}

export interface PublicCommunityListResponse {
  data: PublicCommunity[];
  meta: { has_more: boolean };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Anonymous, privacy-filtered community reads for public share pages. */
export class PublicCommunitiesResource {
  private readonly trpc: PublicTrpcClient;
  private readonly projectId?: string;

  constructor(baseUrl: string, timeout = 30_000, projectId?: string) {
    this.trpc = new PublicTrpcClient(baseUrl, timeout);
    this.projectId = projectId;
  }

  async get(idOrSlug: string): Promise<PublicCommunityResponse> {
    const procedure = UUID_PATTERN.test(idOrSlug) ? 'communities.get' : 'communities.getBySlug';
    const input = procedure === 'communities.get'
      ? { id: idOrSlug, ...(this.projectId ? { projectId: this.projectId } : {}) }
      : { slug: idOrSlug, ...(this.projectId ? { projectId: this.projectId } : {}) };
    return { data: await this.trpc.query<PublicCommunity>(procedure, input) };
  }

  async list(params: PublicCommunityListParams = {}): Promise<PublicCommunityListResponse> {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const data = await this.trpc.query<PublicCommunity[]>('communities.list', {
      privacy: params.privacy ?? 'public',
      limit,
      offset,
      ...(this.projectId ? { projectId: this.projectId } : {}),
    });
    return {
      data,
      meta: { has_more: data.length >= limit },
    };
  }
}
