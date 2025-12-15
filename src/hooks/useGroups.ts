import { useAtom } from 'jotai';
import { useCallback } from 'react';
import { groupsAtom, selectedGroupIdAtom, unreadCountsAtom, groupMembersAtom, tabsAtom, settingsAtom } from '../atoms';
import * as tauri from './useTauri';
import type { Group } from '../types';

export function useGroups() {
  const [groups, setGroups] = useAtom(groupsAtom);
  const [selectedGroupId, setSelectedGroupId] = useAtom(selectedGroupIdAtom);
  const [unreadCounts, setUnreadCounts] = useAtom(unreadCountsAtom);
  const [groupMembers, setGroupMembers] = useAtom(groupMembersAtom);
  const [tabs, setTabs] = useAtom(tabsAtom);
  const [settings] = useAtom(settingsAtom);

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

    // 選択したグループを既読にする処理
    if (groupId !== null) {
      await tauri.markGroupAsRead(groupId);
      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
    }
  }, [setSelectedGroupId, setUnreadCounts, settings.autoMarkAsRead]);

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
    isHidden: boolean,
    tabId?: number | null,
  ) => {
    await tauri.updateGroup(id, name, avatarColor, isPinned, notifyEnabled, isHidden, tabId);
    await fetchGroups();
  }, [fetchGroups]);

  // グループの非表示/表示を切り替え
  const toggleHideGroup = useCallback(async (group: Group) => {
    await updateGroup(
      group.id,
      group.name,
      group.avatarColor,
      group.isPinned,
      group.notifyEnabled,
      !group.isHidden
    );
  }, [updateGroup]);

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

  // タブ一覧を取得
  const fetchTabs = useCallback(async () => {
    const data = await tauri.getTabs();
    setTabs(data);
    return data;
  }, [setTabs]);

  // タブを作成
  const createTab = useCallback(async (name: string) => {
    const id = await tauri.createTab(name);
    await fetchTabs();
    return id;
  }, [fetchTabs]);

  // タブを更新
  const updateTab = useCallback(async (id: number, name: string) => {
    await tauri.updateTab(id, name);
    await fetchTabs();
  }, [fetchTabs]);

  // タブを削除
  const deleteTab = useCallback(async (id: number) => {
    await tauri.deleteTab(id);
    await fetchTabs();
    // 削除されたタブに属していたグループのリロードも必要かも（ON DELETE SET NULLなのでtabIdが変わる）
    await fetchGroups();
  }, [fetchTabs, fetchGroups]);

  // タブの順序を更新
  const reorderTabs = useCallback(async (orders: [number, number][]) => {
    // 楽観的UI更新
    setTabs(prev => {
      const next = [...prev];
      orders.forEach(([id, order]) => {
        const tab = next.find(t => t.id === id);
        if (tab) tab.sortOrder = order;
      });
      return next.sort((a, b) => a.sortOrder - b.sortOrder);
    });

    await tauri.updateTabOrders(orders);
    await fetchTabs();
  }, [setTabs, fetchTabs]);

  // グループをタブに移動
  const assignGroupToTab = useCallback(async (group: Group, tabId: number | null) => {
    await updateGroup(
      group.id,
      group.name,
      group.avatarColor,
      group.isPinned,
      group.notifyEnabled,
      group.isHidden, // タブ移動は非表示状態を維持するか？ hiddenタブは特別扱いなので、カスタムタブに入れるなら非表示解除すべきか？
      // "Main" or Custom Tab -> isHidden = false
      // "Hidden" Tab -> isHidden = true
      // 今回の要件ではカスタムタブとMainは同列。Hiddenは別。
      // tabIdを指定して更新
    );
    // updateGroupのシグネチャがまだtabIdを受け取っていないため、ここでupdateGroupを呼ぶときにtabIdを渡せるようにする必要がある。
    // 先ほどのmulti_replaceでupdateGroupの引数を増やしたはずだが、useGroups内のupdateGroupも更新する必要がある。
    await tauri.updateGroup(
      group.id,
      group.name,
      group.avatarColor,
      group.isPinned,
      group.notifyEnabled,
      group.isHidden,
      tabId
    );
    await fetchGroups();
  }, [fetchGroups]);

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
    toggleHideGroup,
    deleteGroup,
    fetchGroupMembers,
    addEmailToGroup,
    removeEmailFromGroup,
    tabs,
    fetchTabs,
    createTab,
    updateTab,
    deleteTab,
    reorderTabs,
    assignGroupToTab,
  };
}
