import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';

export function LoginScreen() {
  const { t } = useTranslation();
  const { authState, saveConfig, startLogin } = useAuth();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) {
      setError(t('auth.errors.configRequired'));
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await saveConfig(clientId.trim(), clientSecret.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errors.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await startLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errors.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <span className="text-3xl">🍵</span>
          </div>
          <h1 className="text-2xl font-bold text-text">{t('app.name')}</h1>
          <p className="text-text-sub mt-2">{t('app.description')}</p>
        </div>

        {/* カード */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-border">
          {authState === 'needs_config' ? (
            <>
              <h2 className="text-lg font-semibold text-text mb-4">{t('auth.config.title')}</h2>
              <p className="text-sm text-text-sub mb-6">{t('auth.config.description')}</p>
              
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div>
                  <label htmlFor="clientId" className="block text-sm font-medium text-text mb-1">
                    {t('auth.config.clientId')}
                  </label>
                  <input
                    id="clientId"
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={t('auth.config.clientIdPlaceholder')}
                  />
                </div>
                
                <div>
                  <label htmlFor="clientSecret" className="block text-sm font-medium text-text mb-1">
                    {t('auth.config.clientSecret')}
                  </label>
                  <input
                    id="clientSecret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={t('auth.config.clientSecretPlaceholder')}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('auth.config.saving') : t('auth.config.saveButton')}
                </button>
              </form>

              <div className="mt-6 p-4 bg-bg-sidebar rounded-lg">
                <h3 className="text-sm font-medium text-text mb-2">{t('auth.config.setupGuide.title')}</h3>
                <ol className="text-xs text-text-sub space-y-1 list-decimal list-inside">
                  <li>{t('auth.config.setupGuide.step1')}</li>
                  <li>{t('auth.config.setupGuide.step2')}</li>
                  <li>{t('auth.config.setupGuide.step3')}</li>
                  <li>{t('auth.config.setupGuide.step4')}</li>
                  <li>{t('auth.config.setupGuide.step5')}</li>
                  <li>{t('auth.config.setupGuide.step6')}</li>
                </ol>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-text mb-4">{t('auth.login.title')}</h2>
              <p className="text-sm text-text-sub mb-6">{t('auth.login.description')}</p>

              {error && (
                <p className="text-sm text-red-600 mb-4">{error}</p>
              )}

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t('auth.login.loading')}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                    </svg>
                    <span>{t('auth.login.button')}</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
