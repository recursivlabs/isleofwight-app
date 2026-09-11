#!/usr/bin/env bash
# Read-only public baseline for docs/dns-registrar-audit.md.
set -euo pipefail

DOH_ORIGIN="${DOH_ORIGIN:-https://cloudflare-dns.com/dns-query}"
RDAP_URL="${RDAP_URL:-https://rdap.verisign.com/com/v1/domain/minds.com}"

for dependency in jq sed sort wget; do
  if ! command -v "$dependency" >/dev/null 2>&1; then
    echo "missing dependency: $dependency" >&2
    exit 1
  fi
done

dns_answer() {
  local dns_name="$1"
  local record_type="$2"
  wget -qO- --header='accept: application/dns-json' \
    "${DOH_ORIGIN}?name=${dns_name}&type=${record_type}"
}

print_dns_answer() {
  local dns_name="$1"
  local record_type="$2"
  local answer
  answer="$(dns_answer "$dns_name" "$record_type" | jq -r '
    if ((.Answer // []) | length) == 0 then
      "(no answer)"
    else
      (.Answer[] | [.name, .type, .TTL, .data] | @tsv)
    end
  ')"
  printf '%s\n' "${dns_name} ${record_type}"
  printf '%s\n' "$answer"
}

echo 'REGISTRY'
wget -qO- "$RDAP_URL" | jq '{
  ldhName,
  status,
  nameservers: [.nameservers[].ldhName],
  events: [.events[] | select(
    .eventAction == "registration" or
    .eventAction == "expiration" or
    .eventAction == "last changed"
  )],
  registrar: ([
    .entities[] |
    select(.roles | index("registrar")) |
    .vcardArray[1][] |
    select(.[0] == "fn") |
    .[3]
  ][0])
}'

echo 'DELEGATION'
for record_type in NS SOA DS DNSKEY; do
  print_dns_answer minds.com "$record_type"
done

echo 'CRITICAL HOSTS'
for dns_name in \
  minds.com \
  www.minds.com \
  api.minds.com \
  build.minds.com \
  api.build.minds.com \
  cdn.minds.com \
  media.minds.com \
  terrapin.minds.com \
  staging.terrapin.minds.com
do
  dns_rows="$(
    for record_type in CNAME A AAAA; do
      dns_answer "$dns_name" "$record_type" | jq -r '
        (.Answer // [])[] |
        select(.type == 1 or .type == 5 or .type == 28) |
        [.type, .TTL, .data] | @tsv
      '
    done | sort -u
  )"
  headers="$(
    wget --spider --server-response --max-redirect=0 --timeout=12 \
      "https://${dns_name}/" 2>&1 || true
  )"
  http_status="$(printf '%s\n' "$headers" | sed -n -E 's/^  HTTP\/[^ ]+ ([0-9]+).*/\1/p' | head -n 1)"
  redirect="$(printf '%s\n' "$headers" | sed -n -E 's/^  [Ll]ocation: (.*)/\1/p' | head -n 1)"
  printf '%s\n' "${dns_name} HTTPS=${http_status:-unavailable}${redirect:+ LOCATION=${redirect}}"
  printf '%s\n' "${dns_rows:-(no CNAME/A/AAAA answer)}"
done

echo 'MAIL AND WILDCARD TXT'
for dns_name in \
  _dmarc.minds.com \
  random-probe-20260824.minds.com \
  google._domainkey.minds.com \
  random-probe-20260824._domainkey.minds.com
do
  print_dns_answer "$dns_name" TXT
done
print_dns_answer minds.com MX
print_dns_answer minds.com TXT
print_dns_answer minds.com CAA
