#!/bin/bash
# Quick Deployment Script for Vercel
# This script helps you deploy the MCGrocer frontend to Vercel

echo "🚀 MCGrocer Frontend - Vercel Deployment"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "Please run this script from the frontend-react directory"
    exit 1
fi

# Check if vercel is installed
echo "📦 Checking Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "✅ Vercel CLI ready"
echo ""

# Login check
echo "🔐 Checking Vercel authentication..."
if ! vercel whoami &> /dev/null; then
    echo "Please login to Vercel:"
    vercel login
else
    echo "✅ Already logged in to Vercel as: $(vercel whoami)"
fi

echo ""
echo "📋 Deployment Options:"
echo "1. Deploy to Production (recommended)"
echo "2. Deploy Preview"
echo "3. Link Project (first time setup)"
echo "4. Exit"
echo ""

read -p "Choose option (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Deploying to Production..."
        echo ""
        vercel --prod
        ;;
    2)
        echo ""
        echo "🔍 Deploying Preview..."
        echo ""
        vercel
        ;;
    3)
        echo ""
        echo "🔗 Linking Project..."
        echo ""
        vercel link
        echo ""
        echo "Now run this script again and choose option 1 or 2"
        ;;
    4)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Visit your deployment URL"
echo "2. Test login with careers@mcgrocer.com / McGrocer"
echo "3. Add custom domain in Vercel dashboard (optional)"
echo ""
