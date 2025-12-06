# Ocha 🍵

**Chat-style Email Client for Gmail**

[日本語](#日本語) | [English](#english)

---

## 日本語

### 概要

Ochaは、Gmailをチャットアプリのように使えるデスクトップメールクライアントです。同じ相手とのメールのやり取りを1つの会話としてまとめて表示します。

### 特徴

- 📧 **チャット形式の表示** - LINEのような吹き出しUIでメールを表示
- 👥 **グループ機能** - 複数のメールアドレスを1つのグループにまとめられる
- 🔔 **デスクトップ通知** - 新着メールをリアルタイムで通知
- 🔒 **OAuth2認証** - Googleアカウントで安全にログイン
- 📎 **添付ファイル対応** - 添付ファイルの表示・ダウンロード
- 🌐 **日本語/英語対応** - UIの多言語対応

### スクリーンショット

（準備中）

### インストール

[Releases](https://github.com/YOUR_USERNAME/ocha/releases) から最新版をダウンロードしてください。

- **Windows**: `.msi` または `.exe`
- **macOS**: `.dmg`
- **Linux**: `.AppImage` または `.deb`

### 初期設定

1. [Google Cloud Console](https://console.cloud.google.com/) でOAuth2クライアントを作成
2. 「OAuth同意画面」を設定
3. 「認証情報」からOAuthクライアントID（デスクトップアプリ）を作成
4. クライアントIDとクライアントシークレットをOchaの設定画面に入力
5. Googleアカウントでログイン

### 開発

```bash
# 依存関係のインストール
bun install

# 開発サーバーの起動
bun run tauri dev

# ビルド
bun run tauri build
```

### 技術スタック

- **Frontend**: React, TypeScript, Tailwind CSS, Jotai
- **Backend**: Rust, Tauri v2
- **Database**: SQLite
- **Protocol**: IMAP (Gmail)

---

## English

### Overview

Ocha is a desktop email client that lets you use Gmail like a chat app. It groups email conversations with the same person into a single chat view.

### Features

- 📧 **Chat-style UI** - Display emails in LINE-like bubble interface
- 👥 **Group functionality** - Combine multiple email addresses into one group
- 🔔 **Desktop notifications** - Real-time notifications for new emails
- 🔒 **OAuth2 authentication** - Secure login with Google account
- 📎 **Attachment support** - View and download attachments
- 🌐 **i18n support** - Japanese and English UI

### Screenshots

(Coming soon)

### Installation

Download the latest version from [Releases](https://github.com/YOUR_USERNAME/ocha/releases).

- **Windows**: `.msi` or `.exe`
- **macOS**: `.dmg`
- **Linux**: `.AppImage` or `.deb`

### Setup

1. Create an OAuth2 client in [Google Cloud Console](https://console.cloud.google.com/)
2. Configure "OAuth consent screen"
3. Create OAuth client ID (Desktop app) in "Credentials"
4. Enter Client ID and Client Secret in Ocha settings
5. Login with your Google account

### Development

```bash
# Install dependencies
bun install

# Start development server
bun run tauri dev

# Build
bun run tauri build
```

### Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Jotai
- **Backend**: Rust, Tauri v2
- **Database**: SQLite
- **Protocol**: IMAP (Gmail)

---

## License

MIT License
