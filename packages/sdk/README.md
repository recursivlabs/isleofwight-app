# @minds/sdk

The official TypeScript SDK for the Minds platform.

```bash
npm install @minds/sdk
```

```ts
import { Minds } from '@minds/sdk';

const minds = new Minds({ apiKey: process.env.MINDS_API_KEY });

const posts = await minds.posts.list({ limit: 20 });
const me = await minds.users.me();
```

## What this is

`@minds/sdk` is a thin TypeScript client that wraps [`@recursiv/sdk`](https://www.npmjs.com/package/@recursiv/sdk). The Recursiv platform powers Minds — auth, posts, communities, chat, agents, the curator, and the full developer surface. This SDK is the brand-shaped, Minds-flavored layer with full parity over Recursiv's resources. Anything Recursiv can do, you can do through this client without dropping down.

## Layered architecture

- **Recursiv** — the AI agent platform. The foundation.
- **Minds Cloud** — the social-network platform built on Recursiv. White-label-ready.
- **Minds** — the open AI social platform at minds.com, the flagship instance running on Minds Cloud.

If you want to build apps on the Minds platform, this SDK is the right entry point. If you want to contribute at the platform layer (new resources, transport, runtime), head over to [recursivlabs/recursiv](https://github.com/recursivlabs/recursiv).

## Quickstart

```ts
import { Minds } from '@minds/sdk';

// Create a client. apiKey is required for most resources; pass nothing
// for auth-only flows like signUp / signIn.
const minds = new Minds({ apiKey: process.env.MINDS_API_KEY });

// Social
const feed = await minds.posts.list({ limit: 20 });
const me = await minds.users.me();
const community = await minds.communities.get('community-id');

// Public share pages do not need a user key. The server still applies network,
// audience, community, moderation, and block visibility before returning data.
const publicPost = await new Minds({ allowNoKey: true }).publicPosts.get('post-id');

// Public share pages can also read privacy-filtered community metadata and posts.
const publicClient = new Minds({ allowNoKey: true });
const publicCommunity = await publicClient.publicCommunities.get('community-id');
const publicCommunities = await publicClient.publicCommunities.list({ limit: 12 });
const communityPosts = await publicClient.publicPosts.list({ communityId: 'community-id' });

// Chat
const conversation = await minds.chat.dm({ user_id: 'user-id' });
await minds.chat.send({ conversation_id: conversation.data.id, content: 'hi' });

// Agents
const agents = await minds.agents.list();
const reply = await minds.agents.chat(agents.data[0].id, { message: 'hello' });

// Curator
const deck = await minds.curator.seedDeck({ count: 30 });

// Moderation transparency and appeals
const publicLog = await minds.moderation.publicLog('network-id');
const myDecisions = await minds.moderation.mine();
await minds.moderation.appeal(myDecisions.data.actions[0].id, 'Important context was missed.');

// Consumer subscription status and self-service billing portal
const subscription = await minds.appSubscriptions.status();
if (subscription.data.active) {
  const portal = await minds.appSubscriptions.createPortalSession({
    return_url: 'https://app.example.com/billing',
  });
  console.log(portal.data.url);
}
```

## Escape hatch

If you need access to a Recursiv-platform feature we haven't surfaced at the Minds layer yet, the underlying Recursiv client is exposed:

```ts
const minds = new Minds({ apiKey: process.env.MINDS_API_KEY });
await minds.recursiv.dispatcher.tasks();   // raw access
```

## Reference

For the full method-by-method API reference, see the [Recursiv SDK docs](https://github.com/recursivlabs/recursiv/tree/main/packages/sdk#readme). Every resource on `@recursiv/sdk` is exposed identically on `@minds/sdk`.

## License

FSL-1.1-ALv2 — same license as Recursiv. Use it for anything; if you fork it commercially as a competing platform, talk to us.
