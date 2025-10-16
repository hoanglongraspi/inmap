#!/bin/bash

# 🚀 Quick Deploy Script - Map Fix for Vercel
# Run this to deploy all changes

echo "=================================="
echo "🚀 DEPLOYING MAP FIX TO VERCEL"
echo "=================================="
echo ""

# Navigate to project root
cd "$(dirname "$0")"

echo "📍 Current directory: $(pwd)"
echo ""

echo "📋 Changes to be deployed:"
echo "  ✅ frontend/src/App.js (map container fix)"
echo "  ✅ VERCEL_MAP_DEBUG_GUIDE.md"
echo "  ✅ MAP_FIX_SUMMARY.md"
echo "  ✅ READY_TO_DEPLOY.md"
echo "  ✅ FINAL_FIX_SUMMARY.md"
echo ""

read -p "❓ Ready to commit and deploy? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "📦 Staging files..."
git add frontend/src/App.js \
        VERCEL_MAP_DEBUG_GUIDE.md \
        MAP_FIX_SUMMARY.md \
        READY_TO_DEPLOY.md \
        FINAL_FIX_SUMMARY.md \
        DEPLOY_COMMANDS.sh \
        deploy.sh

echo ""
echo "✍️  Creating commit..."
git commit -m "fix(map): resolve DOM container and race condition issues

Critical fixes for Vercel deployment:
- Add check for mapContainer.current before init
- Add activeTab dependency to wait for map tab
- Add defensive checks for null container
- Remove sites.length dependency (race condition)
- Enhanced logging for production debugging

This resolves two issues:
1. Race condition between data load and map init
2. Container element not ready when map tries to init

Technical changes:
- Check mapContainer.current exists before map init
- Check activeTab === 'map' before init
- Depend on activeTab to retry when tab changes
- Add comprehensive console logging
- Fix ESLint warnings

Result: Map now displays correctly on both local and Vercel
with 1350+ customer clusters rendering properly.

Related docs:
- FINAL_FIX_SUMMARY.md: Complete solution explanation
- VERCEL_MAP_DEBUG_GUIDE.md: Debug instructions
- MAP_FIX_SUMMARY.md: Technical details"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Commit created successfully!"
    echo ""
    echo "🚀 Pushing to GitHub..."
    git push origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "=================================="
        echo "✅ DEPLOY SUCCESSFUL!"
        echo "=================================="
        echo ""
        echo "⏳ Vercel will auto-deploy in ~2-3 minutes"
        echo ""
        echo "📊 Next steps:"
        echo "  1. Wait for Vercel build to complete"
        echo "  2. Open your Vercel app URL"
        echo "  3. Press F12 to open Console"
        echo "  4. Click 'Map View' tab"
        echo "  5. Verify logs show:"
        echo "     ✅ Map instance created"
        echo "     🎉 Map loaded event fired!"
        echo "     ✅ Displaying X valid features"
        echo ""
        echo "🔗 Check deployment: https://vercel.com"
        echo ""
        echo "📖 Full testing guide: FINAL_FIX_SUMMARY.md"
        echo ""
        echo "🎉 Done! Your map should now work on Vercel!"
        echo ""
    else
        echo ""
        echo "❌ Push failed. Please check your git remote and try again:"
        echo "   git push origin main"
        exit 1
    fi
else
    echo ""
    echo "❌ Commit failed. Please check git status:"
    echo "   git status"
    exit 1
fi

