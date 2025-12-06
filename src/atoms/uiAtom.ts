import { atom } from 'jotai';

// 設定モーダルの表示状態
export const settingsModalOpenAtom = atom<boolean>(false);

// グループ編集モーダルの表示状態
export const groupEditorOpenAtom = atom<boolean>(false);

// 編集中のグループID（null = 新規作成）
export const editingGroupIdAtom = atom<number | null>(null);

// 同期中かどうか
export const syncingAtom = atom<boolean>(false);

// エラーメッセージ
export const errorMessageAtom = atom<string | null>(null);

// 成功メッセージ
export const successMessageAtom = atom<string | null>(null);

