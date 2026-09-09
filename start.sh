#!/usr/bin/env bash
# Starts the Attendance Tracker dev server in the foreground, for use as the
# entrypoint of the systemd service installed by install-service.sh.
#
# Usage:
#   ./start.sh          normal dev server
#   ./start.sh --demo   demo mode: database is cleared and reseeded on startup
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

for arg in "$@"; do
  case "$arg" in
    --demo) export DEMO_MODE=true ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--demo]" >&2
      exit 1
      ;;
  esac
done

exec node_modules/.bin/next dev -p "${PORT:-6029}"
