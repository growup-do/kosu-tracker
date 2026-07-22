// トップ：プロジェクト一覧・作成（管理者のみアクセス想定）
// 各プロジェクトは target=_blank で新規タブに開く（管理ビュー）。共有URLはコピー可。

import { useState } from 'react';
import type { StoreApi } from '../store';
import { onEnter, viewUrl } from '../util';

export function ProjectHome({ api }: { api: StoreApi }) {
  const [name, setName] = useState('');
  const { projects } = api.store;

  const create = () => {
    if (!name.trim()) return;
    api.createProject(name);
    setName('');
  };

  const copyClientUrl = async (id: string) => {
    const url = viewUrl(id, 'client');
    try {
      await navigator.clipboard.writeText(url);
      alert('共有ビューのURLをコピーしました。\nクライアントにはこのURLを共有してください。');
    } catch {
      prompt('共有ビューのURL（コピーしてください）', url);
    }
  };

  return (
    <>
      <div className="card">
        <h2>プロジェクトを追加</h2>
        <div className="formrow">
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label>プロジェクト名</label>
            <input
              className="inp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：チャイルド 会計基準システム"
              onKeyDown={onEnter(create)}
            />
          </div>
          <button className="btn primary" onClick={create}>
            作成
          </button>
        </div>
        <div className="hint">※ 日本語変換の確定Enterでは送信されません。追加は「作成」ボタン、または変換確定後にもう一度Enterで行えます。</div>
      </div>

      <div className="card">
        <h2>
          プロジェクト <span className="sub">{projects.length} 件</span>
        </h2>
        {projects.length === 0 && <div className="empty">まだプロジェクトがありません。上から追加してください。</div>}
        {projects.map((p) => (
          <div className="projcard" key={p.id}>
            <div>
              <div className="pname">{p.name}</div>
              <div className="pmeta">作成 {new Date(p.createdAt).toLocaleDateString('ja-JP')}</div>
            </div>
            <div className="rowwrap">
              <a className="btn primary sm" href={viewUrl(p.id, 'admin')} target="_blank" rel="noreferrer">
                管理を開く ↗
              </a>
              <button className="btn sm" onClick={() => copyClientUrl(p.id)}>
                共有URLをコピー
              </button>
              <button
                className="btn sm danger"
                onClick={() => {
                  if (confirm(`「${p.name}」を削除します。計測データも消えます。よろしいですか？`)) api.deleteProject(p.id);
                }}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
