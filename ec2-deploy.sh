#!/bin/bash

# LoadSetu EC2 Deployment Script
# Run this on your EC2 instance after cloning the repository

set -e  # Exit on error

echo "🚀 LoadSetu EC2 Deployment Starting..."
echo ""

# Step 1: Pull latest code
echo "📥 Step 1: Pulling latest code from GitHub..."
git pull origin main
echo "✅ Code updated"
echo ""

# Step 2: Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "⚠️  .env.production not found!"
    echo "📝 Creating .env.production from example..."
    cp .env.production.example .env.production
    echo ""
    echo "⚠️  IMPORTANT: Edit .env.production with your production credentials:"
    echo "   - JWT_SECRET (generate a secure 64-byte base64 string)"
    echo "   - INTERNAL_API_SECRET (generate a secure 32-char string)"
    echo "   - GEMINI_API_KEY (your Google Gemini API key)"
    echo "   - Database credentials (if using external DB)"
    echo "   - Payment gateway keys (Razorpay)"
    echo "   - WhatsApp/Twilio credentials"
    echo ""
    echo "Run: nano .env.production"
    echo ""
    exit 1
fi

# Step 3: Stop existing containers
echo "🛑 Step 2: Stopping existing containers..."
docker-compose -f docker-compose.prod.yml --env-file .env.production down || true
echo "✅ Containers stopped"
echo ""

# Step 4: Remove old images (optional - uncomment if you want clean build)
# echo "🗑️  Step 3: Removing old images..."
# docker-compose -f docker-compose.prod.yml down --rmi all || true
# echo "✅ Old images removed"
# echo ""

# Step 5: Build and start services
echo "🏗️  Step 3: Building and starting all services..."
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --build
echo "✅ Services started"
echo ""

# Step 6: Wait for services to be healthy
echo "⏳ Step 4: Waiting for services to become healthy (this may take 2-3 minutes)..."
sleep 30

# Check container status
echo ""
echo "📊 Container Status:"
docker-compose -f docker-compose.prod.yml --env-file .env.production ps
echo ""

# Step 7: Create missing Kafka topics
echo "📝 Step 5: Creating Kafka topics..."
sleep 10  # Wait for Kafka to be fully ready

docker exec loadsetu-kafka kafka-topics --create --if-not-exists \
  --bootstrap-server localhost:9092 \
  --partitions 6 --replication-factor 1 \
  --topic load-events || echo "Topic load-events already exists"

docker exec loadsetu-kafka kafka-topics --create --if-not-exists \
  --bootstrap-server localhost:9092 \
  --partitions 6 --replication-factor 1 \
  --topic load-matches || echo "Topic load-matches already exists"

echo "✅ Kafka topics created"
echo ""

# Step 8: Verify deployment
echo "🔍 Step 6: Verifying deployment..."
echo ""

echo "Checking backend health..."
sleep 30  # Wait for backend to start
curl -f http://localhost:8080/actuator/health || echo "⚠️  Backend not ready yet"
echo ""

echo "Checking ML engine health..."
curl -f http://localhost:8000/health || echo "⚠️  ML engine not ready yet"
echo ""

echo "Checking web app health..."
curl -f http://localhost:3000/api/health || echo "⚠️  Web app not ready yet"
echo ""

# Step 9: Show logs
echo "📋 Recent logs:"
docker-compose -f docker-compose.prod.yml --env-file .env.production logs --tail=20
echo ""

echo "✅ Deployment complete!"
echo ""
echo "📊 To check status: docker-compose -f docker-compose.prod.yml ps"
echo "📋 To view logs: docker-compose -f docker-compose.prod.yml logs -f [service]"
echo "🛑 To stop: docker-compose -f docker-compose.prod.yml down"
echo ""
echo "🌐 Access your application:"
echo "   - Frontend: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo "   - Backend API: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/api/spring"
echo "   - ML Engine: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/api/ai"
echo ""
