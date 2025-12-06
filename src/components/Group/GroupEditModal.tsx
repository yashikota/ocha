import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { groupEditorOpenAtom, editingGroupIdAtom } from '../../atoms/uiAtom';
import { groupsAtom } from '../../atoms/groupsAtom';
import {
  getGroup,
  getGroups,
  getGroupMembers,
  updateGroup,
  mergeGroups,
  deleteGroup,
} from '../../hooks/useTauri';
import type { Group, GroupMember } from '../../types';

export function GroupEditModal() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useAtom(groupEditorOpenAtom);
  const [editingGroupId, setEditingGroupId] = useAtom(editingGroupIdAtom);
  const [, setGroups] = useAtom(groupsAtom);

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [selectedMergeGroupId, setSelectedMergeGroupId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [merging, setMerging] = useState(false);

  const loadData = useCallback(async () => {
    if (!editingGroupId) return;

    try {
      const [groupData, membersData, groupsData] = await Promise.all([
        getGroup(editingGroupId),
        getGroupMembers(editingGroupId),
        getGroups(),
      ]);

      if (groupData) {
        setGroup(groupData);
        setName(groupData.name);
        setIsPinned(groupData.isPinned);
        setNotifyEnabled(groupData.notifyEnabled);
      }
      setMembers(membersData);
      // 現在のグループを除外
      setAllGroups(groupsData.filter(g => g.id !== editingGroupId));
    } catch (error) {
      console.error('Failed to load group data:', error);
    }
  }, [editingGroupId]);

  useEffect(() => {
    if (isOpen && editingGroupId) {
      loadData();
    }
  }, [isOpen, editingGroupId, loadData]);

  const handleClose = () => {
    setIsOpen(false);
    setEditingGroupId(null);
    setGroup(null);
    setMembers([]);
    setSelectedMergeGroupId(null);
  };

  const handleSave = async () => {
    if (!group) return;

    setSaving(true);
    try {
      await updateGroup(group.id, name, group.avatarColor, isPinned, notifyEnabled);
      const updatedGroups = await getGroups();
      setGroups(updatedGroups);
      handleClose();
    } catch (error) {
      console.error('Failed to update group:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleMerge = async () => {
    if (!group || !selectedMergeGroupId) return;

    const sourceGroup = allGroups.find(g => g.id === selectedMergeGroupId);
    if (!sourceGroup) return;

    const confirmMessage = t('groupEdit.mergeConfirm', {
      source: sourceGroup.name,
      target: group.name,
    });

    if (!window.confirm(confirmMessage)) return;

    setMerging(true);
    try {
      await mergeGroups(group.id, selectedMergeGroupId);
      // データを再読み込み
      await loadData();
      const updatedGroups = await getGroups();
      setGroups(updatedGroups);
      setSelectedMergeGroupId(null);
    } catch (error) {
      console.error('Failed to merge groups:', error);
    } finally {
      setMerging(false);
    }
  };

  const handleDelete = async () => {
    if (!group) return;

    if (!window.confirm(t('groupEdit.deleteConfirm', { name: group.name }))) return;

    try {
      await deleteGroup(group.id);
      const updatedGroups = await getGroups();
      setGroups(updatedGroups);
      handleClose();
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">{t('groupEdit.title')}</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-hover transition-colors"
            aria-label={t('common.close')}
          >
            <svg className="w-5 h-5 text-text-sub" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* グループ名 */}
          <section>
            <h3 className="text-sm font-semibold text-text mb-3">{t('groupEdit.name')}</h3>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </section>

          {/* オプション */}
          <section>
            <h3 className="text-sm font-semibold text-text mb-3">{t('groupEdit.options')}</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-text">{t('groupEdit.pin')}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyEnabled}
                  onChange={(e) => setNotifyEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-text">{t('groupEdit.notify')}</span>
              </label>
            </div>
          </section>

          {/* メールアドレス一覧 */}
          <section>
            <h3 className="text-sm font-semibold text-text mb-3">
              {t('groupEdit.members')} ({members.length})
            </h3>
            <div className="bg-bg rounded-lg p-3 max-h-32 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-sm text-text-sub">{t('groupEdit.noMembers')}</p>
              ) : (
                <ul className="space-y-1">
                  {members.map((member) => (
                    <li key={member.id} className="text-sm text-text flex items-center gap-2">
                      <svg className="w-4 h-4 text-text-sub flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                      <span className="truncate">{member.email}</span>
                      {member.displayName && (
                        <span className="text-text-sub">({member.displayName})</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* グループ統合 */}
          {allGroups.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-text mb-3">{t('groupEdit.merge')}</h3>
              <p className="text-xs text-text-sub mb-3">{t('groupEdit.mergeDescription')}</p>
              <div className="flex gap-2">
                <select
                  value={selectedMergeGroupId ?? ''}
                  onChange={(e) => setSelectedMergeGroupId(e.target.value ? Number(e.target.value) : null)}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">{t('groupEdit.selectGroup')}</option>
                  {allGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleMerge}
                  disabled={!selectedMergeGroupId || merging}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {merging ? t('common.loading') : t('groupEdit.mergeButton')}
                </button>
              </div>
            </section>
          )}

          {/* 削除 */}
          <section>
            <h3 className="text-sm font-semibold text-text mb-3">{t('groupEdit.dangerZone')}</h3>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-xs text-red-600 mb-3">{t('groupEdit.deleteWarning')}</p>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                {t('groupEdit.deleteButton')}
              </button>
            </div>
          </section>
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-text-sub hover:bg-hover rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
