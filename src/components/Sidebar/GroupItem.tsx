import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { UnreadBadge } from './UnreadBadge';
import { ContextMenu } from './ContextMenu';
import type { Group } from '../../types';
import { useGroups } from '../../hooks/useGroups';

interface GroupItemProps {
  group: Group;
  isSelected: boolean;
  unreadCount: number;
  onClick: () => void;
  isOverlay?: boolean;
}

export function GroupItem({
  group,
  isSelected,
  unreadCount,
  onClick,
  isOverlay = false,
}: GroupItemProps) {
  const { t } = useTranslation();
  const { toggleHideGroup } = useGroups();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: group.id,
    data: { group },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: group.id,
    data: { group },
  });

  // ドラッグ中のオーバーレイ表示
  if (isOverlay) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-2xl ring-2 ring-primary min-w-[200px] rotate-2">
        <img src="./icon.png" alt="" className="w-8 h-8 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text truncate">{group.name}</div>
        </div>
        {group.isPinned && (
          <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        )}
      </div>
    );
  }

  // 両方のrefを組み合わせる
  const setRefs = (node: HTMLDivElement | null) => {
    setDraggableRef(node);
    setDroppableRef(node);
  };

  const showDropTarget = isOver && !isDragging;

  return (
    <div
      ref={setRefs}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      className={`
        relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
        cursor-grab active:cursor-grabbing select-none
        transition-colors duration-150
        ${isDragging ? 'opacity-40 bg-gray-100' : ''}
        ${showDropTarget ? 'bg-green-100 ring-2 ring-green-500' : ''}
        ${isSelected && !isDragging && !showDropTarget ? 'bg-selected' : ''}
        ${!isSelected && !isDragging && !showDropTarget ? 'hover:bg-hover' : ''}
      `}
    >
      {/* ドロップターゲット表示 */}
      {showDropTarget && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none z-10 bg-green-500/10">
          <div className="flex items-center gap-2 text-green-600 font-bold text-sm bg-white px-3 py-1.5 rounded-full shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {t('sidebar.mergeHere')}
          </div>
        </div>
      )}

      {/* アイコン */}
      <img
        src="./icon.png"
        alt=""
        className={`w-7 h-7 flex-shrink-0 transition-opacity ${showDropTarget ? 'opacity-40' : ''}`}
      />

      <div className={`flex-1 min-w-0 transition-opacity ${showDropTarget ? 'opacity-40' : ''}`}>
        <div className={`truncate text-sm ${unreadCount > 0 ? 'font-semibold text-text' : 'text-text'}`}>
          {group.name}
        </div>
      </div>

      <div className={`flex items-center gap-2 transition-opacity ${showDropTarget ? 'opacity-40' : ''}`}>
        {group.isPinned && (
          <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        )}
        <UnreadBadge count={unreadCount} />
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: group.isHidden ? t('sidebar.restoreGroup') : t('sidebar.hideGroup'),
              onClick: () => toggleHideGroup(group),
            },
          ]}
        />
      )}
    </div>
  );
}
