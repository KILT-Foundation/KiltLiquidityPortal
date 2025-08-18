#!/bin/bash
# Project cleanup script for development artifacts

echo "🧹 Cleaning project structure..."

# Remove temporary development images and files from attached_assets
find attached_assets/ -name "image_*.png" -delete 2>/dev/null || true
find attached_assets/ -name "Pasted-*.txt" -delete 2>/dev/null || true
find attached_assets/ -name "*.mp4" -delete 2>/dev/null || true
find attached_assets/ -name "*.xlsx" -delete 2>/dev/null || true

# Keep only essential assets
mkdir -p assets/
cp attached_assets/KILT_400x400_transparent_1751723574123.png assets/kilt-logo.png 2>/dev/null || true

# Remove most of attached_assets except logo
rm -rf attached_assets/ 2>/dev/null || true

echo "✅ Project cleaned and organized"
echo "📁 Documentation moved to /docs/"
echo "🔧 Scripts organized in /scripts/"
echo "🖼️  Assets moved to /assets/"