#!/usr/bin/env bash
# Interactive first-run access setup. It starts provider login flows; it never
# asks a developer to paste a shared production secret into the terminal.
set -uo pipefail

PROFILE="${DEV_ACCESS_PROFILE:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRET_LOADER="$SCRIPT_DIR/read-infisical-secret.py"

usage() {
  cat <<'EOF'
Usage: bash scripts/bootstrap-dev-access.sh [--profile owner|external|launch-operator]

Use `external` for ordinary outside contributors. Use `launch-operator` only
after a project owner has explicitly approved production dispatcher access.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ -z "$PROFILE" ]; then
  cat <<'EOF'
Choose an access profile:
  1) owner            Existing project owner on this machine
  2) external         Outside contributor; source and GitHub access only
  3) launch-operator  Explicitly authorized production/dispatcher operator
EOF
  printf 'Profile [1]: '
  read -r choice
  case "${choice:-1}" in
    1) PROFILE=owner ;;
    2) PROFILE=external ;;
    3) PROFILE=launch-operator ;;
    *) echo "Invalid selection." >&2; exit 2 ;;
  esac
fi

case "$PROFILE" in
  owner|external|launch-operator) ;;
  *) echo "Invalid profile: $PROFILE" >&2; usage >&2; exit 2 ;;
esac

echo
echo "Step 1/3 — GitHub identity"
if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required: https://cli.github.com/" >&2
  exit 1
fi
if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "GitHub will ask you to authenticate with your own account."
  gh auth login -h github.com -p https -w || exit 1
fi

if ! gh repo view recursivlabs/minds --json nameWithOwner >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Your GitHub account cannot read recursivlabs/minds.
Ask a repository owner for the contributor role appropriate to your work, then
re-run this script. Do not borrow another developer's token.
EOF
  exit 1
fi

echo
echo "Step 2/3 — secret access"
if [ "$PROFILE" = "external" ]; then
  cat <<'EOF'
The external contributor profile does not receive the shared production
dispatcher key. If your assigned task needs staging or another protected
service, ask the owner for an Infisical invitation scoped to that environment;
authenticate with your own identity and re-run using the approved profile.
EOF
else
  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required by the Infisical compatibility adapter." >&2
    exit 1
  fi
  INFISICAL_CLI="${INFISICAL_BIN:-infisical}"
  if ! INFISICAL_CLI="$(command -v "$INFISICAL_CLI" 2>/dev/null)"; then
    echo "Infisical CLI is required: https://infisical.com/docs/cli/overview" >&2
    echo "For a non-standard install, set INFISICAL_BIN to the executable path." >&2
    exit 1
  fi
  if probe="$(python3 "$SECRET_LOADER" MINDS_NETWORK_API_KEY \
      --project-id 5bf5f9f7-1a2f-4f42-867d-1b544fd7fb7c \
      --env dev 2>/dev/null)"; then
    probe_valid=1
  else
    probe_valid=0
  fi
  unset probe
  if [ "$probe_valid" != "1" ]; then
    echo "Infisical will ask you to authenticate with your own identity."
    "$INFISICAL_CLI" login || exit 1
  fi
fi

echo
echo "Step 3/3 — read-only verification"
exec bash "$SCRIPT_DIR/dev-access-check.sh" --profile "$PROFILE"
