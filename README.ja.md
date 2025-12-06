# Ocha 🍵

[English](README.md)  

## 概要

Ochaは、Gmailをチャットアプリのように使えるデスクトップメールクライアントです。同じ相手とのメールのやり取りを1つの会話としてまとめて表示します。

- 📧 **チャット形式の表示** - LINEのような吹き出しUIでメールを表示
- 👥 **グループ機能** - 複数のメールを1つのグループにまとめられる
- 🔔 **デスクトップ通知** - 新着メールをリアルタイムで通知

## インストール

[Releases](https://github.com/yashikota/ocha/releases) から最新版をダウンロードしてください。

- **Windows**: `.msi` または `.exe`
- **macOS**: `.dmg`
- **Linux**: `.AppImage` または `.deb`

## 初期設定

1. [Google Cloud Console](https://console.cloud.google.com/) でOAuth2クライアントを作成
2. 「OAuth同意画面」を設定
3. 「認証情報」からOAuthクライアントID（デスクトップアプリ）を作成
4. クライアントIDとクライアントシークレットをOchaの設定画面に入力
5. Googleアカウントでログイン

## 開発

```bash
# 依存関係のインストール
bun install

# 開発サーバーの起動
bun run tauri dev

# ビルド
bun run tauri build
```

## 技術スタック

- **Frontend**: React, TypeScript, Tailwind CSS, Jotai
- **Backend**: Rust, Tauri v2
- **Database**: SQLite
- **Protocol**: IMAP (Gmail)
