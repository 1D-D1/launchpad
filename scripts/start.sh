#!/bin/sh

echo "=== LAUNCHPAD STARTUP ==="
echo "Running Prisma db push to sync schema..."
node ./node_modules/prisma/build/index.js db push --skip-generate 2>&1 || echo "WARNING: prisma db push failed, continuing..."

echo "Starting Next.js server..."
exec node server.js
