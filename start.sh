#!/bin/bash

echo "🚀 Starting Campus Security System..."

echo "📦 Starting Docker services..."
docker compose up -d

echo "⚙️ Starting Backend..."
cd backend && npm run dev &

cd ..

echo "💻 Starting Web Dashboard..."
cd web-dashboard && npm start &

cd ..

echo "🤖 Starting ML Service..."
cd ml-service
source venv/bin/activate
uvicorn src.api.app:app --reload &
cd ..

echo "✅ All services started!"

echo "📱 Web Dashboard: http://localhost:3000"
echo "🔌 Backend API: http://localhost:5000"
echo "🤖 ML Service: http://localhost:5001"