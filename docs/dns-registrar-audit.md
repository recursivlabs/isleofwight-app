# `minds.com` DNS and registrar gate

**Status: read-only audit, 2026-08-24. No DNS record, nameserver, registrar, SSL,
email, or Cloudflare setting was changed.** This is the evidence artifact for dispatcher row
`call-dns-cleanup`. It does not authorize the legacy `minds.com` cutover, which remains outside the
launch ladder under controller section 8.

## Decision

Keep the active `minds.com` zone where it is and, after the access and parity gates below pass,
transfer **registration only** from Moniker to Cloudflare Registrar inside that same authoritative
Cloudflare account. Do not move the zone into the visible Recursiv account as part of the registrar
transfer. DNS already uses Cloudflare nameservers; an account move would add a second migration and
can lose settings that a DNS-record scan or BIND export does not contain.

The current session cannot execute that plan safely. The Cloudflare login is `bill@recursiv.io` and
shows the `Bill@recursiv.io's Account` and `Recursiv` accounts. Its cross-account Websites inventory
contains exactly four active zones:

- `inverted.world`
- `recursiv.app`
- `recursiv.io`
- `social.dev`

`minds.com` is absent. The Recursiv account's Registrar page says **“No domains registered with
Cloudflare yet”**, and its transfer tables have no domain candidates. The existing authoritative
`minds.com` Cloudflare account must therefore be identified and accessed before a zone export or
registrar transfer can begin.

## Re-fetchable public baseline

Re-run the complete public baseline with:

```sh
bash scripts/dns-registrar-audit.sh
```

The script is read-only and prints RDAP, delegation, critical-host HTTPS/DNS, mail, wildcard TXT,
and CAA evidence. It does not replace the unavailable full-zone export.

The current registry record is available from Verisign RDAP:

```sh
wget -qO- https://rdap.verisign.com/com/v1/domain/minds.com | \
  jq '{status,nameservers,events}'
```

Observed 2026-08-24:

| Field | Live value | Consequence |
|---|---|---|
| Registrar | Moniker Online Services LLC | Registration has not moved to Cloudflare. |
| Registry status | `client transfer prohibited` | The registrar lock is still on; a transfer is not ready to submit. |
| Expiration | 2027-12-08T05:00:00Z | There is no expiry emergency driving a risky transfer. |
| Nameservers | `desi.ns.cloudflare.com`, `dion.ns.cloudflare.com` | Authoritative DNS is already Cloudflare. |
| Parent `DS` answer | none | DNSSEC is not validated from the `.com` delegation. Do not infer protection from the child `DNSKEY` answers. |

Cloudflare's DNS-over-HTTPS endpoint reproduces the delegation without requiring dashboard access:

```sh
for type in NS SOA DS; do
  wget -qO- --header='accept: application/dns-json' \
    "https://cloudflare-dns.com/dns-query?name=minds.com&type=$type" | jq '.Answer // []'
done
```

## Critical hostname baseline

These names come from the controller and repository, not an attempted public-zone enumeration. A
complete inventory still requires an export from the account that owns the zone.

| Name | Public DNS on 2026-08-24 | HTTPS `/` | Role / protection |
|---|---|---:|---|
| `minds.com` | Cloudflare anycast | `301` to `https://www.minds.com/` | Legacy network. Do not repoint in this task. |
| `www.minds.com` | Cloudflare anycast | `200` | Legacy network. Preserve until the separate cutover program. |
| `api.minds.com` | CNAME `api.minds.recursiv.io` → `34.71.80.160` | `200` | Production API. Verify `/health`, not only `/`. |
| `build.minds.com` | CNAME `minds.on.recursiv.io` → `34.71.80.160` | `200` | Recursiv fork surface. |
| `api.build.minds.com` | CNAME `api.minds.recursiv.io` → `34.71.80.160` | `200` | Shared API-origin risk recorded by the controller. |
| `terrapin.minds.com` | CNAME `minds.on.recursiv.io` → `34.71.80.160` | `200` | Minds 2.0 production web. |
| `staging.terrapin.minds.com` | CNAME `minds-staging.staging.recursiv.io` → `34.71.80.160` | `200` | Now exists; the controller's earlier “no DNS” observation had drifted. |
| `cdn.minds.com` | Cloudflare anycast hides origin | `200` | Jack's active protected-media migration lane. Do not alter from this task. |
| `media.minds.com` | Cloudflare anycast hides origin | `200` | Legacy media path. Do not infer origin parity from the proxied answer. |

An HTTP status is only a liveness check. The transfer verifier must retain the controller's positive
and negative content discriminators so a `200` from the wrong application cannot pass.

## Cleanup findings that remain live

### Wildcard TXT still impersonates DKIM selectors

The finding in `docs/email-auth-posture.md` remains reproducible:

```text
_dmarc.minds.com                         "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc.rua@minds.com"
random-probe-20260824.minds.com          "knym7S8T"
google._domainkey.minds.com              "knym7S8T"
random-probe-20260824._domainkey.minds.com "knym7S8T"
```

The random names prove that `"knym7S8T"` is a wildcard TXT answer, not a DKIM public key. Do not
delete it blindly: its verification owner is still unknown. Safe cleanup requires identifying its
consumer, publishing the real selectors for every authorized sender, proving DKIM and DMARC
alignment with delivered messages, and only then removing or narrowing the wildcard with a
pre-recorded rollback value.

### CAA is absent

The apex returned no CAA answer. That is an inventory result, not permission to add a restrictive
record: first enumerate every certificate issuer and Cloudflare-managed certificate dependency.

## Gates before any registrar action

1. **Name the existing Cloudflare zone account and owner.** Grant the operator least-privilege
   visibility to `minds.com`. Prefer transferring the registrar inside this account; any proposal to
   move the zone to Recursiv is a separate, explicitly approved migration.
2. **Establish Moniker control.** Confirm the authenticated registrar account, verified registrant
   email, registrant/contact accuracy, renewal state, and the human who can approve the transfer.
   Do not change registrant identity/contact fields immediately before transfer; that can trigger a
   60-day lock.
3. **Export before touching.** Export the BIND zone and separately inventory proxy flags, SSL/TLS,
   certificate packs, DNSSEC, WAF/rules, redirects, Workers/routes, load balancers, custom hostnames,
   Stream/media dependencies, and account-level permissions. Hash and retain the export outside the
   browser session.
4. **Record parity.** Enumerate all records—not only the critical names above—and identify each
   owner, purpose, TTL, proxy state, origin, and rollback value. Resolve the wildcard TXT and CAA
   decisions in their own reviewable change windows.
5. **Satisfy Cloudflare Registrar prerequisites.** The domain must be Active in the target
   Cloudflare account; account email and payment must be valid; the registration/last transfer and
   registrant-contact change must be outside the applicable 60-day windows. Request the Moniker EPP
   code only when ready, then unlock the current `clientTransferProhibited` status.
6. **Pre-commit the verifier and observer window.** Name the operator, observer, start time,
   escalation channel, and exact pass/fail commands before submitting. A registrar transfer can take
   days and is not a TTL-bounded DNS rollback.

Cloudflare's current procedures are the primary references:

- <https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/>
- <https://developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/>
- <https://developers.cloudflare.com/fundamentals/manage-domains/move-domain/>

The last link matters only if the owner deliberately chooses the higher-risk account-move path;
Cloudflare warns that zone settings do not move automatically.

## Required post-transfer proof

Run the checks from two independent resolvers/observers and attach raw output:

- RDAP shows Cloudflare Registrar, the expected expiration extension, and the transfer lock restored.
- Nameservers and the complete exported record set are unchanged; no unplanned account move occurred.
- Apex/`www` retain the deliberate legacy redirect/content outcome; the transfer does not perform the
  separate Minds 2.0 cutover.
- `api.minds.com/health` returns the expected production commit and tenant-safe service.
- `terrapin`, staging, build, and API host content discriminators identify the intended applications.
- Named `cdn` and `media` assets from Jack's migration evidence still render through authenticated
  and unauthenticated paths as policy requires.
- Google Workspace MX, SPF, DMARC, and each real DKIM selector return the recorded values; delivered
  mail proves alignment. A resolver merely returning TXT data does not prove delivery.
- Cloudflare analytics and origin monitoring show no unexplained increase in NXDOMAIN, 52x, TLS,
  API, media, or email errors through the agreed observation window.

If any prerequisite or verifier is unavailable, leave the domain registered and locked at Moniker.
That is the safe rollback before submission. After submission, follow the registrar's cancel/reject
path; do not attempt an emergency nameserver or zone-account move to compensate.
