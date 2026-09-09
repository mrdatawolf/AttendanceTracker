#!/usr/bin/env bash
# Starts the Attendance Tracker in the foreground, in demo mode, for use as
# the entrypoint of the systemd service installed by install-service.sh.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

export DEMO_MODE=true

if [[ ! -d ".next" ]]; then
  echo "No production build found in .next/, running 'npm run build'..."
  npm run build
fi

exec node_modules/.bin/next start -p "${PORT:-6029}"
