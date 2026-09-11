#!/usr/bin/env python3
"""Render the Minds launch spine and adaptive portfolio from live dispatcher state."""

from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from collections import Counter, defaultdict


def _score(row: dict) -> float:
    try:
        return float(row.get("score") or 0)
    except (TypeError, ValueError):
        return 0


def _label(row: dict) -> str:
    layer = row.get("layer") or "unlayered"
    return f"{_score(row):>6.1f}  {row['id'][:50]:<50}  [{layer}] {row['title'][:70]}"


def _normal_title(row: dict) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(row.get("title") or "").lower()).strip()


def render_status(ladder_rows: list[dict], portfolio_rows: list[dict], claims: list[dict]) -> str:
    """Return deterministic, ownership-aware queue output (also used by offline tests)."""
    lines: list[str] = []
    claim_by_task = {claim["task_id"]: claim for claim in claims if claim.get("status") == "claimed"}
    portfolio_ids = {row["id"] for row in portfolio_rows}
    project_claims = [claim for task_id, claim in claim_by_task.items() if task_id in portfolio_ids]

    canonical = [row for row in ladder_rows if row["id"].startswith("minds-ladder-")]
    additional = [row for row in ladder_rows if not row["id"].startswith("minds-ladder-")]
    lines.append("LAUNCH SAFETY SPINE — canonical minds-ladder-* gates")
    counts = Counter(row["status"] for row in canonical)
    lines.append(
        f"  {len(canonical)} canonical rows · "
        + " · ".join(f"{status} {count}" for status, count in sorted(counts.items()))
    )
    if len(canonical) != 27:
        lines.append(f"  LADDER SHAPE WARNING — expected 27 canonical rows, found {len(canonical)}")
    if additional:
        lines.append(
            f"  {len(additional)} additional launch-layer portfolio task(s); "
            "they do not change the ladder denominator"
        )

    by_title: dict[str, list[dict]] = defaultdict(list)
    for row in portfolio_rows:
        title = _normal_title(row)
        if title:
            by_title[title].append(row)
    duplicate_groups = [rows for rows in by_title.values() if len(rows) > 1]
    duplicate_ids = {row["id"] for group in duplicate_groups for row in group}
    if duplicate_groups:
        lines.append("  DUPLICATE WORK — claim neither copy until an owner selects the canonical row:")
        for group in sorted(duplicate_groups, key=lambda rows: _normal_title(rows[0]))[:8]:
            lines.append(f"    {group[0]['title'][:70]}")
            for row in group:
                lines.append(f"      {row['id']}  layer={row.get('layer') or 'unlayered'}")

    layer_counts = Counter(row.get("layer") or "unlayered" for row in portfolio_rows)
    lines.append("")
    lines.append("FULL PRODUCT PORTFOLIO — project-scoped, all layers")
    lines.append(
        f"  {len(portfolio_rows)} unarchived rows across {len(layer_counts)} layer(s): "
        + ", ".join(f"{layer}={count}" for layer, count in sorted(layer_counts.items()))
    )
    if len(portfolio_rows) == 100:
        lines.append("  PORTFOLIO TRUNCATION WARNING — dispatcher limit reached; selection is not authoritative")
    lines.append(f"  ACTIVE CLAIMS {len(project_claims)}")
    for claim in sorted(project_claims, key=lambda item: item.get("task_id", "")):
        lines.append(
            f"    {claim['task_id'][:58]:<58}  agent={claim.get('agent') or 'unknown'} "
            f"heartbeat={claim.get('last_heartbeat') or 'missing'}"
        )

    available = []
    reserved = []
    released_blockers = []
    verification_queue = []
    anomalies = []
    for row in portfolio_rows:
        no_active_claim = row["id"] not in claim_by_task
        is_completed_handoff = (
            row.get("status") in {"pending", "in_progress"}
            and no_active_claim
            and row.get("release_reason") == "completed"
        )
        if is_completed_handoff:
            verification_queue.append(row)
            continue
        if row.get("status") == "in_progress" and no_active_claim:
            anomalies.append(row)
        if row.get("status") != "pending" or row.get("blocked_by") or row["id"] in claim_by_task:
            continue
        if row["id"] in duplicate_ids:
            continue
        if row.get("release_reason") in {"blocked", "needs_human", "out_of_scope"}:
            released_blockers.append(row)
            continue
        owner = row.get("owner")
        if owner not in (None, "", "unassigned"):
            reserved.append(row)
        else:
            available.append(row)

    lines.append("  AVAILABLE NOW — highest existing dispatcher score first")
    if available:
        lines.extend(f"    {_label(row)}" for row in sorted(available, key=_score, reverse=True)[:12])
    else:
        lines.append("    none")
    if reserved:
        lines.append("  OWNER-RESERVED — require an explicit handoff before claiming")
        for row in sorted(reserved, key=_score, reverse=True)[:12]:
            lines.append(f"    {_label(row)}  owner={row.get('owner')}")
    if released_blockers:
        lines.append("  RELEASED WITH BLOCKER — pending status did not clear the recorded handoff")
        for row in sorted(released_blockers, key=_score, reverse=True)[:12]:
            reason = row.get("release_reason") or "unknown"
            handoff = str(row.get("context_handoff") or "missing context")
            lines.append(f"    {_label(row)}  reason={reason}")
            lines.append(f"      {handoff[:180]}")
    if verification_queue:
        lines.append("  VERIFICATION QUEUE — completed releases awaiting a different party")
        for row in sorted(verification_queue, key=_score, reverse=True)[:12]:
            handoff = str(row.get("context_handoff") or "missing context")
            lines.append(f"    {_label(row)}")
            lines.append(f"      {handoff[:180]}")
    if anomalies:
        lines.append("  IN-PROGRESS WITHOUT ACTIVE CLAIM — no completed handoff; reconcile before ownership")
        lines.extend(f"    {_label(row)}" for row in sorted(anomalies, key=_score, reverse=True)[:12])

    return "\n".join(lines)


def _get_json(path: str) -> list[dict]:
    origin = os.environ["ORIGIN"].rstrip("/")
    query = urllib.parse.urlencode(
        {
            "limit": 100,
            "project_id": os.environ["PROJ"],
            "organization_id": os.environ["ORG"],
        }
    )
    separator = "&" if "?" in path else "?"
    request = urllib.request.Request(
        f"{origin}/api/v1/dispatcher/{path}{separator}{query}",
        headers={"Authorization": f"Bearer {os.environ['KEY']}"},
    )
    return json.loads(urllib.request.urlopen(request, timeout=25).read().decode()).get("data", [])


def main() -> None:
    try:
        ladder_rows = _get_json("tasks?layer=launch-ladder")
        portfolio_rows = _get_json("tasks")
        claims = _get_json("claims")
    except Exception as error:  # pragma: no cover - live failure path
        raise SystemExit(f"  dispatcher unreachable: {error}") from error
    print(render_status(ladder_rows, portfolio_rows, claims))


if __name__ == "__main__":
    main()
