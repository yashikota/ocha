import { useAtom } from 'jotai';
import { useCallback } from 'react';
import { groupsAtom, selectedGroupIdAtom, unreadCountsAtom, groupMembersAtom } from '../atoms';
import * as tauri from './useTauri';

export function useGroups() {
  const [groups, setGroups] = useAtom(groupsAtom);
  const [selectedGroupId, setSelectedGroupId] = useAtom(selectedGroupIdAtom);
  const [unreadCounts, setUnreadCounts] = useAtom(unreadCountsAtom);
  const [groupMembers, setGroupMembers] = useAtom(groupMembersAtom);

  // グループ一覧を取得
  const fetchGroups = useCallback(async () => {
    const data = await tauri.getGroups();
    setGroups(data);
    return data;
  }, [setGroups]);

  // 未読数を取得
  const fetchUnreadCounts = useCallback(async () => {
    const counts = await tauri.getUnreadCounts();
    const countMap: Record<number, number> = {};
    for (const [groupId, count] of counts) {
      countMap[groupId] = count;
    }
    setUnreadCounts(countMap);
    return countMap;
  }, [setUnreadCounts]);

  // グループを選択
  const selectGroup = useCallback(async (groupId: number | null) => {
    setSelectedGroupId(groupId);
    
    // 選択したグループを既読にする
    if (groupId !== null) {
      await tauri.markGroupAsRead(groupId);
      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
    }
  }, [setSelectedGroupId, setUnreadCounts]);

  // グループを作成
  const createGroup = useCallback(async (name: string, avatarColor: string) => {
    const id = await tauri.createGroup(name, avatarColor);
    await fetchGroups();
    return id;
  }, [fetchGroups]);

  // グループを更新
  const updateGroup = useCallback(async (
    id: number,
    name: string,
    avatarColor: string,
    isPinned: boolean,
    notifyEnabled: boolean,
  ) => {
    await tauri.updateGroup(id, name, avatarColor, isPinned, notifyEnabled);
    await fetchGroups();
  }, [fetchGroups]);

  // グループを削除
  const deleteGroup = useCallback(async (id: number) => {
    await tauri.deleteGroup(id);
    if (selectedGroupId === id) {
      setSelectedGroupId(null);
    }
    await fetchGroups();
  }, [fetchGroups, selectedGroupId, setSelectedGroupId]);

  // グループメンバーを取得
  const fetchGroupMembers = useCallback(async (groupId: number) => {
    const members = await tauri.getGroupMembers(groupId);
    setGroupMembers((prev) => ({
      ...prev,
      [groupId]: members,
    }));
    return members;
  }, [setGroupMembers]);

  // グループにメールアドレスを追加
  const addEmailToGroup = useCallback(async (
    groupId: number,
    email: string,
    displayName?: string,
  ) => {
    await tauri.addEmailToGroup(groupId, email, displayName);
    await fetchGroupMembers(groupId);
  }, [fetchGroupMembers]);

  // グループからメールアドレスを削除
  const removeEmailFromGroup = useCallback(async (groupId: number, email: string) => {
    await tauri.removeEmailFromGroup(groupId, email);
    await fetchGroupMembers(groupId);
  }, [fetchGroupMembers]);

  return {
    groups,
    selectedGroupId,
    unreadCounts,
    groupMembers,
    fetchGroups,
    fetchUnreadCounts,
    selectGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    fetchGroupMembers,
    addEmailToGroup,
    removeEmailFromGroup,
  };
}

