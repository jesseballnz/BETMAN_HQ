#!/bin/bash
set -euo pipefail

if [[ $(uname -s) != Darwin ]]; then
  echo "This installer is for macOS." >&2
  exit 1
fi
if [[ $(hostname -s) != BETMAN-WORKER ]]; then
  echo "Refusing to install outside BETMAN-WORKER." >&2
  exit 1
fi

app_dir="$HOME/BETMAN/betman-hq-growth-agent"
runtime_dir="$app_dir/runtime/growth-agent"
env_file="$HOME/Library/Application Support/BETMAN/growth-agent.env"
logs_dir="$HOME/Library/Logs/BETMAN"
launch_agents="$HOME/Library/LaunchAgents"
plist="$launch_agents/ai.betman.growth-agent.plist"
node_bin=/usr/local/opt/node/bin/node
npm_bin=/usr/local/opt/node/bin/npm
export PATH="$(dirname "$node_bin"):/usr/bin:/bin:/usr/sbin:/sbin"

[[ -x "$node_bin" && -x "$npm_bin" ]] || {
  echo "The existing OpenClaw Node.js runtime is required." >&2
  exit 1
}
[[ -f "$app_dir/package-lock.json" && -f "$app_dir/deploy/ai.betman.growth-agent.plist" ]] || {
  echo "Growth Agent release is incomplete at $app_dir." >&2
  exit 1
}
[[ -f "$env_file" ]] || {
  echo "Protected configuration is missing at $env_file." >&2
  exit 1
}

mkdir -p "$runtime_dir" "$logs_dir" "$launch_agents"
chmod 700 "$HOME/Library/Application Support/BETMAN"
chmod 600 "$env_file"
chmod 750 "$runtime_dir" "$logs_dir"
chmod 750 "$app_dir/deploy/run-growth-agent-macos.sh"

cd "$app_dir"
"$npm_bin" ci
"$npm_bin" run build:growth-agent
"$npm_bin" test -- --runInBand
"$npm_bin" run lint
"$npm_bin" audit --omit=dev

sed "s|__HOME__|$HOME|g" deploy/ai.betman.growth-agent.plist > "$plist.tmp"
plutil -lint "$plist.tmp"
mv "$plist.tmp" "$plist"
chmod 600 "$plist"

domain="gui/$(id -u)"
launchctl bootout "$domain/ai.betman.growth-agent" 2>/dev/null || true
launchctl bootstrap "$domain" "$plist"
launchctl enable "$domain/ai.betman.growth-agent"
launchctl kickstart -k "$domain/ai.betman.growth-agent"

echo "Growth Agent launchd service installed in read-only dry-run mode."
