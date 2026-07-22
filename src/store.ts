// 工数管理 — localStorage 永続化ストア + アクション
// 同一ブラウザ内で「管理」「共有」両ビューが同じデータを共有。
// 別タブ間は 'storage' イベントで同期（本番の別端末共有は要バックエンド）。

import { useCallback, useEffect, useState } from 'react';
import { uid } from './util';
import type { PlannedWork, Store, TimeEntry, WorkKind, WorkType } from './types';

const KEY = 'kosu-store-v1';

const empty: Store = { projects: [], workTypes: [], entries: [], plans: [] };

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const s = JSON.parse(raw) as Store;
    return {
      projects: s.projects ?? [],
      workTypes: s.workTypes ?? [],
      entries: s.entries ?? [],
      plans: s.plans ?? [],
    };
  } catch {
    return empty;
  }
}

/** 作業種の既定3種を生成 */
function defaultWorkTypes(projectId: string): WorkType[] {
  return [
    { id: uid(), projectId, name: 'デザイン', kind: 'design', rate: null },
    { id: uid(), projectId, name: 'コーディング作業（難易度A）', kind: 'coding', rate: null },
    { id: uid(), projectId, name: 'コーディング作業（難易度B）', kind: 'coding', rate: null },
  ];
}

export interface StoreApi {
  store: Store;
  createProject: (name: string) => string;
  deleteProject: (id: string) => void;
  addWorkType: (projectId: string, name: string, kind: WorkKind) => void;
  setRate: (workTypeId: string, rate: number) => void;
  deleteWorkType: (id: string) => void;
  startTimer: (projectId: string, workTypeId: string) => void;
  stopTimer: (entryId: string) => void;
  updateEntry: (entryId: string, patch: Partial<Pick<TimeEntry, 'start' | 'end'>>) => void;
  addManualEntry: (projectId: string, workTypeId: string, start: number, end: number) => void;
  deleteEntry: (entryId: string) => void;
  addPlan: (projectId: string, month: string, title: string, workTypeId: string | null) => void;
  togglePlan: (id: string) => void;
  deletePlan: (id: string) => void;
  hasMeasurements: (workTypeId: string) => boolean;
}

export function useStore(): StoreApi {
  const [store, setStore] = useState<Store>(load);

  // 永続化
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(store));
  }, [store]);

  // 別タブ同期
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try {
          setStore(JSON.parse(e.newValue));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const createProject = useCallback((name: string) => {
    const id = uid();
    setStore((s) => ({
      ...s,
      projects: [...s.projects, { id, name: name.trim() || '無題プロジェクト', createdAt: Date.now() }],
      workTypes: [...s.workTypes, ...defaultWorkTypes(id)],
    }));
    return id;
  }, []);

  const deleteProject = useCallback((id: string) => {
    setStore((s) => ({
      ...s,
      projects: s.projects.filter((p) => p.id !== id),
      workTypes: s.workTypes.filter((w) => w.projectId !== id),
      entries: s.entries.filter((e) => e.projectId !== id),
      plans: s.plans.filter((p) => p.projectId !== id),
    }));
  }, []);

  const addWorkType = useCallback((projectId: string, name: string, kind: WorkKind) => {
    const n = name.trim();
    if (!n) return;
    setStore((s) => ({
      ...s,
      workTypes: [...s.workTypes, { id: uid(), projectId, name: n, kind, rate: null }],
    }));
  }, []);

  // 単価は未設定（null）のときのみ設定可。設定後は変更不可。
  const setRate = useCallback((workTypeId: string, rate: number) => {
    setStore((s) => ({
      ...s,
      workTypes: s.workTypes.map((w) =>
        w.id === workTypeId && w.kind === 'coding' && w.rate == null ? { ...w, rate } : w,
      ),
    }));
  }, []);

  // 計測済み（entries に存在）の作業種は削除不可。
  const deleteWorkType = useCallback((id: string) => {
    setStore((s) => {
      if (s.entries.some((e) => e.workTypeId === id)) return s;
      return { ...s, workTypes: s.workTypes.filter((w) => w.id !== id) };
    });
  }, []);

  const startTimer = useCallback((projectId: string, workTypeId: string) => {
    setStore((s) => {
      // 同一作業種で計測中が既にあれば二重開始しない
      if (s.entries.some((e) => e.projectId === projectId && e.workTypeId === workTypeId && e.end == null)) return s;
      const entry: TimeEntry = { id: uid(), projectId, workTypeId, start: Date.now(), end: null };
      return { ...s, entries: [...s.entries, entry] };
    });
  }, []);

  const stopTimer = useCallback((entryId: string) => {
    setStore((s) => ({
      ...s,
      entries: s.entries.map((e) => (e.id === entryId && e.end == null ? { ...e, end: Date.now() } : e)),
    }));
  }, []);

  const updateEntry = useCallback((entryId: string, patch: Partial<Pick<TimeEntry, 'start' | 'end'>>) => {
    setStore((s) => ({
      ...s,
      entries: s.entries.map((e) => (e.id === entryId ? { ...e, ...patch, manual: true } : e)),
    }));
  }, []);

  const addManualEntry = useCallback(
    (projectId: string, workTypeId: string, start: number, end: number) => {
      setStore((s) => ({
        ...s,
        entries: [...s.entries, { id: uid(), projectId, workTypeId, start, end, manual: true }],
      }));
    },
    [],
  );

  const deleteEntry = useCallback((entryId: string) => {
    setStore((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== entryId) }));
  }, []);

  const addPlan = useCallback((projectId: string, month: string, title: string, workTypeId: string | null) => {
    const t = title.trim();
    if (!t) return;
    setStore((s) => ({
      ...s,
      plans: [...s.plans, { id: uid(), projectId, month, title: t, workTypeId, done: false } as PlannedWork],
    }));
  }, []);

  const togglePlan = useCallback((id: string) => {
    setStore((s) => ({ ...s, plans: s.plans.map((p) => (p.id === id ? { ...p, done: !p.done } : p)) }));
  }, []);

  const deletePlan = useCallback((id: string) => {
    setStore((s) => ({ ...s, plans: s.plans.filter((p) => p.id !== id) }));
  }, []);

  const hasMeasurements = useCallback((workTypeId: string) => store.entries.some((e) => e.workTypeId === workTypeId), [store.entries]);

  return {
    store,
    createProject,
    deleteProject,
    addWorkType,
    setRate,
    deleteWorkType,
    startTimer,
    stopTimer,
    updateEntry,
    addManualEntry,
    deleteEntry,
    addPlan,
    togglePlan,
    deletePlan,
    hasMeasurements,
  };
}

/** 計測中セッションの経過表示のため、一定間隔で現在時刻を返す */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs]);
  return now;
}
