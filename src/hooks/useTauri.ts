import { invoke } from '@tauri-apps/api/core';
import type { OAuthConfig, Account, Group, GroupMember, Message, Attachment, Settings } from '../types';

// ============================================================================
// Auth
// ============================================================================

export interface AuthStatus {
  hasOauthConfig: boolean;
  isAuthenticated: boolean;
  account: Account | null;
}

export async function saveOAuthConfig(clientId: string, clientSecret: string): Promise<void> {
  return invoke('save_oauth_config', { clientId, clientSecret });
}

export async function getOAuthConfig(): Promise<OAuthConfig | null> {
  return invoke('get_oauth_config');
}

export async function checkAuthStatus(): Promise<AuthStatus> {
  return invoke('check_auth_status');
}

export async function startOAuth(): Promise<string> {
  return invoke('start_oauth');
}

export async function performOAuth(): Promise<Account> {
  return invoke('perform_oauth');
}

export async function handleOAuthCallback(): Promise<Account> {
  return invoke('handle_oauth_callback');
}

export async function logout(): Promise<void> {
  return invoke('logout');
}

export async function refreshToken(): Promise<Account> {
  return invoke('refresh_token');
}

// ============================================================================
// Mail
// ============================================================================

export async function syncMessages(): Promise<Message[]> {
  return invoke('sync_messages');
}

export async function getMessages(groupId: number): Promise<Message[]> {
  return invoke('get_messages', { groupId });
}

export async function markAsRead(messageId: number): Promise<void> {
  return invoke('mark_as_read', { messageId });
}

export async function markGroupAsRead(groupId: number): Promise<void> {
  return invoke('mark_group_as_read', { groupId });
}

export async function getUnreadCounts(): Promise<[number, number][]> {
  return invoke('get_unread_counts');
}

export async function startIdleWatch(): Promise<void> {
  return invoke('start_idle_watch');
}

export async function stopIdleWatch(): Promise<void> {
  return invoke('stop_idle_watch');
}

// ============================================================================
// Groups
// ============================================================================

export async function getGroups(): Promise<Group[]> {
  return invoke('get_groups');
}

export async function getGroup(id: number): Promise<Group | null> {
  return invoke('get_group', { id });
}

export async function createGroup(name: string, avatarColor: string): Promise<number> {
  return invoke('create_group', { name, avatarColor });
}

export async function updateGroup(
  id: number,
  name: string,
  avatarColor: string,
  isPinned: boolean,
  notifyEnabled: boolean,
): Promise<void> {
  return invoke('update_group', { id, name, avatarColor, isPinned, notifyEnabled });
}

export async function deleteGroup(id: number): Promise<void> {
  return invoke('delete_group', { id });
}

export async function getGroupMembers(groupId: number): Promise<GroupMember[]> {
  return invoke('get_group_members', { groupId });
}

export async function addEmailToGroup(
  groupId: number,
  email: string,
  displayName?: string,
): Promise<number> {
  return invoke('add_email_to_group', { groupId, email, displayName });
}

export async function removeEmailFromGroup(groupId: number, email: string): Promise<void> {
  return invoke('remove_email_from_group', { groupId, email });
}

// ============================================================================
// Attachments
// ============================================================================

export async function downloadAttachment(
  attachmentId: number,
  savePath?: string,
): Promise<string> {
  return invoke('download_attachment', { attachmentId, savePath });
}

export async function openAttachment(attachmentId: number): Promise<void> {
  return invoke('open_attachment', { attachmentId });
}

export async function getAttachments(messageId: number): Promise<Attachment[]> {
  return invoke('get_attachments', { messageId });
}

// ============================================================================
// Settings
// ============================================================================

export async function getSettings(): Promise<Settings> {
  return invoke('get_settings');
}

export async function updateSettings(settings: Settings): Promise<void> {
  return invoke('update_settings', { settings });
}

export async function resetMessages(): Promise<void> {
  return invoke('reset_messages');
}
