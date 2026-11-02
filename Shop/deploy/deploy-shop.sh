#!/bin/sh
# Build StyleMint Shop on the VPS and publish dist/ to the folder the API serves at /shop/ (contract A2).
#
#   Run ON THE VPS as `administrator` (no sudo), from a checkout/tarball of this repo:
#     sh Shop/deploy/deploy-shop.sh [path-to-Shop]   (default: the directory above this script)
#
# - Builds inside node:22-alpine (never on Windows, never on the host's node).
# - Publishes atomically-ish: rsync into $TARGET with --delete-after, hashed assets first, index.html/sw.js last,
#   so an open tab never loads an index.html whose assets are not there yet.
# - The API container mounts $TARGET read-only at /app/shop (Shop:RootPath); no API rebuild or restart.
# - Does not touch nginx or any container.
set -eu

SHOP_DIR=${1:-$(cd "$(dirname "$0")/.." && pwd)}
TARGET=${SHOP_TARGET:-/home/administrator/stylemint-shop/dist}

if [ "$(df -P "$HOME" | awk 'NR==2 {print $4}')" -lt 2000000 ]; then
  echo "Less than 2 GB free on the home volume — not building (see the 2026-10-09 disk incident)." >&2
  exit 1
fi

echo "Building $SHOP_DIR"
docker run --rm --cpus=2 --memory=2g -v "$SHOP_DIR":/app -w /app node:22-alpine nice -n 19 sh -c \
  "npm ci --no-audit --no-fund && npm run typecheck && npm run lint && npm test -- --run && npm run build"

test -f "$SHOP_DIR/dist/index.html" || { echo "dist/index.html missing" >&2; exit 1; }
mkdir -p "$TARGET"

# 1) new hashed assets + static files (keeps old assets until step 3, so open tabs keep working)
rsync -a --exclude index.html --exclude sw.js "$SHOP_DIR/dist/" "$TARGET/"
# 2) the entry points
rsync -a "$SHOP_DIR/dist/index.html" "$SHOP_DIR/dist/sw.js" "$TARGET/"
# 3) drop files that are no longer part of the build
rsync -a --delete-after "$SHOP_DIR/dist/" "$TARGET/"

# node_modules/dist were written by root inside the container; clean them without sudo.
docker run --rm -v "$SHOP_DIR":/app alpine rm -rf /app/node_modules /app/dist

echo "Published to $TARGET:"
ls -la "$TARGET"
