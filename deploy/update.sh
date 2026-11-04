#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
(cd server && npm ci --omit=dev --silent)
(cd web && npm ci --silent && npm run build)
mkdir -p /var/www/squeekmatch
rsync -a --delete dist/ /var/www/squeekmatch/
pm2 restart squeekmatch 2>/dev/null || pm2 start server/src/index.js --name squeekmatch
pm2 save
echo "SqueekMatch updated."
