#!/usr/bin/env bash
# Starts the Ollama bridge and a temporary public HTTPS address for it (macOS / Linux).
# Requires: Ollama running with the chosen model pulled, Node 18+, and cloudflared on PATH.
set -euo pipefail
cd "$(dirname "$0")"
for cmd in node cloudflared ollama; do command -v "$cmd" >/dev/null || { echo "$cmd is not installed or not on PATH"; exit 1; }; done
node ollama-bridge.mjs & BRIDGE=$!
LOG=$(mktemp)
cloudflared tunnel --url http://127.0.0.1:11500 2>"$LOG" & TUNNEL=$!
trap 'kill $BRIDGE $TUNNEL 2>/dev/null' EXIT
URL=""
for _ in $(seq 1 45); do sleep 1; URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true); [ -n "$URL" ] && break; done
[ -z "$URL" ] && { echo "Could not open the tunnel. See $LOG"; exit 1; }
echo
echo "Bridge address: $URL"
echo "Bridge token:   $(cat bridge-token.txt)"
echo "Paste both into the system: Model connection > Team Ollama. Keep this terminal open. Ctrl+C to stop."
wait $BRIDGE
