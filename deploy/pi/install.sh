#!/usr/bin/env bash
# Installs (or updates) Plotter Studio on a Raspberry Pi from a bundle made by
# scripts/build-pi.sh. Run it from inside the bundle folder:
#
#   sudo ./install.sh
#
# Options (environment variables):
#   APP_DIR       where to install (default /opt/plotter-studio)
#   PLOTTER_USER  user the services run as (default: the user who ran sudo)
#
# Updates keep APP_DIR/.env and APP_DIR/data (database and generated plots).
set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-/opt/plotter-studio}"
RUN_USER="${PLOTTER_USER:-${SUDO_USER:-}}"

fail() { echo "Error: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "run with sudo: sudo ./install.sh"
[ -f "$BUNDLE_DIR/server.js" ] || fail "server.js not found; run this from the bundle made by scripts/build-pi.sh"
[ -n "$RUN_USER" ] && [ "$RUN_USER" != "root" ] || fail "set PLOTTER_USER to the (non-root) user the services should run as"
id "$RUN_USER" >/dev/null 2>&1 || fail "user '$RUN_USER' doesn't exist"

NODE="$(command -v node || true)"
[ -n "$NODE" ] || fail "Node.js isn't installed (Node 22 or newer is needed)"
NODE_MAJOR="$("$NODE" -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || fail "Node.js $("$NODE" -v) is too old; Node 22 or newer is needed (it has the built-in WebSocket the gateway link uses)"

echo "Installing Plotter Studio to $APP_DIR (services run as $RUN_USER, $("$NODE" -v))"

# Stop the services during the copy so the database isn't in use.
systemctl stop plotter-studio-worker.service plotter-studio-web.service 2>/dev/null || true

mkdir -p "$APP_DIR"
if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete --exclude '/data/' --exclude '/.env' --exclude '/deploy/' "$BUNDLE_DIR/" "$APP_DIR/"
else
    # Without rsync: replace everything except .env and data/.
    find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name data ! -name .env -exec rm -rf {} +
    (cd "$BUNDLE_DIR" && tar --exclude ./data --exclude ./.env --exclude ./deploy -cf - .) | (cd "$APP_DIR" && tar -xf -)
fi
mkdir -p "$APP_DIR/data"

if [ ! -f "$APP_DIR/.env" ]; then
    cp "$BUNDLE_DIR/.env.example" "$APP_DIR/.env"
    NEW_ENV=1
fi
chmod 600 "$APP_DIR/.env"

# better-sqlite3 is a native module. The bundle carries prebuilt binaries for 64-bit
# Linux (arm64, x64); on anything else (for example 32-bit Raspberry Pi OS) build the
# same version here and use that.
if ! (cd "$APP_DIR" && "$NODE" -e "new (require('better-sqlite3'))(':memory:').close()") 2>/dev/null; then
    VERSION="$(cd "$APP_DIR" && "$NODE" -p "require('better-sqlite3/package.json').version")"
    echo "Fetching better-sqlite3 $VERSION for $(uname -m)..."
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    (cd "$TMP" && npm install --no-save --no-audit --no-fund "better-sqlite3@$VERSION" >/dev/null) \
        || fail "couldn't build better-sqlite3 (needs internet and: sudo apt install build-essential python3)"
    TARGET="$(cd "$APP_DIR" && "$NODE" -p "require('path').dirname(require.resolve('better-sqlite3/package.json'))")"
    BUILT="$TMP/node_modules/better-sqlite3"
    [ -f "$BUILT/build/Release/better_sqlite3.node" ] && { mkdir -p "$TARGET/build/Release"; cp "$BUILT/build/Release/better_sqlite3.node" "$TARGET/build/Release/"; }
    [ -d "$BUILT/prebuilds" ] && cp "$BUILT"/prebuilds/*.node "$TARGET/prebuilds/" 2>/dev/null || true
    (cd "$APP_DIR" && "$NODE" -e "new (require('better-sqlite3'))(':memory:').close()") \
        || fail "better-sqlite3 still doesn't load"
fi

chown -R "$RUN_USER": "$APP_DIR"

for unit in plotter-studio-web plotter-studio-worker; do
    sed -e "s#@USER@#$RUN_USER#g" -e "s#@APP_DIR@#$APP_DIR#g" -e "s#@NODE@#$NODE#g" \
        "$BUNDLE_DIR/deploy/$unit.service" > "/etc/systemd/system/$unit.service"
done
systemctl daemon-reload
systemctl enable plotter-studio-web.service plotter-studio-worker.service >/dev/null

if [ "${NEW_ENV:-0}" -eq 1 ]; then
    echo
    echo "Created $APP_DIR/.env from the example. Edit it (at least GATEWAY_URL and"
    echo "GROQ_API_KEY), then start the services:"
    echo "  sudo nano $APP_DIR/.env"
    echo "  sudo systemctl start plotter-studio-web plotter-studio-worker"
    exit 0
fi

systemctl restart plotter-studio-web.service plotter-studio-worker.service
echo
echo "Plotter Studio is running: http://$(hostname).local:3000"
echo "Logs: journalctl -u plotter-studio-web -u plotter-studio-worker -f"
