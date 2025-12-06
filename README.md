# Ocha 🍵

[日本語版](README.ja.md)  

## Overview

Ocha is a desktop email client that lets you use Gmail like a chat app. It groups email conversations with the same person into a single chat view.

- 📧 **Chat-style UI** - Display emails in LINE-like bubble interface
- 👥 **Group functionality** - Combine multiple emails into one group
- 🔔 **Desktop notifications** - Real-time notifications for new emails

## Installation

Download the latest version from [Releases](https://github.com/yashikota/ocha/releases).

- **Windows**: `.msi` or `.exe`
- **macOS**: `.dmg`
- **Linux**: `.AppImage` or `.deb`

## Setup

1. Create an OAuth2 client in [Google Cloud Console](https://console.cloud.google.com/)
2. Configure "OAuth consent screen"
3. Create OAuth client ID (Desktop app) in "Credentials"
4. Enter Client ID and Client Secret in Ocha settings
5. Login with your Google account

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run tauri dev

# Build
bun run tauri build
```

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Jotai
- **Backend**: Rust, Tauri v2
- **Database**: SQLite
- **Protocol**: IMAP (Gmail)

