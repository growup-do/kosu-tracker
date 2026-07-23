// 工数管理システム（Firestore・ログインなし）
//   （パラメータなし）        … プロジェクト一覧
//   ?project=ID&view=admin   … 弊社管理ビュー（一覧へ戻る導線なし）
//   ?project=ID&view=client  … クライアント共有ビュー（読み取り専用・共有用URL）
// ログイン制限は上流の管理システム側で行うため、本アプリ自体は認証なし。

import { useState } from 'react';
import { useProjectStore } from './store';
import { currentMonth, fmtMonth, shiftMonth, viewUrl } from './util';
import { Logo } from './components/Logo';
import { ProjectHome } from './components/ProjectHome';
import { AdminView } from './components/AdminView';
import { ClientView } from './components/ClientView';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('project');
  const view: 'admin' | 'client' = params.get('view') === 'client' ? 'client' : 'admin';

  if (projectId && view === 'client') return <ProjectRoute projectId={projectId} mode="client" />;
  if (projectId) return <ProjectRoute projectId={projectId} mode="admin" />;
  return <HomeRoute />;
}

function HomeRoute() {
  return (
    <div className="app">
      <div className="topbar">
        <div className="left">
          <Logo />
          <div className="brand">
            工数管理<span>システム</span>
          </div>
        </div>
      </div>
      <ProjectHome />
    </div>
  );
}

function ProjectRoute({ projectId, mode }: { projectId: string; mode: 'admin' | 'client' }) {
  const api = useProjectStore(projectId);
  const [month, setMonth] = useState<string>(currentMonth());
  const name = api.store.projects[0]?.name ?? '';

  return (
    <div className="app">
      <div className="topbar">
        <div className="left">
          <Logo />
          <div className="crumb">
            <b>{name || (mode === 'client' ? '共有ビュー' : 'プロジェクト')}</b>
            {mode === 'client' && <span className="tagview"> ・共有ビュー</span>}
          </div>
        </div>
        <div className="rowwrap">
          <MonthNav month={month} setMonth={setMonth} />
          {mode === 'admin' && (
            <a className="btn sm" href={viewUrl(projectId, 'client')} target="_blank" rel="noreferrer">
              共有ビューを開く ↗
            </a>
          )}
        </div>
      </div>

      {api.error && (
        <div className="banner" style={{ background: '#fdeee9', borderColor: '#e6cfc7', color: '#c0392b' }}>{api.error}</div>
      )}
      {api.loading ? (
        <div className="card"><div className="empty">読み込み中…</div></div>
      ) : !api.exists ? (
        <div className="banner">このプロジェクトは見つかりませんでした。{mode === 'client' ? '共有URLをご確認ください。' : ''}</div>
      ) : mode === 'client' ? (
        <ClientView api={api} projectId={projectId} month={month} />
      ) : (
        <AdminView api={api} projectId={projectId} month={month} />
      )}
    </div>
  );
}

function MonthNav({ month, setMonth }: { month: string; setMonth: (fn: (m: string) => string) => void }) {
  return (
    <div className="monthnav">
      <button className="btn sm" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
        ‹
      </button>
      <div className="m">{fmtMonth(month)}</div>
      <button className="btn sm" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
        ›
      </button>
    </div>
  );
}
