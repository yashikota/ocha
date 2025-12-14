import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { getVersion } from '@tauri-apps/api/app';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { GroupItem } from './GroupItem';
import { useGroups } from '../../hooks/useGroups';
import { settingsModalOpenAtom } from '../../atoms/uiAtom';
import { mergeGroups, getGroups } from '../../hooks/useTauri';
import { groupsAtom } from '../../atoms/groupsAtom';
import type { Group } from '../../types';
import { ConfirmDialog } from '../UI';

interface SidebarProps {
  onRefresh?: () => void;
}

export function Sidebar({ onRefresh }: SidebarProps) {
  const { t } = useTranslation();
  const {
    groups,
    selectedGroupId,
    unreadCounts,
    fetchGroups,
    fetchUnreadCounts,
    selectGroup,
  } = useGroups();
  const [, setSettingsOpen] = useAtom(settingsModalOpenAtom);
  const [, setGroups] = useAtom(groupsAtom);

  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<{ source: Group; target: Group } | null>(null);
  const [version, setVersion] = useState<string>('');

  const isDev = import.meta.env.DEV;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchGroups();
    fetchUnreadCounts();
  }, [fetchGroups, fetchUnreadCounts]);

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const group = groups.find(g => g.id === active.id);
    if (group) {
      setActiveGroup(group);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveGroup(null);

    if (!over || active.id === over.id || merging) return;

    const sourceGroup = groups.find(g => g.id === active.id);
    const targetGroup = groups.find(g => g.id === over.id);

    if (!sourceGroup || !targetGroup) return;

    if (!sourceGroup || !targetGroup) return;

    // 確認ダイアログを表示
    setMergeTarget({ source: sourceGroup, target: targetGroup });
  };

  const handleDragCancel = () => {
    setActiveGroup(null);
  };

  return (
    <aside className="w-64 h-full bg-bg-sidebar border-r border-border flex flex-col">
      {/* ヘッダー */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xl">🍵</span>
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold text-text">{t('app.name')}</h1>
            {version && (
              <span className="text-xs text-text-sub">v{version}</span>
            )}
            {isDev && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded">
                DEV
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg hover:bg-hover transition-colors"
              aria-label={t('common.refresh')}
              title={t('common.refresh')}
            >
              <svg className="w-5 h-5 text-text-sub" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg hover:bg-hover transition-colors"
            aria-label={t('settings.title')}
          >
            <svg className="w-5 h-5 text-text-sub" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* グループセクション */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="px-2 py-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-text-sub uppercase tracking-wide">
            {t('sidebar.groups')}
          </span>
          {activeGroup && (
            <span className="text-xs text-primary font-medium animate-pulse">
              {t('sidebar.dropToMerge')}
            </span>
          )}
        </div>

        {groups.length === 0 ? (
          <p className="px-3 py-4 text-sm text-text-sub text-center">
            {t('sidebar.noGroups')}
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <nav className="space-y-1">
              {groups.map((group) => (
                <GroupItem
                  key={group.id}
                  group={group}
                  isSelected={selectedGroupId === group.id}
                  unreadCount={unreadCounts[group.id] || 0}
                  onClick={() => selectGroup(group.id)}
                />
              ))}
            </nav>

            <DragOverlay dropAnimation={{
              duration: 200,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}>
              {activeGroup ? (
                <GroupItem
                  group={activeGroup}
                  isSelected={false}
                  unreadCount={unreadCounts[activeGroup.id] || 0}
                  onClick={() => { }}
                  isOverlay
                />
              ) : null}
          </DndContext>
        )}
      </div>

      {mergeTarget && (
        <ConfirmDialog
          isOpen={true}
          title={t('sidebar.mergeTitle')}
          message={t('sidebar.mergeConfirm', {
            source: mergeTarget.source.name,
            target: mergeTarget.target.name,
          })}
          onConfirm={async () => {
            const { source, target } = mergeTarget;
            setMergeTarget(null);
            setMerging(true);
            try {
              await mergeGroups(target.id, source.id);
              const updatedGroups = await getGroups();
              setGroups(updatedGroups);
              await fetchUnreadCounts();
              selectGroup(target.id);
            } catch (error) {
              console.error('Failed to merge groups:', error);
            } finally {
              setMerging(false);
            }
          }}
          onCancel={() => setMergeTarget(null)}
        />
      )}
    </aside>
  );
}
