import { atom } from 'jotai';
import type { Settings } from '../types';

// 設定
export const settingsAtom = atom<Settings>({
  notificationsEnabled: true,
  soundEnabled: true,
  syncIntervalMinutes: 5,
  launchAtLogin: false,
  minimizeToTray: true,
  downloadPath: 'downloads',
  downloadCustomPath: null,
});
