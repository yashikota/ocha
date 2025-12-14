// OAuth設定
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// アカウント
export interface Account {
  id: number;
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  createdAt: string;
}

// グループ
export interface Group {
  id: number;
  name: string;
  avatarColor: string;
  isPinned: boolean;
  notifyEnabled: boolean;
  createdAt: string;
}

// グループメンバー
export interface GroupMember {
  id: number;
  groupId: number;
  email: string;
  displayName?: string;
}

// メッセージ
export interface Message {
  id: number;
  uid: number;
  messageId: string;
  groupId: number;
  fromEmail: string;
  fromName?: string;
  toEmail?: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  receivedAt: string;
  isRead: boolean;
  isSent: boolean;
  folder: string;
  attachments: Attachment[];
}

// 添付ファイル
export interface Attachment {
  id: number;
  messageId: number;
  filename: string;
  mimeType: string;
  size: number;
  localPath?: string;
}

// 設定
export interface Settings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  syncIntervalMinutes: number;
  launchAtLogin: boolean;
  minimizeToTray: boolean;
}

// 認証状態
export type AuthState = 'loading' | 'needs_config' | 'unauthenticated' | 'authenticated';
