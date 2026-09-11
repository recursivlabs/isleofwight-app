# Email authentication posture — the three candidate sending domains (P10 sub-artifact 2, PREP)

**STATUS: PREP + FINDINGS, NOT THE CLOSING ARTIFACT.** P10(2)'s exit requires the checks below
**re-run by the countersigner on their own machine** — a DNS answer read from one resolver is one
resolver's answer. This file does the other half the cell asks for first: *"the domain is named in the
PR before the check is run."* Three domains are named here, and two of them fail.

Run 2026-08-06. Every line is a command's output.

## P10(2)'s bar, quoted so the pass/fail is not a judgement call

> `dig +short _dmarc.<domain> TXT` … containing `p=reject` or `p=quarantine` (**`p=none` is not
> enforcement and does not close this**), plus `dig +short <domain> TXT | grep spf` and the DKIM
> selector record.

## The three domains

```
$ for d in minds.com recursiv.io recursiv.app; do
    echo "== $d"; echo -n "  DMARC: "; dig +short _dmarc.$d TXT | head -2
    echo -n "  SPF:   "; dig +short $d TXT | grep -i spf | head -1; done

== minds.com
  DMARC: "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc.rua@minds.com"
  SPF:   "v=spf1 include:_spf.google.com include:44341326.spf04.hubspotemail.net ~all"
== recursiv.io
  DMARC: "v=DMARC1; p=none;"
  SPF:   (no output)
== recursiv.app
  DMARC: cname.vercel-dns-016.com.
  SPF:   (no output)
```

| Domain | DMARC | SPF | DKIM | P10(2) |
|---|---|---|---|---|
| `minds.com` | `p=quarantine` ✅ | present ✅ | **absent — see below** ❌ | **NOT MET** |
| `recursiv.io` | `p=none` ❌ (the cell excludes it by name) | **none** ❌ | none ❌ | **NOT MET** |
| `recursiv.app` | **none** ❌ | **none** ❌ | none ❌ | **NOT MET** |

## Finding 1 — `minds.com` publishes a WILDCARD TXT that swallows every DKIM selector lookup

The DKIM half looked fine until the selectors were varied. Every selector returns the same value —
including selectors that cannot exist:

```
$ for s in google default k1 selector1 hs1; do dig +short $s._domainkey.minds.com TXT | head -1; done
"knym7S8T"   "knym7S8T"   "knym7S8T"   "knym7S8T"   "knym7S8T"

$ dig +short randomstring987._domainkey.minds.com TXT
"knym7S8T"
$ dig +short nonexistent-test.minds.com TXT
"knym7S8T"
```

**A random string returns it, so this is a wildcard `*` TXT record, not a DKIM key.** `"knym7S8T"`
has the shape of a domain-verification token; whatever it is, it is not `v=DKIM1; k=rsa; p=…`.

**What follows, stated carefully.** A wildcard answers only where no specific record exists — so the
proof is that `google._domainkey.minds.com` returns the *wildcard value*, which means **no specific
DKIM record is published for that selector.** A receiving server that looks it up gets a token, not a
key, and DKIM verification cannot succeed for it.

The domain sends through Google Workspace and HubSpot (both in the SPF include chain) under a
`p=quarantine` policy. Mail whose SPF aligns still passes DMARC, so **this is not "all mail is
quarantined"** — it is that **DKIM contributes nothing, and DKIM is the leg that survives forwarding
while SPF does not.** Forwarded and list-relayed mail has no second leg to stand on.

**Why a wildcard TXT is the specific hazard here, beyond DKIM:** it makes the domain answer *yes-ish*
to every TXT probe. Verification challenges, `_domainkey` lookups, and any future `_dmarc`-style
record on a subdomain all get a stale token instead of `NXDOMAIN`, and **"a wrong answer" and "no
answer" stop being distinguishable** — the same stdout/error collision §1.2 clause 5 is written
against, at the DNS layer.

## Finding 2 — `recursiv.io` is unprotected and *does* receive mail

```
$ dig +short _dmarc.recursiv.io TXT   →  "v=DMARC1; p=none;"
$ dig +short recursiv.io TXT | grep -i spf   →  (nothing)
$ dig +short recursiv.io MX   →  1 smtp.google.com.
```

`p=none` is monitoring, not enforcement, and the cell rules it out by name. **With no SPF record at
all and no DKIM, nothing constrains who may send as `@recursiv.io`** — while the domain actively
receives mail, and Bill's own priorities file plans `bill@recursiv.io` as a per-entity address. This
is the domain the staging QA account was created under (`qa+minds-staging@recursiv.io`, #206
`bill/90`), so the loop's own test mail flows through an unauthenticated domain.

## Finding 3 — both `recursiv.*` domains wildcard every subdomain to Vercel

```
$ for n in _dmarc randomstring12345 _nonexistent; do dig +short $n.recursiv.app; done
cname.vercel-dns-016.com.   cname.vercel-dns-016.com.   cname.vercel-dns-016.com.
$ dig +short randomtest456.recursiv.io TXT
cname.vercel-dns-016.com.
```

Every name resolves, including `_dmarc`. A DMARC lookup therefore returns a CNAME chain to a host
with no TXT record rather than a policy — **the absence of DMARC on `recursiv.app` is invisible to
anything that checks whether the name resolves.** This is the same failure shape PD records one layer
up: *"a resolving name is what a half-finished switchover looks like, and it reads as DONE to every
check that stops at DNS."* Two independent surfaces of one domain, same trap.

## What this does NOT establish

- **No mail was sent.** Every claim here is about published DNS. Actual delivery, alignment outcomes
  and quarantine behaviour are untested and are not inferable from records.
- **`"knym7S8T"`'s purpose is unidentified.** It is asserted only that it is not a DKIM key and that
  it answers for every subdomain. Deleting it may break whatever verification it satisfies — **find
  its owner before removing it.**
- **One resolver, one machine, one moment.** P10(2) requires the countersigner's own run precisely
  because of this; that is the sub-artifact, and this file is its input.
- **Which domain Minds will actually send from is undecided** (§11 lists the ESP as an unpriced
  future cost, and no ESP is named anywhere in the plan). If that turns out to be `minds.com`,
  Finding 1 is the blocker; if `recursiv.io`, Finding 2 is, and it is the larger of the two.
