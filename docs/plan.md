---
name: ChatMailer開発プラン
overview: GmailをIMAPで接続し、チャット形式でメールを表示するデスクトップアプリをTauri + React + Tailwindで開発する。送信者ごとのグループ化と複数メールアドレスのグループ機能を実装。
todos:
  - id: setup-tauri
    content: Tauri v2 + React + TypeScript + Vite プロジェクト初期化
    status: completed
  - id: setup-tailwind
    content: Tailwind CSS v4 + グリーン基調ライトテーマ設定
    status: in_progress
  - id: setup-jotai
    content: Jotai インストール・Atoms設計
    status: pending
  - id: rust-db
    content: SQLite データベース層（oauth_configテーブル含む）実装
    status: pending
  - id: rust-oauth
    content: Google OAuth2 認証モジュール実装
    status: pending
  - id: rust-imap
    content: IMAP接続・XOAUTH2認証・メール取得実装
    status: pending
  - id: rust-idle
    content: IMAP IDLE（リアルタイム監視）実装
    status: pending
  - id: rust-notification
    content: 通知サービス（Tauri Notification Plugin）実装
    status: pending
  - id: rust-attachments
    content: 添付ファイル解析・保存・オープン機能実装
    status: pending
  - id: rust-commands
    content: Tauriコマンド（auth, mail, groups, attachments, settings）実装
    status: pending
  - id: ui-auth
    content: ログイン画面・OAuth設定入力画面実装
    status: pending
  - id: ui-sidebar
    content: サイドバー（グループ一覧・未読バッジ）実装
    status: pending
  - id: ui-chatview
    content: メッセージ表示・添付ファイルカード実装
    status: pending
  - id: ui-settings
    content: 設定画面（OAuth設定・グループ管理・通知設定）実装
    status: pending
  - id: integration
    content: 全体統合・動作テスト
    status: pending
---

# ocha - チャット形式メールクライアント開発プラン

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Tauri v2 |
| フロントエンド | React 18 + TypeScript + Vite |
| スタイリング | Tailwind CSS v4 |
| バックエンド | Rust |
| IMAP処理 | `async-imap` + `async-native-tls` クレート |
| メール解析 | `mailparse` クレート |
| データベース | SQLite (`rusqlite`) |
| 状態管理 | Jotai |
| OAuth2 | `oauth2` クレート + Google OAuth2 |
| 通知 | Tauri Notification Plugin |

## アーキテクチャ概要

```mermaid
flowchart TB
    subgraph Frontend["React Frontend"]
        Sidebar[Sidebar]
        ChatView[ChatView]
        Settings[Settings]
        Atoms[Jotai Atoms]
    end

    subgraph Tauri["Tauri Commands"]
        AuthCmd[auth commands]
        MailCmd[mail commands]
        GroupCmd[group commands]
        AttachCmd[attachment commands]
        NotifyCmd[notification commands]
    end

    subgraph Backend["Rust Backend"]
        OAuth[OAuth2 Module]
        IMAP[IMAP Client]
        IDLE[IMAP IDLE]
        MailParser[Mail Parser]
        Notifier[Notification Service]
        DB[(SQLite)]
    end

    subgraph External["External Services"]
        Google[Google OAuth2]
        Gmail[Gmail IMAP]
    end

    Sidebar --> Atoms
    ChatView --> Atoms
    Settings --> Atoms
    
    Atoms <--> AuthCmd
    Atoms <--> MailCmd
    Atoms <--> GroupCmd
    Atoms <--> AttachCmd
    Atoms <--> NotifyCmd
    
    AuthCmd --> OAuth
    MailCmd --> IMAP
    MailCmd --> MailParser
    GroupCmd --> DB
    AttachCmd --> DB
    NotifyCmd --> Notifier
    
    OAuth --> Google
    OAuth --> IMAP
    IMAP --> Gmail
    IDLE --> Gmail
    IDLE --> Notifier
    MailParser --> DB
    Notifier --> Frontend
```
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Tauri
    participant OAuth
    participant Gmail

    User->>Frontend: OAuth設定入力（Client ID/Secret）
    Frontend->>Tauri: save_oauth_config()
    User->>Frontend: ログインボタン押下
    Frontend->>Tauri: start_oauth()
    Tauri->>OAuth: 認証URL生成
    OAuth-->>User: ブラウザで認証画面表示
    User->>OAuth: Googleログイン許可
    OAuth->>Tauri: コールバック受信
    Tauri->>Gmail: XOAUTH2でIMAP接続
    Gmail-->>Tauri: メール取得
    Tauri-->>Frontend: 認証完了・メール同期
    Frontend-->>User: チャット画面表示
    
    loop IMAP IDLE
        Gmail-->>Tauri: 新着メール通知
        Tauri-->>User: デスクトップ通知
        Tauri-->>Frontend: UI更新
    end
```

## UI設計

### カラースキーム（グリーン基調ライトテーマ）

| 要素 | カラー |
|------|--------|
| 背景 | #f8faf8 |
| サイドバー背景 | #e8f5e9 |
| プライマリ | #2e7d32 |
| プライマリ（hover） | #1b5e20 |
| アクセント | #4caf50 |
| テキスト | #1a1a1a |
| テキスト（サブ） | #666666 |
| ボーダー | #c8e6c9 |
| 未読バッジ | #43a047 |

### レイアウト構成

```
┌──────────────────────────────────────────────────┐
│ ■ ocha                                    - □ X │
├────────┬─────────────────────────────────────────┤
│        │  山田太郎                      🔍  ⚙️  │
│ ────── ├─────────────────────────────────────────┤
│ グループ│                                        │
│ ────── │  ┌─────────────────────────────────┐   │
│        │  │ 山田太郎  10:30                 │   │
│ 山田(2)│  │ お疲れ様です。資料送ります。   │   │
│ 鈴木   │  │ 📎 報告書.pdf                   │   │
│ 営業   │  └─────────────────────────────────┘   │
│        │                                        │
│ ────── │  ┌─────────────────────────────────┐   │
│        │  │ 山田太郎  14:22                 │   │
│        │  │ 確認しました。問題ありません。 │   │
│ + 新規 │  └─────────────────────────────────┘   │
└────────┴─────────────────────────────────────────┘
```

### デザイン方針

- **全体**: クリーンでミニマルなライトテーマ
- **サイドバー**: グリーン系の淡い背景、グループリスト表示
- **メッセージエリア**: 白背景、送信者アバター + 名前 + タイムスタンプ + 本文
- **添付ファイル**: メッセージ内にファイルカード表示
- **未読バッジ**: グループ名横にグリーンのバッジで未読数表示

## フェーズ1: プロジェクトセットアップ

1. Tauri v2 プロジェクト初期化 (React + TypeScript + Vite)
2. Tailwind CSS v4 設定（グリーン基調ライトテーマ）
3. Jotai インストール・設定
4. Tauri Notification Plugin 追加
5. ディレクトリ構造の作成
6. Rustの依存クレート追加

## フェーズ2: データベース設計

```mermaid
erDiagram
    oauth_config ||--o| accounts : configures
    accounts ||--o{ messages : receives
    groups ||--o{ group_members : contains
    groups ||--o{ messages : has
    messages ||--o{ attachments : has

    oauth_config {
        int id PK
        text client_id
        text client_secret
        text redirect_uri
    }

    accounts {
        int id PK
        text email
        text access_token
        text refresh_token
        datetime token_expires_at
        datetime created_at
    }

    groups {
        int id PK
        text name
        text avatar_color
        bool is_pinned
        bool notify_enabled
        datetime created_at
    }

    group_members {
        int id PK
        int group_id FK
        text email
        text display_name
    }

    messages {
        int id PK
        int uid
        text message_id UK
        int group_id FK
        text from_email
        text from_name
        text subject
        text body_text
        text body_html
        datetime received_at
        bool is_read
    }

    attachments {
        int id PK
        int message_id FK
        text filename
        text mime_type
        int size
        text local_path
    }

    settings {
        int id PK
        bool notifications_enabled
        bool sound_enabled
        int sync_interval_minutes
    }
```

## フェーズ3: OAuth2 認証実装

### 利用者のセットアップ手順

1. Google Cloud Console でプロジェクト作成
2. OAuth 2.0 クライアントID作成（デスクトップアプリ）
3. ocha の設定画面で Client ID / Client Secret を入力・保存
4. ログインボタンでOAuth認証開始

### 認証フロー

1. **設定保存** - Client ID/Secret をローカルDBに暗号化保存
2. **認証開始** - ローカルサーバー起動、ブラウザで認証URL開く
3. **コールバック** - 認証コード受信 → トークン取得
4. **IMAP接続** - XOAUTH2でGmail IMAP認証

## フェーズ4: Rust バックエンド実装

### モジュール構成

```
src-tauri/src/
├── main.rs
├── commands/
│   ├── mod.rs
│   ├── auth.rs        # OAuth2認証コマンド
│   ├── mail.rs        # メール取得・同期
│   ├── groups.rs      # グループ管理
│   ├── attachments.rs # 添付ファイル操作
│   └── settings.rs    # 設定管理（OAuth含む）
├── oauth/
│   ├── mod.rs
│   └── google.rs      # Google OAuth2実装
├── imap/
│   ├── mod.rs
│   ├── client.rs      # IMAP接続・操作
│   └── idle.rs        # IMAP IDLE（リアルタイム監視）
├── mail/
│   ├── mod.rs
│   └── parser.rs      # メール解析
├── notification/
│   ├── mod.rs
│   └── service.rs     # 通知サービス
└── db/
    ├── mod.rs
    └── models.rs      # データモデル
```

### 主要Tauriコマンド

- `save_oauth_config` - OAuth Client ID/Secret 保存
- `get_oauth_config` - OAuth設定取得
- `start_oauth` - OAuth2認証開始
- `check_auth_status` - 認証状態確認
- `logout` - ログアウト
- `sync_messages` - メール同期
- `start_idle_watch` - IMAP IDLE監視開始
- `stop_idle_watch` - IMAP IDLE監視停止
- `get_groups` - グループ一覧
- `get_messages` - グループ内メッセージ取得
- `mark_as_read` - 既読にする
- `create_group` / `update_group` / `delete_group`
- `add_email_to_group` / `remove_email_from_group`
- `download_attachment` - 添付ファイル保存
- `open_attachment` - 添付ファイルを既定アプリで開く
- `get_settings` / `update_settings` - 設定取得・更新

## フェーズ5: 通知機能実装

### 機能

1. **IMAP IDLE** - サーバーからのプッシュ通知を待機
2. **デスクトップ通知** - Tauri Notification Pluginで表示
3. **通知設定** - グローバル/グループごとのON/OFF
4. **未読管理** - 未読数をサイドバーにバッジ表示
```mermaid
flowchart LR
    A[IDLE開始] --> B{新着メール?}
    B -->|Yes| C[メール取得]
    C --> D[DB保存]
    D --> E[通知表示]
    E --> F[フロントエンド更新]
    F --> A
    B -->|タイムアウト| A
```


## フェーズ6: フロントエンド実装

### コンポーネント構成

```
src/
├── components/
│   ├── Layout/
│   │   └── AppLayout.tsx
│   ├── Sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── GroupSection.tsx
│   │   ├── GroupItem.tsx
│   │   └── UnreadBadge.tsx
│   ├── Chat/
│   │   ├── ChatHeader.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageItem.tsx
│   │   └── AttachmentCard.tsx
│   ├── Settings/
│   │   ├── SettingsModal.tsx
│   │   ├── OAuthConfig.tsx
│   │   ├── GroupEditor.tsx
│   │   └── NotificationSettings.tsx
│   └── Auth/
│       └── LoginScreen.tsx
├── atoms/
│   ├── authAtom.ts
│   ├── groupsAtom.ts
│   ├── messagesAtom.ts
│   ├── settingsAtom.ts
│   └── uiAtom.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useGroups.ts
│   ├── useMessages.ts
│   └── useNotification.ts
└── App.tsx
```

### Jotai Atoms設計

```typescript
// authAtom.ts
export const authStateAtom = atom<'loading' | 'needs_config' | 'unauthenticated' | 'authenticated'>('loading')
export const oauthConfigAtom = atom<OAuthConfig | null>(null)
export const accountAtom = atom<Account | null>(null)

// groupsAtom.ts
export const groupsAtom = atom<Group[]>([])
export const selectedGroupIdAtom = atom<number | null>(null)
export const unreadCountsAtom = atom<Record<number, number>>({})

// messagesAtom.ts
export const messagesAtom = atom<Message[]>([])

// settingsAtom.ts
export const settingsAtom = atom<Settings>({
  notificationsEnabled: true,
  soundEnabled: true,
  syncIntervalMinutes: 5
})
```

## フェーズ7: 添付ファイル対応

1. **メール内添付ファイル検出** - `mailparse` で抽出
2. **メタデータ保存** - ファイル名、MIMEタイプ、サイズをDB保存
3. **遅延ダウンロード** - ユーザー操作時にダウンロード
4. **ファイルカード表示** - ファイル種別アイコン + 名前 + サイズ
5. **操作** - クリックで保存、ダブルクリックで開く

## ディレクトリ構造

```
ocha/
├── src/
│   ├── components/
│   ├── atoms/
│   ├── hooks/
│   └── App.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   ├── oauth/
│   │   ├── imap/
│   │   ├── mail/
│   │   ├── notification/
│   │   └── db/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── docs/
│   └── plan.md
├── package.json
└── tailwind.config.js
```

## 将来の拡張（MVP後）

- 返信機能（SMTP + OAuth2）
- 複数アカウント対応
- メール検索機能
- スレッド表示（In-Reply-To解析）
