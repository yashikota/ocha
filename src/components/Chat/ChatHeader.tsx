import { useTranslation } from 'react-i18next';
import type { Group } from '../../types';

interface ChatHeaderProps {
  group: Group;
  onSync?: () => void;
  syncing?: boolean;
}

export function ChatHeader({ group, onSync, syncing }: ChatHeaderProps) {
  const { t } = useTranslation();
  const initial = group.name.charAt(0).toUpperCase();

  return (
    <header className="h-14 px-4 border-b border-border flex items-center justify-between bg-white">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
          style={{ backgroundColor: group.avatarColor }}
        >
          {initial}
        </div>
        <div>
          <h2 className="font-semibold text-text">{group.name}</h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSync}
          disabled={syncing}
          className="p-2 rounded-lg hover:bg-hover transition-colors disabled:opacity-50"
          title={t('sync.syncNow')}
        >
          <svg
            className={`w-5 h-5 text-text-sub ${syncing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
