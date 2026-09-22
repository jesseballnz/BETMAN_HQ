#!/bin/bash
set -euo pipefail

snapshot=${BETMAN_GROWTH_STATUS:-"$HOME/BETMAN/betman-hq-growth-agent/runtime/growth-agent/latest.json"}
key=${BETMAN_GROWTH_SYNC_KEY:-"$HOME/.ssh/id_ed25519_growth_snapshot"}
known_hosts=${BETMAN_GROWTH_KNOWN_HOSTS:-"$HOME/.ssh/known_hosts_growth_snapshot"}
host=${BETMAN_GROWTH_SYNC_HOST:-209.38.92.131}

test -r "$snapshot"
test -r "$key"
test -r "$known_hosts"

/usr/bin/ssh \
  -i "$key" \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" \
  -o ConnectTimeout=15 \
  root@"$host" < "$snapshot"

