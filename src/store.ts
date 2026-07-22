// 工数管理 — Firestore 本番共有化ストア＋認証
// データモデル：collection 'projects' の各ドキュメント = 1プロジェクトの全状態
//   projects/{id} = { name, createdAt, workTypes[], entries[], plans[] }
// - 管理（オーナー）：ログイン必須。一覧＝collectionを購読、各プロジェクト＝ドキュメントを購読して書き込み。
// - クライアント共有：ログイン不要。共有URLのプロジェクトIDでドキュメント単体をリアルタイム購読（読み取り専用）。

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth, db } from './firebase';
import { uid } from './util';
import type { PlannedWork, Project, TimeEntry, WorkKind, WorkType } from './types';

/* ============ 認証（オーナーのみ書き込み） ============ */

export interface AuthApi {
  user: User | null;
  ready: boolean;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

export function useAuth(): AuthApi {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
      }),
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setError('メールアドレスまたはパスワードが違います。');
      throw e;
    }
  }, []);

  const signOutUser = useCallback(() => signOut(auth), []);

  return { user, ready, error, signIn, signOutUser };
}

/* ============ プロジェクト一覧（オーナー・要ログイン） ============ */

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
  createProject: (name: string) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
}

export function useProjectList(enabled: boolean): ProjectListApi {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    const unsub = onSnapshot(query(collection(db, 'projects')), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, name: d.data().name as string, createdAt: d.data().createdAt as number }))
        .sort((a, b) => a.createdAt - b.createdAt);
      setProjects(list);
      setLoading(false);
    });
    return unsub;
  }, [enabled]);

  const createProject = useCallback(async (name: string) => {
    const id = uid();
    await setDoc(doc(db, 'projects', id), {
      name: name.trim() || '無題プロジェクト',
      createdAt: Date.now(),
      workTypes: defaultWorkTypes(id),
      entries: [],
      plans: [],
    });
    return id;
  }, []);

  const deleteProject = useCallback((id: string) => deleteDoc(doc(db, 'projects', id)), []);

  return { projects, loading, createProject, deleteProject };
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
      },
      () => setLoading(false),
    );
    return unsub;
  }, [projectId]);

  const ref = doc(db, 'projects', projectId);
  const patch = (fields: Partial<ProjectDoc>) => {
    void updateDoc(ref, fields as Record<string, unknown>);
  };

  const addWorkType = useCallback((_pid: string, name: string, kind: WorkKind) => {
    const d = dataRef.current;
    if (!d || !name.trim()) return;
    patch({ workTypes: [...d.workTypes, { id: uid(), projectId, name: name.trim(), kind, rate: null }] });
  }, [projectId]);

  const setRate = useCallback((workTypeId: string, rate: number) => {
    const d = dataRef.current;
    if (!d) return;
    patch({
      workTypes: d.workTypes.map((w) => (w.id === workTypeId && w.kind === 'coding' && w.rate == null ? { ...w, rate } : w)),
    });
  }, [projectId]);

  const deleteWorkType = useCallback((id: string) => {
    const d = dataRef.current;
    if (!d || d.entries.some((e) => e.workTypeId === id)) return;
    patch({ workTypes: d.workTypes.filter((w) => w.id !== id) });
  }, [projectId]);

  const startTimer = useCallback((_pid: string, workTypeId: string) => {
    const d = dataRef.current;
    if (!d || d.entries.some((e) => e.workTypeId === workTypeId && e.end == null)) return;
    const entry: TimeEntry = { id: uid(), projectId, workTypeId, start: Date.now(), end: null };
    patch({ entries: [...d.entries, entry] });
  }, [projectId]);

  const stopTimer = useCallback((entryId: string) => {
    const d = dataRef.current;
    if (!d) return;
    patch({ entries: d.entries.map((e) => (e.id === entryId && e.end == null ? { ...e, end: Date.now() } : e)) });
  }, [projectId]);

  const updateEntry = useCallback((entryId: string, up: Partial<Pick<TimeEntry, 'start' | 'end'>>) => {
    const d = dataRef.current;
    if (!d) return;
    patch({ entries: d.entries.map((e) => (e.id === entryId ? { ...e, ...up, manual: true } : e)) });
  }, [projectId]);

  const addManualEntry = useCallback((_pid: string, workTypeId: string, start: number, end: number) => {
    const d = dataRef.current;
    if (!d) return;
    patch({ entries: [...d.entries, { id: uid(), projectId, workTypeId, start, end, manual: true }] });
  }, [projectId]);

  const deleteEntry = useCallback((entryId: string) => {
    const d = dataRef.current;
    if (!d) return;
    patch({ entries: d.entries.filter((e) => e.id !== entryId) });
  }, [projectId]);

  const addPlan = useCallback((_pid: string, month: string, title: string, workTypeId: string | null) => {
    const d = dataRef.current;
    if (!d || !title.trim()) return;
    const plan: PlannedWork = { id: uid(), projectId, month, title: title.trim(), workTypeId, done: false };
    patch({ plans: [...d.plans, plan] });
  }, [projectId]);

  const togglePlan = useCallback((id: string) => {
    const d = dataRef.current;
    if (!d) return;
    patch({ plans: d.plans.map((p) => (p.id === id ? { ...p, done: !p.done } : p)) });
  }, [projectId]);

  const deletePlan = useCallback((id: string) => {
    const d = dataRef.current;
    if (!d) return;
    patch({ plans: d.plans.filter((p) => p.id !== id) });
  }, [projectId]);

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
