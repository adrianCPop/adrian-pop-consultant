#!/bin/bash

# Adrian Pop Portfolio Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh production

set -e

ENVIRONMENT=${1:-development}
PROJECT_NAME="adrian-pop-portfolio"

echo "🚀 Starting deployment for $ENVIRONMENT environment..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        print_status "Created .env file from .env.example"
        print_warning "Please edit .env file with your actual values before continuing."
        echo "Press any key to continue after editing .env file..."
        read -n 1 -s
    else
        print_error ".env.example file not found. Please create .env file manually."
        exit 1
    fi
fi

# Pull latest changes (if in git repository)
if [ -d .git ]; then
    print_status "Pulling latest changes from Git..."
    git pull origin main || print_warning "Failed to pull from Git. Continuing with local code."
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p nginx/ssl
mkdir -p logs
mkdir -p backups

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose down || true

# Remove old images (optional, uncomment if needed)
# print_status "Removing old Docker images..."
# docker-compose down --rmi all || true

# Build and start containers
print_status "Building and starting containers..."
if [ "$ENVIRONMENT" = "production" ]; then
    docker-compose -f docker-compose.yml build --no-cache
    docker-compose -f docker-compose.yml up -d
else
    docker-compose up -d --build
fi

# Wait for services to be ready
print_status "Waiting for services to start..."
sleep 30

# Health checks
print_status "Running health checks..."

# Check MongoDB
if docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    print_status "✅ MongoDB is healthy"
else
    print_error "❌ MongoDB health check failed"
fi

# Check Backend
if curl -f -s http://localhost:8000/health > /dev/null 2>&1; then
    print_status "✅ Backend is healthy"
else
    print_error "❌ Backend health check failed"
    print_status "Backend logs:"
    docker-compose logs --tail=20 backend
fi

# Check Frontend
if curl -f -s http://localhost:3000 > /dev/null 2>&1; then
    print_status "✅ Frontend is healthy"
else
    print_error "❌ Frontend health check failed"
    print_status "Frontend logs:"
    docker-compose logs --tail=20 frontend
fi

# Show container status
print_status "Container status:"
docker-compose ps

# Show useful information
echo ""
print_status "🎉 Deployment completed!"
echo ""
print_status "📍 Service URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   MongoDB:  localhost:27017"
echo ""
print_status "📝 Useful commands:"
echo "   View logs:        docker-compose logs -f [service]"
echo "   Restart service:  docker-compose restart [service]"
echo "   Stop all:         docker-compose down"
echo "   Update:           ./scripts/deploy.sh $ENVIRONMENT"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
    print_warning "🔐 For production deployment:"
    echo "   1. Configure your domain in .env file"
    echo "   2. Set up SSL certificates with Let's Encrypt"
    echo "   3. Configure DNS to point to your VPS IP"
    echo "   4. Update firewall settings"
    echo ""
fi

print_status "Deployment script completed successfully!"