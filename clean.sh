#!/bin/bash

# This script cleans the project by removing the node_modules directory and the dist directory in current directory and all subdirectories.

set -e

echo "Cleaning project..."

# Remove node_modules directories
echo "Removing node_modules directories..."
find . -name "node_modules" -type d -prune -exec rm -rf {} +

# Remove dist directories
echo "Removing dist directories..."
find . -name "dist" -type d -prune -exec rm -rf {} +

# Remove Next.js build output
echo "Removing .next directories..."
find . -name ".next" -type d -prune -exec rm -rf {} +

# Remove Turborepo cache
echo "Removing .turbo directories..."
find . -name ".turbo" -type d -prune -exec rm -rf {} +

echo "Done! Run 'pnpm install' to reinstall dependencies."
