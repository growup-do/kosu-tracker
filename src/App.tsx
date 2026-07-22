// 工数管理システム（本番共有・Firestore）
//   （パラメータなし）        … プロジェクト一覧（オーナー・要ログイン）
//   ?project=ID&view=admin   … 弊社管理ビュー（要ログイン・一覧へ戻る導線なし）
//   ?project=ID&view=client  … クライアント共有ビュー（ログイン不要・読み取り専用・共有用URL）

import { useState } from 'react';
import { useAuth, useProjectStore } from './store';
import { currentMonth, fmtMonth, shiftMonth, viewUrl } from './util';
import { Logo } from './components/Logo';
import { Login } from './components/Login';
import { ProjectHome } from './components/ProjectHome';
import { AdminView } from './components/AdminView';
import { ClientView } from './components/ClientView';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('project');
  const view: 'admin' | 'client' = params.get('view') === 'client' ? 'client' : 'admin';

  // 共有ビューはログイン不要・読み取り専用（単一ドキュメントを購読）
  if (projectId && view === 'client') {
    return <ClientRoute projectId={projectId} />;
  }

  // それ以外（一覧・管理）はオーナーのログインが必要
  return <OwnerRoute projectId={projectId} />;
}

/* ---------- クライアント共有（ログイン不要） ---------- */
function ClientRoute({ projectId }: { projectId: string }) {
  const api = useProjectStore(projectId);
  const [month, setMonth] = useState<string>(currentMonth());
  const name = api.store.projects[0]?.name ?? '';

  return (
    <div className="app">
      <div className="topbar">
        <div className="left">
          <Logo />
          <div className="crumb">
            <b>{name || '共有ビュー'}</b>
            <span className="tagview"> ・共有ビュー</span>
          </div>
        </div>
        <MonthNav month={month} setMonth={setMonth} />
      </div>
      {api.loading ? (
        <div className="card"><div className="empty">読み込み中…</div></div>
      ) : !api.exists ? (
        <div className="banner">このプロジェクトは見つかりませんでした。共有URLをご確認ください。</div>
      ) : (
        <ClientView api={api} projectId={projectId} month={month} />
      )}
    </div>
  );
}

/* ---------- オーナー（一覧・管理／要ログイン） ---------- */
function OwnerRoute({ projectId }: { projectId: string | null }) {
  const auth = useAuth();

  if (!auth.ready) {
    return (
      <div className="app">
        <div className="card"><div className="empty">読み込み中…</div></div>
      </div>
    );
  }
  if (!auth.user) return <Login auth={auth} />;

  return projectId ? (
    <AdminRoute projectId={projectId} onSignOut={auth.signOutUser} />
  ) : (
    <HomeRoute onSignOut={auth.signOutUser} />
  );
}

function HomeRoute({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="app">
      <div className="topbar">
        <div className="left">
          <Logo />
          <div className="brand">
            工数管理<span>システム</span>
          </div>
        </div>
        <button className="btn ghost sm" onClick={onSignOut}>
          ログアウト
        </button>
      </div>
      <ProjectHome />
    </div>
  );
}

function AdminRoute({ projectId, onSignOut }: { projectId: string; onSignOut: () => void }) {
  const api = useProjectStore(projectId);
  const [month, setMonth] = useState<string>(currentMonth());
  const name = api.store.projects[0]?.name ?? '';

  return (
    <div className="app">
      <div className="topbar">
        <div className="left">
          <Logo />
          <div className="crumb">
            <b>{name || 'プロジェクト'}</b>
          </div>
        </div>
        <div className="rowwrap">
          <MonthNav month={month} setMonth={setMonth} />
          <a className="btn sm" href={viewUrl(projectId, 'client')} target="_blank" rel="noreferrer">
            共有ビューを開く ↗
          </a>
          <button className="btn ghost sm" onClick={onSignOut}>
            ログアウト
          </button>
        </div>
      </div>
      {api.loading ? (
        <div className="card"><div className="empty">読み込み中…</div></div>
      ) : !api.exists ? (
        <div className="banner">このプロジェクトは見つかりませんでした。</div>
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
