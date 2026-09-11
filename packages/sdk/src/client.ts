/**
 * Minds is the official TypeScript client for the Minds platform.
 *
 * Architecture: this client wraps `@recursiv/sdk`. The Recursiv platform
 * powers Minds (auth, posts, communities, chat, agents, curator, and the
 * full developer surface), and this Minds client is a brand-shaped layer
 * with full parity over Recursiv's resources. Anything Recursiv can do,
 * a Minds caller can do through this client without dropping down.
 *
 * To contribute at the platform layer (resources, transport, runtime),
 * see https://github.com/recursivlabs/recursiv.
 */
import { Recursiv } from '@recursiv/sdk';
import { PublicPostsResource } from './public-posts.js';
import { PublicProfilesResource } from './public-profiles.js';
import { PublicCommunitiesResource } from './public-communities.js';


export interface MindsConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  anonymous?: boolean;
  /**
   * App project used to bind anonymous public-post reads to one public app.
   * This is a visibility scope, never a credential.
   */
  projectId?: string;
  /** Allow construction without an API key (for auth-only operations like signUp/signIn) */
  allowNoKey?: boolean;
}

/**
 * The Minds client. Composes a Recursiv instance internally and exposes
 * its resources verbatim. Pass any RecursivConfig — same shape, same
 * behavior. Defaults to the Minds API (`https://api.minds.com/api/v1`);
 * override `baseUrl` to point elsewhere.
 */
const MINDS_DEFAULT_BASE_URL = 'https://api.minds.com/api/v1';

/**
 * Every Recursiv resource is a Minds resource. Declaration merging states that
 * in the type system; the constructor makes it true at runtime. The previous
 * version wrote the list out three times — as imports, as fields, and as
 * assignments — and had already drifted: `brief`, `envVars`, `evidence`,
 * `goals`, `humanAsks`, `humanInput` and `video` existed on Recursiv and not
 * here, so the parity this class documents was not a fact. A list maintained by
 * hand is a list that goes stale; this one cannot.
 */
export interface Minds extends Recursiv {}

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: the rule is right in general — a merged interface can promise members the class never provides. Here the constructor provides them (Object.assign for resources, a bound copy for prototype methods) and client.test.ts asserts BOTH directions against a real Recursiv instance, so a broken promise fails the build rather than reaching a caller.
export class Minds {
  /** Anonymous, visibility-filtered reads for public share surfaces. */
  readonly publicPosts: PublicPostsResource;
  /** Anonymous, privacy-filtered profile reads for public profile surfaces. */
  readonly publicProfiles: PublicProfilesResource;
  /** Anonymous, privacy-filtered community reads for public share surfaces. */
  readonly publicCommunities: PublicCommunitiesResource;

  /**
   * The underlying Recursiv client. Exposed as an escape hatch so callers
   * can reach anything we haven't yet wrapped at the Minds layer. Treat
   * this as "I know what I'm doing" — for normal use, prefer the typed
   * resources above.
   */
  readonly recursiv: Recursiv;

  constructor(config?: MindsConfig) {
    const baseUrl = config?.baseUrl ?? MINDS_DEFAULT_BASE_URL;
    const { projectId, ...recursivConfig } = config ?? {};
    const recursiv = new Recursiv({
      ...recursivConfig,
      baseUrl,
    });
    // Resources are own enumerable properties on a Recursiv instance, so this
    // copies all of them — including any added after this file was written.
    Object.assign(this, recursiv);
    // Methods live on the prototype and Object.assign does not walk it. Bind
    // them to the instance they belong to, or `this` is wrong inside them.
    for (const name of Object.getOwnPropertyNames(Recursiv.prototype)) {
      if (name === 'constructor') continue;
      const value = (recursiv as unknown as Record<string, unknown>)[name];
      if (typeof value === 'function') {
        (this as unknown as Record<string, unknown>)[name] = value.bind(recursiv);
      }
    }
    this.recursiv = recursiv;
    this.publicPosts = new PublicPostsResource(baseUrl, config?.timeout, projectId);
    this.publicProfiles = new PublicProfilesResource(baseUrl, config?.timeout);
    this.publicCommunities = new PublicCommunitiesResource(baseUrl, config?.timeout, projectId);
  }
}
