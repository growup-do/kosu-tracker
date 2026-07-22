// 工数管理システム — 型定義

export type WorkKind = 'design' | 'coding';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
}

/** 計測対象の作業（デザイン / コーディングA / B / …）。単価はコーディングのみ・一度設定で確定。 */
export interface WorkType {
  id: string;
  projectId: string;
  name: string;
  kind: WorkKind;
  /** 外注原価管理用の単価（コーディングのみ・null=未設定。設定後は変更不可） */
  rate: number | null;
}

/** 1回の作業セッション（開始〜停止）。end=null は計測中＝現在作業中。 */
export interface TimeEntry {
  id: string;
  projectId: string;
  workTypeId: string;
  start: number;
  end: number | null;
  manual?: boolean;
}

/** 月ごとの作業予定。done=完了。 */
export interface PlannedWork {
  id: string;
  projectId: string;
  month: string; // 'YYYY-MM'
  title: string;
  workTypeId: string | null;
  done: boolean;
}

export interface Store {
  projects: Project[];
  workTypes: WorkType[];
  entries: TimeEntry[];
  plans: PlannedWork[];
}
