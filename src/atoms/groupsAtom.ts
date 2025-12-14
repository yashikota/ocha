import { atom } from 'jotai';
import type { Group, GroupMember } from '../types';

// グループ一覧
export const groupsAtom = atom<Group[]>([]);

// タブ一覧
export const tabsAtom = atom<import('../types').Tab[]>([]);

// 選択中のグループID
export const selectedGroupIdAtom = atom<number | null>(null);

// グループメンバー（グループIDをキーとしたマップ）
export const groupMembersAtom = atom<Record<number, GroupMember[]>>({});

// 未読数（グループIDをキーとしたマップ）
export const unreadCountsAtom = atom<Record<number, number>>({});

// 選択中のグループ
export const selectedGroupAtom = atom((get) => {
  const groups = get(groupsAtom);
  const id = get(selectedGroupIdAtom);
  return groups.find((g) => g.id === id) ?? null;
});

// グループを最新メール順でソート
export const sortedGroupsAtom = atom((get) => {
  const groups = get(groupsAtom);
  const unreadCounts = get(unreadCountsAtom);

  return [...groups].sort((a, b) => {
    // ピン留めされたグループを優先
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // 未読があるグループを優先
    const aUnread = unreadCounts[a.id] || 0;
    const bUnread = unreadCounts[b.id] || 0;
    if (aUnread > 0 && bUnread === 0) return -1;
    if (aUnread === 0 && bUnread > 0) return 1;

    // 作成日時で降順ソート
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});
