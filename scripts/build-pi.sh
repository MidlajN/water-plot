#!/usr/bin/env bash
# Builds a self-contained Plotter Studio bundle for the Raspberry Pi:
#
#   pnpm build:pi            -> dist/plotter-studio-pi/
#
# The folder holds the Next.js standalone server, the bundled Auto mode worker, the
# migration script and its migrations, and the systemd units with install.sh. Copy it
# to the Pi and run `sudo ./install.sh` inside it. It can also be built on the Pi.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
OUT="dist/plotter-studio-pi"
STANDALONE=".next/standalone"

# Remove the previous bundle first so the build can't trace it into the new one.
rm -rf "$OUT"
pnpm exec next build

[ -f "$STANDALONE/server.js" ] || { echo "Error: $STANDALONE/server.js is missing (is output: \"standalone\" set?)" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT"
cp -a "$STANDALONE/." "$OUT/"

# The standalone server doesn't include static assets; it serves them from here.
mkdir -p "$OUT/.next"
cp -a .next/static "$OUT/.next/static"
cp -a public "$OUT/public"

# Never ship local secrets or data.
rm -rf "$OUT/.env" "$OUT"/.env.* "$OUT/data"

node scripts/build-worker.mjs "$OUT"
cp -a drizzle "$OUT/drizzle"

# better-sqlite3 is native. Tracing copies only this machine's binary, so add the
# package's prebuilt Linux ones (64-bit Raspberry Pi OS uses linux-arm64), and link it at
# the top of node_modules so the worker (outside Next's own module map) finds it too.
SQLITE_SRC="$(node -p "require('path').dirname(require.resolve('better-sqlite3/package.json'))")"
SQLITE_DIR="$(cd "$OUT/node_modules" && ls -d .pnpm/better-sqlite3@*/node_modules/better-sqlite3 | head -1)"
[ -n "$SQLITE_DIR" ] || { echo "Error: better-sqlite3 isn't in the standalone node_modules" >&2; exit 1; }
mkdir -p "$OUT/node_modules/$SQLITE_DIR/prebuilds"
for target in linux-arm64 linux-x64; do
    cp "$SQLITE_SRC/prebuilds/$target.node" "$OUT/node_modules/$SQLITE_DIR/prebuilds/"
done
ln -sfn "$SQLITE_DIR" "$OUT/node_modules/better-sqlite3"
[ -f "$OUT/node_modules/better-sqlite3/package.json" ] || { echo "Error: couldn't link better-sqlite3" >&2; exit 1; }

mkdir -p "$OUT/deploy"
cp deploy/pi/*.service "$OUT/deploy/"
cp deploy/pi/install.sh "$OUT/install.sh"
chmod +x "$OUT/install.sh"
cp .env.example "$OUT/.env.example"

echo
echo "Pi bundle ready: $OUT ($(du -sh "$OUT" | cut -f1))"
echo "Copy it to the Pi and run: sudo ./install.sh"
