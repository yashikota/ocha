import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom, useSetAtom } from 'jotai';
import { SearchModal } from './SearchModal';
import { useGroups } from '../../hooks/useGroups';
import { groupEditorOpenAtom, editingGroupIdAtom, targetMessageIdAtom } from '../../atoms/uiAtom';
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

  const { selectGroup } = useGroups();
  const setTargetMessageId = useSetAtom(targetMessageIdAtom);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleEdit = () => {
    setEditingGroupId(group.id);
    setGroupEditorOpen(true);
  };

  const handleJump = (groupId: number, messageId: number) => {
    selectGroup(groupId);
    setTargetMessageId(messageId);
  };

  return (
    <>
      <header className="h-14 px-4 border-b border-border flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <img src="/icon.png" alt="" className="w-8 h-8" />
          <h2 className="font-semibold text-text">{group.name}</h2>
        </div>

        <div className="flex-1 flex justify-end items-center gap-1">
          {/* グループ内検索ボタン */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 rounded-lg hover:bg-hover transition-colors"
            title={t('search.localTitle', 'グループ内検索')}
          >
            <span className="text-xl">🔍</span>
          </button>

          {/* グループ編集ボタン */}
          <button
            onClick={handleEdit}
            className="p-2 rounded-lg hover:bg-hover transition-colors"
            title={t('groupEdit.title')}
          >
            <span className="text-xl">✏️</span>
          </button>

          {/* 同期ボタン */}
          <button
            onClick={onSync}
            disabled={syncing}
            className="p-2 rounded-lg hover:bg-hover transition-colors disabled:opacity-50"
            title={t('sync.syncNow')}
          >
            <span className={`text-xl inline-block ${syncing ? 'animate-spin' : ''}`}>🔄</span>
          </button>
        </div>
      </header>
      {isSearchOpen && (
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          groupId={group.id}
          onJumpToMessage={handleJump}
        />
      )}
    </>
  );
}
