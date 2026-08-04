// トップ：プロジェクト一覧・作成（オーナー・要ログイン）
// 各プロジェクトは target=_blank で新規タブに開く（管理ビュー）。共有URLはコピー可。

import { useState } from 'react';
import { useProjectList } from '../store';
import { onEnter, viewUrl } from '../util';

export function ProjectHome() {
  const { projects, loading, error, createProject, deleteProject } = useProjectList(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createProject(name);
      setName('');
    } finally {
      setBusy(false);
    }
  };

  /**
   * プロジェクト削除の二重確認。
   * 削除は取り消せないため、①意思確認 → ②プロジェクト名の入力照合 の2段階を通過した場合のみ実行する。
   */
  const confirmDelete = (name: string, onConfirmed: () => void) => {
    const ok = confirm(
      `「${name}」を本当に削除しますか？\n\n` +
        `計測記録・作業予定・単価設定など、このプロジェクトのデータがすべて削除されます。\n` +
        `この操作は取り消せません。`,
    );
    if (!ok) return;

    const typed = prompt(`最終確認です。\n削除するには、プロジェクト名「${name}」を入力してください。`, '');
    if (typed === null) return; // キャンセル
    if (typed.trim() !== name.trim()) {
      alert('プロジェクト名が一致しなかったため、削除を中止しました。');
      return;
    }
    onConfirmed();
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
      {error && (
        <div className="banner" style={{ background: '#fdeee9', borderColor: '#e6cfc7', color: '#c0392b' }}>
          {error}
        </div>
      )}
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
          <button className="btn primary" onClick={create} disabled={busy}>
            {busy ? '作成中…' : '作成'}
          </button>
        </div>
        <div className="hint">※ 日本語変換の確定Enterでは送信されません。追加は「作成」ボタン、または変換確定後にもう一度Enterで行えます。</div>
      </div>

      <div className="card">
        <h2>
          プロジェクト <span className="sub">{projects.length} 件</span>
        </h2>
        {loading && <div className="empty">読み込み中…</div>}
        {!loading && projects.length === 0 && <div className="empty">まだプロジェクトがありません。上から追加してください。</div>}
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
              <button className="btn sm danger" onClick={() => confirmDelete(p.name, () => void deleteProject(p.id))}>
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
