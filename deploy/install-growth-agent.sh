#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root on BETMAN-WORKER." >&2
  exit 1
fi

app_dir=/opt/betman/betman_hq
runtime_dir="$app_dir/runtime/growth-agent"
env_file=/etc/betman/growth-agent.env

if ! id betman >/dev/null 2>&1; then
  echo "Required service user 'betman' does not exist." >&2
  exit 1
fi

node_major=$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)
if [[ $node_major -lt 20 ]]; then
  echo "Node.js 20.9 or newer is required." >&2
  exit 1
fi

if [[ ! -f "$app_dir/package-lock.json" || ! -f "$app_dir/deploy/betman-growth-agent.service" ]]; then
  echo "BETMAN HQ release is incomplete at $app_dir." >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  echo "Protected configuration is missing at $env_file." >&2
  exit 1
fi

install -d -o betman -g betman -m 0750 "$runtime_dir"
cd "$app_dir"
npm ci
npm run build:growth-agent
npm test -- --runInBand
npm run lint
npm run build
npm audit --omit=dev

install -o root -g root -m 0644 deploy/betman-growth-agent.service /etc/systemd/system/betman-growth-agent.service
install -o root -g root -m 0644 deploy/betman-growth-agent.timer /etc/systemd/system/betman-growth-agent.timer
systemctl daemon-reload
systemctl enable --now betman-growth-agent.timer

echo "Growth Agent timer enabled. The service remains dry-run and has no Meta write path."
