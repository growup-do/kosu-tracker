// 工数管理 — Firestore 共有ストア（ログインなし）
// データモデル：collection 'projects' の各ドキュメント = 1プロジェクトの全状態
//   projects/{id} = { name, createdAt, workTypes[], entries[], plans[] }
// ログイン制限は上流の管理システム側で行うため、本アプリ自体は認証なし（URLを知っていれば利用可）。

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { uid } from './util';
import type { PlannedWork, Project, TimeEntry, WorkKind, WorkType } from './types';

/** Firebaseエラーを日本語メッセージに */
function fbErr(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('permission-denied'))
    return 'Firestore のルールで拒否されました。コンソールの Firestore「ルール」を公開（設定）してください。';
  if (code.includes('unavailable') || code.includes('network'))
    return '通信に失敗しました。ネットワーク環境をご確認ください。';
  return 'エラー: ' + ((e as Error)?.message ?? String(e));
}

/* ============ プロジェクト一覧 ============ */

function defaultWorkTypes(projectId: string): WorkType[] {
  return [
    { id: uid(), projectId, name: 'デザイン', kind: 'design', rate: null },
    { id: uid(), projectId, name: 'コーディング作業（難易度A）', kind: 'coding', rate: null },
    { id: uid(), projectId, name: 'コーディング作業（難易度B）', kind: 'coding', rate: null },
  ];
}

export interface ProjectListApi {
  projects: Project[];
  loading: boolean;
  error: string;
  createProject: (name: string) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
}

export function useProjectList(enabled: boolean): ProjectListApi {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    const unsub = onSnapshot(
      query(collection(db, 'projects')),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, name: d.data().name as string, createdAt: d.data().createdAt as number }))
          .sort((a, b) => a.createdAt - b.createdAt);
        setProjects(list);
        setLoading(false);
        setError('');
      },
      (err) => {
        setError(fbErr(err));
        setLoading(false);
      },
    );
    return unsub;
  }, [enabled]);

  const createProject = useCallback(async (name: string) => {
    const id = uid();
    try {
      await setDoc(doc(db, 'projects', id), {
        name: name.trim() || '無題プロジェクト',
        createdAt: Date.now(),
        workTypes: defaultWorkTypes(id),
        entries: [],
        plans: [],
      });
      setError('');
    } catch (e) {
      setError(fbErr(e));
      throw e;
    }
    return id;
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
    } catch (e) {
      setError(fbErr(e));
    }
  }, []);

  return { projects, loading, error, createProject, deleteProject };
}

/* ============ 単一プロジェクト（リアルタイム同期＋アクション） ============ */

interface ProjectDoc {
  name: string;
  createdAt: number;
  workTypes: WorkType[];
  entries: TimeEntry[];
  plans: PlannedWork[];
}

/** 画面（Admin/Client）が使うプロジェクト単位のAPI。store は当該プロジェクトのみを含む。 */
export interface StoreApi {
  store: { projects: Project[]; workTypes: WorkType[]; entries: TimeEntry[]; plans: PlannedWork[] };
  loading: boolean;
  exists: boolean;
  error: string;
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

export function useProjectStore(projectId: string): StoreApi {
  const [data, setData] = useState<ProjectDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(true);
  const [error, setError] = useState('');
  const dataRef = useRef<ProjectDoc | null>(null);
  dataRef.current = data;

  useEffect(() => {
    setLoading(true);
    const ref = doc(db, 'projects', projectId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as Partial<ProjectDoc>;
          setData({
            name: d.name ?? '',
            createdAt: d.createdAt ?? Date.now(),
            workTypes: d.workTypes ?? [],
            entries: d.entries ?? [],
            plans: d.plans ?? [],
          });
          setExists(true);
        } else {
          setData(null);
          setExists(false);
        }
        setLoading(false);
        setError('');
      },
      (err) => {
        setError(fbErr(err));
        setLoading(false);
      },
    );
    return unsub;
  }, [projectId]);

  // すべての書き込みはトランザクションで行う。
  // サーバー上の最新データを読んでから変更を適用するため、複数人が同時に操作しても
  // 「後の書き込みが先の書き込みを丸ごと上書きして記録が消える」（Lost Update）が起きない。
  // 競合時は Firestore が自動リトライする。ガード判定（二重開始・単価確定済み等）も最新データ側で行う。
  const mutate = useCallback(
    (fn: (d: ProjectDoc) => Partial<ProjectDoc> | null) => {
      const ref = doc(db, 'projects', projectId);
      runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return; // プロジェクトが削除済みなら何もしない
        const raw = snap.data() as Partial<ProjectDoc>;
        const d: ProjectDoc = {
          name: raw.name ?? '',
          createdAt: raw.createdAt ?? Date.now(),
          workTypes: raw.workTypes ?? [],
          entries: raw.entries ?? [],
          plans: raw.plans ?? [],
        };
        const fields = fn(d);
        if (fields) tx.update(ref, fields as Record<string, unknown>);
      }).catch((e) => setError(fbErr(e)));
    },
    [projectId],
  );

  const addWorkType = useCallback((_pid: string, name: string, kind: WorkKind) => {
    if (!name.trim()) return;
    mutate((d) => ({
      workTypes: [...d.workTypes, { id: uid(), projectId, name: name.trim(), kind, rate: null }],
    }));
  }, [projectId, mutate]);

  const setRate = useCallback((workTypeId: string, rate: number) => {
    mutate((d) => ({
      workTypes: d.workTypes.map((w) => (w.id === workTypeId && w.kind === 'coding' && w.rate == null ? { ...w, rate } : w)),
    }));
  }, [mutate]);

  const deleteWorkType = useCallback((id: string) => {
    mutate((d) => {
      if (d.entries.some((e) => e.workTypeId === id)) return null; // 計測済みは削除不可
      return { workTypes: d.workTypes.filter((w) => w.id !== id) };
    });
  }, [mutate]);

  const startTimer = useCallback((_pid: string, workTypeId: string) => {
    mutate((d) => {
      if (d.entries.some((e) => e.workTypeId === workTypeId && e.end == null)) return null; // 二重開始防止
      const entry: TimeEntry = { id: uid(), projectId, workTypeId, start: Date.now(), end: null };
      return { entries: [...d.entries, entry] };
    });
  }, [projectId, mutate]);

  const stopTimer = useCallback((entryId: string) => {
    mutate((d) => ({
      entries: d.entries.map((e) => (e.id === entryId && e.end == null ? { ...e, end: Date.now() } : e)),
    }));
  }, [mutate]);

  const updateEntry = useCallback((entryId: string, up: Partial<Pick<TimeEntry, 'start' | 'end'>>) => {
    mutate((d) => ({
      entries: d.entries.map((e) => (e.id === entryId ? { ...e, ...up, manual: true } : e)),
    }));
  }, [mutate]);

  const addManualEntry = useCallback((_pid: string, workTypeId: string, start: number, end: number) => {
    mutate((d) => ({
      entries: [...d.entries, { id: uid(), projectId, workTypeId, start, end, manual: true }],
    }));
  }, [projectId, mutate]);

  const deleteEntry = useCallback((entryId: string) => {
    mutate((d) => ({ entries: d.entries.filter((e) => e.id !== entryId) }));
  }, [mutate]);

  const addPlan = useCallback((_pid: string, month: string, title: string, workTypeId: string | null) => {
    if (!title.trim()) return;
    mutate((d) => {
      const plan: PlannedWork = { id: uid(), projectId, month, title: title.trim(), workTypeId, done: false };
      return { plans: [...d.plans, plan] };
    });
  }, [projectId, mutate]);

  const togglePlan = useCallback((id: string) => {
    mutate((d) => ({ plans: d.plans.map((p) => (p.id === id ? { ...p, done: !p.done } : p)) }));
  }, [mutate]);

  const deletePlan = useCallback((id: string) => {
    mutate((d) => ({ plans: d.plans.filter((p) => p.id !== id) }));
  }, [mutate]);

  const hasMeasurements = useCallback(
    (workTypeId: string) => !!dataRef.current?.entries.some((e) => e.workTypeId === workTypeId),
    [],
  );

  const store = data
    ? {
        projects: [{ id: projectId, name: data.name, createdAt: data.createdAt }],
        workTypes: data.workTypes,
        entries: data.entries,
        plans: data.plans,
      }
    : { projects: [], workTypes: [], entries: [], plans: [] };

  return {
    store,
    loading,
    exists,
    error,
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
