import { useTranslation } from 'react-i18next';
import { LoginScreen } from './components/Auth';
import { AppLayout } from './components/Layout';
import { useAuth } from './hooks/useAuth';

function App() {
  const { t } = useTranslation();
  const { authState } = useAuth();

  // ローディング中
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-sub">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  // 認証が必要
  if (authState === 'needs_config' || authState === 'unauthenticated') {
    return <LoginScreen />;
  }

  // 認証済み
  return <AppLayout />;
}

export default App;
