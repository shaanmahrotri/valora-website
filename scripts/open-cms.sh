#!/bin/bash
# Starts the local Decap CMS proxy + Astro dev server, opens the admin page
# in your browser, and stops both when this script is signaled (Ctrl+C,
# closing the window, or Automator's Quit).
#
# Double-clicked .command files and Automator apps run a shell that skips
# .zshrc/.zprofile, so Homebrew's node/npm (on PATH in a normal Terminal)
# wouldn't otherwise be found here - add it explicitly.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

cd "$(dirname "$0")/.."

if lsof -i :4321 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Dev server already running on 4321 - opening it instead of starting another."
  open "http://localhost:4321/admin"
  exit 0
fi

# Both servers run as background jobs of *this* script (no exec) so that the
# trap below reliably fires and kills both when the script is signaled -
# `exec`ing into one of them would discard the trap before it could clean up
# the other, which is exactly what orphaned decap-server last time.
PIDS=()

if lsof -i :8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "decap-server already running on port 8081 - reusing it."
else
  npx decap-server &
  PIDS+=("$!")
fi

./node_modules/.bin/astro dev &
PIDS+=("$!")

trap 'kill "${PIDS[@]}" 2>/dev/null' EXIT INT TERM

( sleep 2 && open "http://localhost:4321/admin" ) &

wait
