#!/bin/bash
set -euo pipefail

app_dir=${BETMAN_GROWTH_APP_DIR:-"$HOME/BETMAN/betman-hq-growth-agent"}
env_file=${BETMAN_GROWTH_ENV_FILE:-"$HOME/Library/Application Support/BETMAN/growth-agent.env"}
node_bin=${BETMAN_GROWTH_NODE_BIN:-/usr/local/opt/node/bin/node}

if [[ ! -x "$node_bin" ]]; then
  echo "Node.js runtime is missing at $node_bin" >&2
  exit 1
fi
if [[ ! -f "$env_file" ]]; then
  echo "Protected Growth Agent configuration is missing" >&2
  exit 1
fi
if [[ ! -f "$app_dir/dist-worker/worker/growth-agent.js" ]]; then
  echo "Compiled Growth Agent release is missing" >&2
  exit 1
fi

# Load literal KEY=VALUE records without shell-evaluating secret values.
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || {
    echo "Invalid configuration key" >&2
    exit 1
  }
  export "$key=$value"
done < "$env_file"

cd "$app_dir"
exec "$node_bin" dist-worker/worker/growth-agent.js
