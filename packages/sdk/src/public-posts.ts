import { PublicTrpcClient } from './public-trpc.js';

export type PublicPost = Record<string, unknown> & {
  id: string;
  content?: string | null;
  title?: string | null;
  repostedFromId?: string | null;
  reposted_from_id?: string | null;
  repostedFrom?: PublicPost | null;
  reposted_from?: PublicPost | null;
};

export interface PublicPostResponse {
  data: PublicPost;
}

export interface PublicPostListResponse {
  data: PublicPost[];
  meta: { has_more: boolean };
}

interface PublicPostListPagination {
  limit?: number;
  offset?: number;
}

export type PublicPostListParams = PublicPostListPagination & (
  | { authorId: string; communityId?: never }
  | { communityId: string; authorId?: never }
);

/**
 * Anonymous, read-only post access for public Minds surfaces.
 *
 * The authenticated REST API correctly requires an API key. Public share
 * pages use the platform's separate `posts.get` tRPC projection, which applies
 * network, audience, community, moderation, and block visibility before it
 * returns anything. Keeping this transport in the SDK prevents each client
 * from inventing its own unauthenticated fetch path.
 */
export class PublicPostsResource {
  private readonly trpc: PublicTrpcClient;
  private readonly projectId?: string;

  constructor(baseUrl: string, timeout = 30_000, projectId?: string) {
    this.trpc = new PublicTrpcClient(baseUrl, timeout);
    this.projectId = projectId;
  }

  private queryPost(id: string): Promise<PublicPost> {
    return this.trpc.query<PublicPost>('posts.get', {
      id,
      ...(this.projectId ? { projectId: this.projectId } : {}),
    });
  }

  async get(id: string): Promise<PublicPostResponse> {
    const post = await this.queryPost(id);
    return {
      data: (await this.hydrateMissingRepostSources([post]))[0],
    };
  }

  /**
   * The newest public posts across the network, for a signed-out visitor.
   * Same `posts.list` projection with no author or group scope: the server
   * applies its public visibility floor (public project, not hidden, not
   * moderated, no audience) and orders newest first.
   */
  async latest(params: PublicPostListPagination = {}): Promise<PublicPostListResponse> {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const data = await this.trpc.query<PublicPost[]>('posts.list', {
      ...(this.projectId ? { projectId: this.projectId } : {}),
      limit,
      offset,
    });
    return {
      data: await this.hydrateMissingRepostSources(data),
      meta: { has_more: data.length >= limit },
    };
  }

  async list(params: PublicPostListParams): Promise<PublicPostListResponse> {
    const limit = params.limit ?? 30;
    const offset = params.offset ?? 0;
    const scope = 'communityId' in params
      ? { communityId: params.communityId }
      : { authorId: params.authorId };
    const data = await this.trpc.query<PublicPost[]>('posts.list', {
      ...scope,
      ...(this.projectId ? { projectId: this.projectId } : {}),
      limit,
      offset,
    });
    return {
      data: await this.hydrateMissingRepostSources(data),
      meta: { has_more: data.length >= limit },
    };
  }

  /**
   * Older deployed public projections returned only `repostedFromId` for a
   * bare repost. A feed card cannot render that empty wrapper without the
   * original post, even though the original is independently public.
   *
   * Prefer an original that already passed visibility checks in this page.
   * Fetch only sources outside the page through the same public `posts.get`
   * procedure. A missing/private source stays unhydrated, and one failed
   * source never makes the entire public profile or community fail.
   */
  private async hydrateMissingRepostSources(data: PublicPost[]): Promise<PublicPost[]> {
    const pagePosts = new Map(data.map((post) => [post.id, post]));
    const resolved = new Map<string, PublicPost>();
    const missing = new Set<string>();

    for (const post of data) {
      const sourceId = post.repostedFromId || post.reposted_from_id;
      const hasSource = Object.prototype.hasOwnProperty.call(post, 'repostedFrom')
        || Object.prototype.hasOwnProperty.call(post, 'reposted_from');
      if (!sourceId || hasSource) continue;

      const pageSource = pagePosts.get(sourceId);
      if (pageSource) resolved.set(sourceId, pageSource);
      else missing.add(sourceId);
    }

    await Promise.all([...missing].map(async (sourceId) => {
      try {
        resolved.set(sourceId, await this.queryPost(sourceId));
      } catch {
        // The original may be private, removed, or temporarily unavailable.
        // Preserve the list response without bypassing public visibility.
      }
    }));

    return data.map((post) => {
      const sourceId = post.repostedFromId || post.reposted_from_id;
      const hasSource = Object.prototype.hasOwnProperty.call(post, 'repostedFrom')
        || Object.prototype.hasOwnProperty.call(post, 'reposted_from');
      const source = sourceId ? resolved.get(sourceId) : undefined;
      return sourceId && !hasSource && source
        ? { ...post, repostedFrom: source }
        : post;
    });
  }
}
