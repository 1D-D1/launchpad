#!/bin/bash
set -e

echo "🚀 LAUNCHPAD — Setup Script"
echo "=========================="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required"; exit 1; }
command -v docker compose >/dev/null 2>&1 && COMPOSE="docker compose" || COMPOSE="docker-compose"

# Create .env from example if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  # Generate NextAuth secret
  SECRET=$(openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/generate-a-secret-here/$SECRET/" .env
  else
    sed -i "s/generate-a-secret-here/$SECRET/" .env
  fi
  echo "✅ .env created (edit it with your API keys)"
else
  echo "ℹ️  .env already exists, skipping"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start infrastructure services
echo "🐳 Starting PostgreSQL and Redis..."
$COMPOSE up -d postgres redis

# Wait for postgres
echo "⏳ Waiting for PostgreSQL..."
until $COMPOSE exec -T postgres pg_isready -U launchpad 2>/dev/null; do
  sleep 1
done
echo "✅ PostgreSQL ready"

# Wait for redis
echo "⏳ Waiting for Redis..."
until $COMPOSE exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 1
done
echo "✅ Redis ready"

# Run Prisma migrations
echo "🗃️  Running database migrations..."
npx prisma generate
npx prisma db push

echo ""
echo "✅ LAUNCHPAD setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys (Anthropic, Stripe, etc.)"
echo "  2. Run: npm run dev"
echo "  3. Open: http://localhost:3000"
echo ""
