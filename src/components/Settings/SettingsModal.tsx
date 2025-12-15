import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useAtom } from 'jotai';
import { settingsModalOpenAtom } from '../../atoms/uiAtom';
import { settingsAtom } from '../../atoms/settingsAtom';
import { accountAtom } from '../../atoms/authAtom';
import { useAuth } from '../../hooks/useAuth';
import { getSettings, updateSettings, resetMessages } from '../../hooks/useTauri';
import type { Settings } from '../../types';
import { ConfirmDialog } from '../UI';

type ConfirmType = 'logout' | 'reset' | null;

export function SettingsModal() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useAtom(settingsModalOpenAtom);
  const [settings, setSettings] = useAtom(settingsAtom);
  const [account] = useAtom(accountAtom);
  const { logout } = useAuth();

  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);

  // 確認ダイアログの状態
  const [confirmType, setConfirmType] = useState<ConfirmType>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getSettings().then(setLocalSettings).catch(console.error);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // 確認ダイアログが開いているときは何もしない（ダイアログ側で処理）
      if (e.key === 'Escape' && isOpen && !isConfirmOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isConfirmOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(localSettings);
      setSettings(localSettings);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutClick = () => {
    setConfirmType('logout');
    setIsConfirmOpen(true);
  };

  const handleResetClick = () => {
    setConfirmType('reset');
    setIsConfirmOpen(true);
  };

  const executeLogout = async () => {
    await logout();
    setIsConfirmOpen(false);
    setIsOpen(false);
  };

  const executeReset = async () => {
    try {
      await resetMessages();
      // alertは削除し、リロードのみ行う（ダイアログは閉じる）
      setIsConfirmOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset messages:', error);
      // エラー時はダイアログを閉じるだけ（必要ならエラー表示を追加）
      setIsConfirmOpen(false);
    }
  };

  const handleConfirm = () => {
    if (confirmType === 'logout') {
      executeLogout();
    } else if (confirmType === 'reset') {
      executeReset();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
          {/* ヘッダー */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text">{t('settings.title')}</h2>
              <span className="text-xs text-text-sub">v{__APP_VERSION__}</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg hover:bg-hover transition-colors"
              aria-label={t('common.close')}
            >
              <span className="text-xl">✖️</span>
            </button>
          </div>

          {/* コンテンツ */}
          <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
            {/* アカウント */}
            <section>
              <h3 className="text-sm font-semibold text-text mb-3">{t('settings.account.title')}</h3>
              <div className="bg-bg rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text-sub">{t('settings.account.email')}</div>
                    <div className="text-sm font-medium text-text">{account?.email || '-'}</div>
                  </div>
                  <button
                    onClick={handleLogoutClick}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    {t('settings.account.logout')}
                  </button>
                </div>
              </div>
            </section>

            {/* 通知設定 */}
            <section>
              <h3 className="text-sm font-semibold text-text mb-3">{t('settings.notifications.title')}</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.notificationsEnabled}
                    onChange={(e) => setLocalSettings({ ...localSettings, notificationsEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text">{t('settings.notifications.enabled')}</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.soundEnabled}
                    onChange={(e) => setLocalSettings({ ...localSettings, soundEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text">{t('settings.notifications.sound')}</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.autoMarkAsRead}
                    onChange={(e) => setLocalSettings({ ...localSettings, autoMarkAsRead: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text">{t('settings.notifications.autoMarkAsRead')}</span>
                </label>

                <div className="flex items-center gap-3">
                  <label className="text-sm text-text">{t('settings.notifications.syncInterval')}</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={localSettings.syncIntervalMinutes}
                    onChange={(e) => setLocalSettings({ ...localSettings, syncIntervalMinutes: parseInt(e.target.value) || 5 })}
                    className="w-20 px-2 py-1 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </section>

            {/* システム設定 */}
            <section>
              <h3 className="text-sm font-semibold text-text mb-3">{t('settings.system.title')}</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text">{t('settings.system.language')}</span>
                  <select
                    value={i18n.language}
                    onChange={(e) => {
                      i18n.changeLanguage(e.target.value);
                      localStorage.setItem('language', e.target.value);
                    }}
                    className="px-2 py-1 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="ja">日本語</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.launchAtLogin}
                    onChange={(e) => setLocalSettings({ ...localSettings, launchAtLogin: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text">{t('settings.system.launchAtLogin')}</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.minimizeToTray}
                    onChange={(e) => setLocalSettings({ ...localSettings, minimizeToTray: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text">{t('settings.system.minimizeToTray')}</span>
                </label>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">{t('settings.system.downloadPath')}</span>
                    <select
                      value={localSettings.downloadPath}
                      onChange={(e) => setLocalSettings({ ...localSettings, downloadPath: e.target.value as 'downloads' | 'custom' })}
                      className="px-2 py-1 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="downloads">{t('settings.system.downloadPathDownloads')}</option>
                      <option value="custom">{t('settings.system.downloadPathCustom')}</option>
                    </select>
                  </div>

                  {localSettings.downloadPath === 'custom' && (
                    <div className="flex items-center gap-2 pl-4">
                      <input
                        type="text"
                        readOnly
                        value={localSettings.downloadCustomPath || ''}
                        className="flex-1 px-2 py-1 text-xs text-text border border-border rounded bg-bg-secondary"
                        placeholder={t('settings.system.downloadPathCustomPlaceholder')}
                      />
                      <button
                        onClick={async () => {
                          const selected = await open({
                            directory: true,
                            multiple: false,
                          });
                          if (selected) {
                            setLocalSettings({ ...localSettings, downloadCustomPath: selected as string });
                          }
                        }}
                        className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary-hover"
                      >
                        {t('settings.system.browse')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* データ管理 */}
            <section>
              <h3 className="text-sm font-semibold text-text mb-3">{t('settings.data.title')}</h3>
              <div className="flex justify-end">
                <button
                  onClick={handleResetClick}
                  className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  {t('settings.data.resetButton')}
                </button>
              </div>
            </section>
          </div>

          {/* フッター */}
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm text-text-sub hover:bg-hover rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={confirmType === 'logout' ? t('settings.account.logout') : t('settings.data.resetButton')}
        message={confirmType === 'logout' ? t('settings.account.logoutConfirm') : t('settings.data.resetConfirm')}
        confirmLabel={t('common.yes')}
        cancelLabel={t('common.no')}
        isDestructive={true}
        onConfirm={handleConfirm}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
}
