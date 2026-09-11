# @minds/tenant-overlay

The Minds-owned tenant branding and landing-page overlay used by the Recursiv platform.

```bash
npm install @minds/tenant-overlay
```

This package keeps Minds-specific presentation code in the Minds repository while the generic
tenant loader and platform runtime remain in `recursivlabs/recursiv`.

It exports:

- `renderLanding(network)` — the branded `build.minds.com` landing page
- `themeOverrides` — Minds tenant theme tokens
- `defaults` — Minds tenant feature and authentication defaults

The package is consumed by the Recursiv API runtime. Changes should be released before the
platform dependency is bumped so the production API always has a resolvable overlay.

## License

FSL-1.1-ALv2.
