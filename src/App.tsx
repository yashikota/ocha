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
          <span className="text-2xl animate-spin">🔄</span>
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
