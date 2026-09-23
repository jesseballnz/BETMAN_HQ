#!/bin/bash
set -euo pipefail

snapshot=${BETMAN_GROWTH_STATUS:-"$HOME/BETMAN/betman-hq-growth-agent/runtime/growth-agent/latest.json"}
control=${BETMAN_GROWTH_CONTROL:-"$HOME/BETMAN/betman-hq-growth-agent/runtime/growth-agent/control.json"}
key=${BETMAN_GROWTH_SYNC_KEY:-"$HOME/.ssh/id_ed25519_growth_snapshot"}
known_hosts=${BETMAN_GROWTH_KNOWN_HOSTS:-"$HOME/.ssh/known_hosts_growth_snapshot"}
host=${BETMAN_GROWTH_SYNC_HOST:-209.38.92.131}

test -r "$key"
test -r "$known_hosts"

response=$(mktemp "${TMPDIR:-/tmp}/growth-control.XXXXXX")
trap 'rm -f "$response"' EXIT

ssh_args=(
  -i "$key" \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" \
  -o ConnectTimeout=15 \
  root@"$host"
)

if [[ ${1:-} == --pull ]]; then
  /usr/bin/printf '%s\n' '{"schemaVersion":1,"request":"control"}' | /usr/bin/ssh "${ssh_args[@]}" > "$response"
else
  test -r "$snapshot"
  /usr/bin/ssh "${ssh_args[@]}" < "$snapshot" > "$response"
fi

/usr/bin/python3 - "$response" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    control = json.load(handle)
if control.get("schemaVersion") != 1 or control.get("mode") not in ("watch", "live"):
    raise SystemExit("invalid_growth_control")
PY

/bin/mkdir -p "${control%/*}"
/bin/chmod 0750 "${control%/*}"
/usr/bin/install -m 0640 "$response" "$control"
trap - EXIT
