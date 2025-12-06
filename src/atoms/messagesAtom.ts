import { atom } from 'jotai';
import type { Message } from '../types';

// メッセージ一覧
export const messagesAtom = atom<Message[]>([]);

// ローディング状態
export const messagesLoadingAtom = atom<boolean>(false);

// グループIDでフィルタリングしたメッセージ
export const messagesByGroupAtom = atom((get) => {
  const messages = get(messagesAtom);
  
  // グループIDでグループ化
  const byGroup: Record<number, Message[]> = {};
  for (const message of messages) {
    if (!byGroup[message.groupId]) {
      byGroup[message.groupId] = [];
    }
    byGroup[message.groupId].push(message);
  }
  
  // 各グループ内で日時順にソート
  for (const groupId in byGroup) {
    byGroup[groupId].sort(
      (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
    );
  }
  
  return byGroup;
});

