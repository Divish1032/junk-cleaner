#!/bin/bash

set -e

REPO="Divish1032/junk-cleaner"
API_URL="https://api.github.com/repos/$REPO/releases/latest"

echo "🧹 Installing Junk Cleaner..."

OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" = "Darwin" ]; then
    echo "🍏 Detected macOS ($ARCH)"
    
    # Get the latest Mac DMG download URL from GitHub (Handles Apple Silicon and Intel)
    if [ "$ARCH" = "arm64" ]; then
        DOWNLOAD_URL=$(curl -s $API_URL | grep "browser_download_url.*aarch64\.dmg" | cut -d '"' -f 4)
    else
        DOWNLOAD_URL=$(curl -s $API_URL | grep "browser_download_url.*x86_64\.dmg" | cut -d '"' -f 4)
    fi

    if [ -z "$DOWNLOAD_URL" ]; then
        echo "❌ Could not find a suitable macOS release. (Ensure a release exists on GitHub)"
        exit 1
    fi

    echo "⬇️ Downloading latest release..."
    curl -L "$DOWNLOAD_URL" -o /tmp/JunkCleaner.dmg

    echo "📦 Installing to /Applications..."
    
    # Mount DMG quietly, copy app, unmount
    # The mount path can vary, so we parse it from hdiutil output
    MOUNT_DIR=$(hdiutil attach -nobrowse /tmp/JunkCleaner.dmg | grep /Volumes | awk -F '\t' '{print $3}')
    
    if [ -d "/Applications/JunkCleaner.app" ]; then
        echo "🗑 Removing existing installation..."
        rm -rf /Applications/JunkCleaner.app
    fi

    cp -R "$MOUNT_DIR/JunkCleaner.app" /Applications/
    hdiutil detach "$MOUNT_DIR" -quiet
    rm /tmp/JunkCleaner.dmg

    echo "🔓 Removing macOS Gatekeeper quarantine flag..."
    # This specifically removes the Apple downloaded quarantine flag so it opens without warnings
    xattr -cr /Applications/JunkCleaner.app 2>/dev/null || true

    echo ""
    echo "✅ Success! Junk Cleaner has been installed to your Applications folder."
    echo "🚀 You can now open it from Launchpad or Spotlight."

elif [ "$OS" = "Linux" ]; then
    echo "🐧 Detected Linux"
    
    # Get the latest Linux AppImage download URL
    DOWNLOAD_URL=$(curl -s $API_URL | grep "browser_download_url.*AppImage" | cut -d '"' -f 4)

    if [ -z "$DOWNLOAD_URL" ]; then
        echo "❌ Could not find a suitable Linux release."
        exit 1
    fi

    echo "⬇️ Downloading latest release..."
    curl -L "$DOWNLOAD_URL" -o /tmp/JunkCleaner.AppImage

    echo "📦 Installing to ~/.local/bin..."
    mkdir -p ~/.local/bin
    
    if [ -f "$HOME/.local/bin/JunkCleaner" ]; then
        rm "$HOME/.local/bin/JunkCleaner"
    fi

    mv /tmp/JunkCleaner.AppImage ~/.local/bin/JunkCleaner
    chmod +x ~/.local/bin/JunkCleaner

    echo ""
    echo "✅ Success! JunkCleaner has been installed to ~/.local/bin/JunkCleaner"
    echo "🚀 You can run it by typing '~/.local/bin/JunkCleaner' in your terminal."
    
else
    echo "❌ Unsupported OS for CLI installation: $OS"
    echo "For Windows, please download the .exe installer directly from the GitHub releases page."
    exit 1
fi
