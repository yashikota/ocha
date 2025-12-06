import { UnreadBadge } from './UnreadBadge';
import type { Group } from '../../types';

interface GroupItemProps {
  group: Group;
  isSelected: boolean;
  unreadCount: number;
  onClick: () => void;
}

export function GroupItem({ group, isSelected, unreadCount, onClick }: GroupItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
        isSelected ? 'bg-selected' : 'hover:bg-hover'
      }`}
    >
      {/* アイコン */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>

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
