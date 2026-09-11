# @minds/api

Typed REST contract for the Minds API.

```bash
npm install @minds/api
```

## What this is

`@minds/api` is the canonical reference for the Minds REST surface. It exports:

- `MINDS_API_BASE_URL` — `https://api.minds.com/api/v1`
- `MINDS_API_ORIGIN` — `https://api.minds.com`
- `MINDS_AUTH_BASE_URL` — `https://api.minds.com/api/auth`
- `MINDS_API_ENDPOINTS` — a stable, human-readable map of the product-facing endpoints and
  platform endpoint families used by Minds. The generated full route census lives at
  [`docs/api-endpoints.md`](../../docs/api-endpoints.md) in this repository.
- All request/response types from `@minds/sdk` (and through it, `@recursiv/sdk`).

## When to use it

This package is for full-stack TypeScript code that wants to share request/response types between client and server without pulling in the entire SDK runtime, or for documenting the canonical API surface for non-JS clients.

If you're building a Minds app in TypeScript and just need to call the API, install [`@minds/sdk`](https://www.npmjs.com/package/@minds/sdk) instead — the SDK includes everything in this package plus the typed client.

## Architecture

The Minds REST API runs at `api.minds.com` and is powered by the Recursiv platform. To contribute at the platform layer (new endpoints, middleware, transport), see [recursivlabs/recursiv](https://github.com/recursivlabs/recursiv).

## License

FSL-1.1-ALv2.
