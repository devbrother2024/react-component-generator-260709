import type { GeneratedComponent } from '../types';

const STORAGE_KEY = 'rcg:components';
const MAX_ITEMS = 20;

export function loadComponents(): GeneratedComponent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.slice(0, MAX_ITEMS).map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
    }));
  } catch {
    return [];
  }
}

export function saveComponents(components: GeneratedComponent[]): void {
  try {
    const trimmed = components.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage 사용 불가·용량 초과 등은 무시 (앱 크래시 방지)
  }
}
