import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { settingsModalOpenAtom } from '../../atoms/uiAtom';
import { settingsAtom } from '../../atoms/settingsAtom';
import { accountAtom } from '../../atoms/authAtom';
import { useAuth } from '../../hooks/useAuth';
import { getSettings, updateSettings, resetMessages } from '../../hooks/useTauri';
import type { Settings } from '../../types';

export function SettingsModal() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useAtom(settingsModalOpenAtom);
  const [settings, setSettings] = useAtom(settingsAtom);
  const [account] = useAtom(accountAtom);
  const { logout } = useAuth();

  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getSettings().then(setLocalSettings).catch(console.error);
    }
  }, [isOpen]);

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

  const handleLogout = async () => {
    if (window.confirm(t('settings.account.logoutConfirm'))) {
      await logout();
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
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
            <svg className="w-5 h-5 text-text-sub" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
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
                  onClick={handleLogout}
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
            </div>
          </section>

          {/* データ管理 */}
          <section>
            <h3 className="text-sm font-semibold text-text mb-3">{t('settings.data.title')}</h3>
            <div className="flex justify-end">
              <button
                onClick={async () => {
                  if (window.confirm(t('settings.data.resetConfirm'))) {
                    try {
                      await resetMessages();
                      alert(t('settings.data.resetSuccess'));
                      window.location.reload();
                    } catch (error) {
                      console.error('Failed to reset messages:', error);
                      alert(t('settings.data.resetError'));
                    }
                  }
                }}
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
  );
}
