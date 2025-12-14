import { useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { messagesAtom, messagesLoadingAtom } from '../atoms';
import { selectedGroupIdAtom } from '../atoms/groupsAtom';
import * as tauri from './useTauri';

export function useMessages() {
  const [messages, setMessages] = useAtom(messagesAtom);
  const [loading, setLoading] = useAtom(messagesLoadingAtom);
  const [selectedGroupId] = useAtom(selectedGroupIdAtom);

  // メッセージを取得
  const fetchMessages = useCallback(async (groupId: number) => {
    setLoading(true);
    try {
      const data = await tauri.getMessages(groupId);
      setMessages(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, [setMessages, setLoading]);

  // メールを同期
  const syncMessages = useCallback(async () => {
    setLoading(true);
    try {
      const newMessages = await tauri.syncMessages();

      // 現在選択中のグループのメッセージを更新
      if (selectedGroupId !== null) {
        const groupMessages = newMessages.filter((m) => m.groupId === selectedGroupId);
        if (groupMessages.length > 0) {
          setMessages((prev) => [...prev, ...groupMessages]);
        }
      }

      return newMessages;
    } finally {
      setLoading(false);
    }
  }, [setMessages, setLoading, selectedGroupId]);

  // メッセージを既読にする
  const markAsRead = useCallback(async (messageId: number) => {
    await tauri.markAsRead(messageId);
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isRead: true } : m))
    );
  }, [setMessages]);

  // IMAP監視を開始
  const startWatching = useCallback(async () => {
    await tauri.startIdleWatch();
  }, []);

  // IMAP監視を停止
  const stopWatching = useCallback(async () => {
    await tauri.stopIdleWatch();
  }, []);

  // 添付ファイルのlocalPathを更新
  const updateAttachmentPath = useCallback((attachmentId: number, localPath: string) => {
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        attachments: m.attachments.map((a) =>
          a.id === attachmentId ? { ...a, localPath } : a
        ),
      }))
    );
  }, [setMessages]);

  // 新着メールイベントをリッスン
  useEffect(() => {
    const unlisten = listen<number>('new-messages', async (_event) => {
      // 新着メールが来たら現在のグループのメッセージを再取得
      if (selectedGroupId !== null) {
        await fetchMessages(selectedGroupId);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [selectedGroupId, fetchMessages]);

  // 選択中のグループが変わったらメッセージを取得
  useEffect(() => {
    if (selectedGroupId !== null) {
      fetchMessages(selectedGroupId);
    } else {
      setMessages([]);
    }
  }, [selectedGroupId, fetchMessages, setMessages]);

  // ブックマークの切り替え
  const toggleBookmark = useCallback(async (messageId: number) => {
    try {
      await tauri.toggleMessageBookmark(messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, isBookmarked: !m.isBookmarked } : m
        )
      );
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  }, [setMessages]);

  return {
    messages,
    loading,
    fetchMessages,
    syncMessages,
    markAsRead,
    startWatching,
    stopWatching,
    updateAttachmentPath,
    toggleBookmark,
  };
}
