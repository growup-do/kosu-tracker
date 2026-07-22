// オーナー用ログイン（管理・一覧の書き込みに必要）
// 共有ビューはログイン不要のため、この画面は管理側でのみ表示される。

import { useState } from 'react';
import type { AuthApi } from '../store';
import { Logo } from './Logo';
import { onEnter } from '../util';

export function Login({ auth }: { auth: AuthApi }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password || busy) return;
    setBusy(true);
    try {
      await auth.signIn(email, password);
    } catch {
      /* error は auth.error に反映 */
    } finally {
      setBusy(false);
    }
  };

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
      <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
        <h2>管理者ログイン</h2>
        <div className="stack" style={{ gap: 12 }}>
          <div className="field" style={{ width: '100%' }}>
            <label>メールアドレス</label>
            <input
              className="inp"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onEnter(submit)}
            />
          </div>
          <div className="field" style={{ width: '100%' }}>
            <label>パスワード</label>
            <input
              className="inp"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onEnter(submit)}
            />
          </div>
          {auth.error && <div className="note-warn">{auth.error}</div>}
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? 'ログイン中…' : 'ログイン'}
          </button>
        </div>
        <div className="hint">※ このログインは管理者（あなた）専用です。クライアントの共有ビューはログイン不要で閲覧できます。</div>
      </div>
    </div>
  );
}
