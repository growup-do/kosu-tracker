// 工数管理システム
// URLでビューを分離：
//   （パラメータなし）        … プロジェクト一覧（管理者のみ）
//   ?project=ID&view=admin   … 弊社管理ビュー（一覧へ戻る導線なし）
//   ?project=ID&view=client  … クライアント共有ビュー（管理・一覧へ辿れない・共有用URL）
// 一覧からは target=_blank で新規タブに開く。

import { useState } from 'react';
import { useStore } from './store';
import { currentMonth, fmtMonth, shiftMonth, viewUrl } from './util';
import { Logo } from './components/Logo';
import { ProjectHome } from './components/ProjectHome';
import { AdminView } from './components/AdminView';
import { ClientView } from './components/ClientView';

export default function App() {
  const api = useStore();
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('project');
  const view: 'admin' | 'client' = params.get('view') === 'client' ? 'client' : 'admin';
  const [month, setMonth] = useState<string>(currentMonth());

  const project = projectId ? api.store.projects.find((p) => p.id === projectId) ?? null : null;

  // ---- プロジェクト一覧（トップ・管理者専用） ----
  if (!project) {
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
        {projectId ? (
          <div className="banner">指定のプロジェクトが見つかりませんでした。URLをご確認ください。</div>
        ) : (
          <ProjectHome api={api} />
        )}
      </div>
    );
  }

  const monthNav = (
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

  // ---- クライアント共有ビュー（読み取り専用・管理/一覧への導線なし） ----
  if (view === 'client') {
    return (
      <div className="app">
        <div className="topbar">
          <div className="left">
            <Logo />
            <div className="crumb">
              <b>{project.name}</b>
              <span className="tagview"> ・共有ビュー</span>
            </div>
          </div>
          {monthNav}
        </div>
        <ClientView api={api} projectId={project.id} month={month} />
      </div>
    );
  }

  // ---- 弊社管理ビュー（一覧へ戻る導線なし。共有ビューは別タブで開く） ----
  return (
    <div className="app">
      <div className="topbar">
        <div className="left">
          <Logo />
          <div className="crumb">
            <b>{project.name}</b>
          </div>
        </div>
        <div className="rowwrap">
          {monthNav}
          <a className="btn sm" href={viewUrl(project.id, 'client')} target="_blank" rel="noreferrer">
            共有ビューを開く ↗
          </a>
        </div>
      </div>
      <AdminView api={api} projectId={project.id} month={month} />
    </div>
  );
}
