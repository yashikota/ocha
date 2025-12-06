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
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
        isSelected ? 'bg-selected' : 'hover:bg-hover'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className={`truncate text-sm ${unreadCount > 0 ? 'font-semibold text-text' : 'text-text'}`}>
          {group.name}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {group.isPinned && (
          <svg className="w-4 h-4 text-text-sub" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        )}
        <UnreadBadge count={unreadCount} />
      </div>
    </button>
  );
}
