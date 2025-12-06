import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { groupEditorOpenAtom, editingGroupIdAtom } from '../../atoms/uiAtom';
import { groupsAtom, selectedGroupIdAtom } from '../../atoms/groupsAtom';
import {
  getGroup,
  getGroups,
  getGroupMembers,
  updateGroup,
  splitGroup,
  deleteGroup,
} from '../../hooks/useTauri';
import type { Group, GroupMember } from '../../types';

export function GroupEditModal() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useAtom(groupEditorOpenAtom);
  const [editingGroupId, setEditingGroupId] = useAtom(editingGroupIdAtom);
  const [, setGroups] = useAtom(groupsAtom);
  const [, setSelectedGroupId] = useAtom(selectedGroupIdAtom);

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [name, setName] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [newGroupName, setNewGroupName] = useState('');
  const [saving, setSaving] = useState(false);
  const [splitting, setSplitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!editingGroupId) return;

    try {
      const [groupData, membersData] = await Promise.all([
        getGroup(editingGroupId),
        getGroupMembers(editingGroupId),
      ]);

      if (groupData) {
        setGroup(groupData);
        setName(groupData.name);
        setIsPinned(groupData.isPinned);
        setNotifyEnabled(groupData.notifyEnabled);
      }
      setMembers(membersData);
    } catch (error) {
      console.error('Failed to load group data:', error);
    }
  }, [editingGroupId]);

  useEffect(() => {
    if (isOpen && editingGroupId) {
      loadData();
      setSelectedEmails(new Set());
      setNewGroupName('');
    }
  }, [isOpen, editingGroupId, loadData]);

  const handleClose = () => {
    setIsOpen(false);
    setEditingGroupId(null);
    setGroup(null);
    setMembers([]);
    setSelectedEmails(new Set());
    setNewGroupName('');
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

  const toggleEmailSelection = (email: string) => {
    const newSelection = new Set(selectedEmails);
    if (newSelection.has(email)) {
      newSelection.delete(email);
    } else {
      newSelection.add(email);
    }
    setSelectedEmails(newSelection);
  };

  const handleSplit = async () => {
    if (!group || selectedEmails.size === 0 || !newGroupName.trim()) return;

    // 全てのメールアドレスを選択した場合は分割できない
    if (selectedEmails.size === members.length) {
      alert(t('groupEdit.cannotSplitAll'));
      return;
    }

    const confirmMessage = t('groupEdit.splitConfirm', {
      count: selectedEmails.size,
      newGroup: newGroupName,
    });

    if (!window.confirm(confirmMessage)) return;

    setSplitting(true);
    try {
      const newGroupId = await splitGroup(group.id, Array.from(selectedEmails), newGroupName);
      const updatedGroups = await getGroups();
      setGroups(updatedGroups);
      // 新しいグループを選択
      setSelectedGroupId(newGroupId);
      handleClose();
    } catch (error) {
      console.error('Failed to split group:', error);
    } finally {
      setSplitting(false);
    }
  };

  const handleDelete = async () => {
    if (!group) return;

    if (!window.confirm(t('groupEdit.deleteConfirm', { name: group.name }))) return;

    try {
      await deleteGroup(group.id);
      const updatedGroups = await getGroups();
      setGroups(updatedGroups);
      setSelectedGroupId(null);
      handleClose();
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  if (!isOpen || !group) return null;

  const canSplit = selectedEmails.size > 0 && selectedEmails.size < members.length && newGroupName.trim();

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

          {/* グループ分割 */}
          {members.length > 1 && (
            <section>
              <h3 className="text-sm font-semibold text-text mb-3">{t('groupEdit.split')}</h3>
              <p className="text-xs text-text-sub mb-3">{t('groupEdit.splitDescription')}</p>
              
              {/* メールアドレス選択 */}
              <div className="bg-bg rounded-lg p-3 max-h-40 overflow-y-auto mb-3">
                <ul className="space-y-1">
                  {members.map((member) => (
                    <li key={member.id}>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-hover rounded p-1">
                        <input
                          type="checkbox"
                          checked={selectedEmails.has(member.email)}
                          onChange={() => toggleEmailSelection(member.email)}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <svg className="w-4 h-4 text-text-sub flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                        <span className="text-sm text-text truncate">{member.email}</span>
                        {member.displayName && (
                          <span className="text-xs text-text-sub">({member.displayName})</span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 新しいグループ名 */}
              {selectedEmails.size > 0 && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder={t('groupEdit.newGroupNamePlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={handleSplit}
                    disabled={!canSplit || splitting}
                    className="w-full px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {splitting ? t('common.loading') : t('groupEdit.splitButton', { count: selectedEmails.size })}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* メールアドレス一覧（分割不可の場合のみ表示） */}
          {members.length === 1 && (
            <section>
              <h3 className="text-sm font-semibold text-text mb-3">
                {t('groupEdit.members')} ({members.length})
              </h3>
              <div className="bg-bg rounded-lg p-3">
                <div className="text-sm text-text flex items-center gap-2">
                  <svg className="w-4 h-4 text-text-sub flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  <span className="truncate">{members[0].email}</span>
                </div>
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
