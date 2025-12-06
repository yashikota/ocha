import { atom } from 'jotai';
import type { AuthState, OAuthConfig, Account } from '../types';

// 認証状態
export const authStateAtom = atom<AuthState>('loading');

// OAuth設定
export const oauthConfigAtom = atom<OAuthConfig | null>(null);

// アカウント情報
export const accountAtom = atom<Account | null>(null);

// OAuth設定が完了しているかどうか
export const hasOAuthConfigAtom = atom((get) => {
  const config = get(oauthConfigAtom);
  return config !== null && config.clientId !== '' && config.clientSecret !== '';
});

