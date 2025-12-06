import { useState } from 'react';
import { UnreadBadge } from './UnreadBadge';
import type { Group } from '../../types';

interface GroupItemProps {
  group: Group;
  isSelected: boolean;
  unreadCount: number;
  onClick: () => void;
  onDragStart: (groupId: number) => void;
  onDragEnd: () => void;
  onDrop: (targetGroupId: number) => void;
  isDragging: boolean;
  dragOverGroupId: number | null;
}

export function GroupItem({
  group,
  isSelected,
  unreadCount,
  onClick,
  onDragStart,
  onDragEnd,
  onDrop,
  isDragging,
  dragOverGroupId,
}: GroupItemProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', group.id.toString());
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(group.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const sourceGroupId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceGroupId !== group.id) {
      onDrop(group.id);
    }
  };

  const isDropTarget = isDragging && dragOverGroupId !== group.id && isDragOver;

  return (
    <button
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left cursor-grab active:cursor-grabbing ${
        isSelected ? 'bg-selected' : 'hover:bg-hover'
      } ${isDragging && dragOverGroupId === group.id ? 'opacity-50' : ''} ${
        isDropTarget ? 'ring-2 ring-primary ring-offset-2 bg-primary/10' : ''
      }`}
    >
      {/* アイコン */}
      <img src="./icon.png" alt="" className="w-7 h-7 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className={`truncate text-sm ${unreadCount > 0 ? 'font-semibold text-text' : 'text-text'}`}>
          {group.name}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {group.isPinned && (
          <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        )}
        <UnreadBadge count={unreadCount} />
      </div>
    </button>
  );
}
