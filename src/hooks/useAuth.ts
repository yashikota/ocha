import { useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { authStateAtom, oauthConfigAtom, accountAtom } from '../atoms';
import * as tauri from './useTauri';

export function useAuth() {
  const [authState, setAuthState] = useAtom(authStateAtom);
  const [oauthConfig, setOAuthConfig] = useAtom(oauthConfigAtom);
  const [account, setAccount] = useAtom(accountAtom);

  // 認証状態を確認
  const checkStatus = useCallback(async () => {
    try {
      setAuthState('loading');
      const status = await tauri.checkAuthStatus();

      if (!status.hasOauthConfig) {
        setAuthState('needs_config');
        return;
      }

      if (status.isAuthenticated && status.account) {
        setAccount(status.account);
        setAuthState('authenticated');
      } else {
        setAuthState('unauthenticated');
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setAuthState('needs_config');
    }
  }, [setAuthState, setAccount]);

  // OAuth設定を保存
  const saveConfig = useCallback(async (clientId: string, clientSecret: string) => {
    await tauri.saveOAuthConfig(clientId, clientSecret);
    setOAuthConfig({
      clientId,
      clientSecret,
      redirectUri: 'http://localhost:8234/callback',
    });
    setAuthState('unauthenticated');
  }, [setOAuthConfig, setAuthState]);

  // OAuth認証を開始
  const startLogin = useCallback(async () => {
    // ブラウザを開いてコールバックを待機（バックエンドで一括処理）
    const newAccount = await tauri.performOAuth();
    setAccount(newAccount);
    setAuthState('authenticated');

    return newAccount;
  }, [setAccount, setAuthState]);

  // ログアウト（OAuth設定画面に戻る）
  const logout = useCallback(async () => {
    await tauri.logout();
    setAccount(null);
    setOAuthConfig(null);
    setAuthState('needs_config');
  }, [setAccount, setOAuthConfig, setAuthState]);

  // 初回マウント時に認証状態を確認
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    authState,
    oauthConfig,
    account,
    checkStatus,
    saveConfig,
    startLogin,
    logout,
  };
}
