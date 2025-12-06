import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { groupEditorOpenAtom, editingGroupIdAtom } from '../../atoms/uiAtom';
import type { Group } from '../../types';

interface ChatHeaderProps {
  group: Group;
  onSync?: () => void;
  syncing?: boolean;
}

export function ChatHeader({ group, onSync, syncing }: ChatHeaderProps) {
  const { t } = useTranslation();
  const [, setGroupEditorOpen] = useAtom(groupEditorOpenAtom);
  const [, setEditingGroupId] = useAtom(editingGroupIdAtom);

  const handleEdit = () => {
    setEditingGroupId(group.id);
    setGroupEditorOpen(true);
  };

  return (
    <header className="h-14 px-4 border-b border-border flex items-center justify-between bg-white">
      <div className="flex items-center gap-3">
        <img src="/icon.png" alt="" className="w-8 h-8" />
        <h2 className="font-semibold text-text">{group.name}</h2>
      </div>

      <div className="flex items-center gap-1">
        {/* グループ編集ボタン */}
        <button
          onClick={handleEdit}
          className="p-2 rounded-lg hover:bg-hover transition-colors"
          title={t('groupEdit.title')}
        >
          <svg
            className="w-5 h-5 text-text-sub"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>

        {/* 同期ボタン */}
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
