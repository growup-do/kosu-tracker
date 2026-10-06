// 管理画面（一覧・管理ビュー）の入口。許可リストのメンバーがログインしている時だけ children を表示。
// 共有ビューはこのゲートを通らない（ログイン不要・閲覧のみ）。

import { useState, type ReactNode } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { isAdmin, useAuthUser } from '../auth';
import { onEnter } from '../util';
import { Logo } from './Logo';

export function LoginGate({ children }: { children: ReactNode }) {
  const user = useAuthUser();

  if (user === undefined) return <Shell><div className="card"><div className="empty">読み込み中…</div></div></Shell>;
  if (!user) return <Shell><LoginForm /></Shell>;
  if (!isAdmin(user))
    return (
      <Shell>
        <div className="card login">
          <h2>アクセス権がありません</h2>
          <p className="hint">{user.email} には管理画面の権限がありません。管理者にお問い合わせください。</p>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => signOut(auth)}>ログアウト</button>
        </div>
      </Shell>
    );
  return <>{children}</>;
}

/** ログイン中ユーザーの表示＋ログアウト（トップバー用） */
export function UserBadge() {
  const user = useAuthUser();
  if (!user) return null;
  return (
    <span className="rowwrap userbadge">
      <span className="hint" style={{ margin: 0 }}>{user.email}</span>
      <button className="btn sm" onClick={() => signOut(auth)}>ログアウト</button>
    </span>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <div className="topbar">
        <div className="left">
          <Logo />
          <div className="brand">工数管理<span>システム</span></div>
        </div>
      </div>
      {children}
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const login = async () => {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setMsg({
        ok: false,
        text: code.includes('too-many-requests')
          ? '試行回数が多すぎます。しばらく待ってから再度お試しください。'
          : code.includes('network')
            ? '通信に失敗しました。ネットワーク環境をご確認ください。'
            : 'メールアドレスまたはパスワードが正しくありません。',
      });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) return setMsg({ ok: false, text: 'メールアドレスを入力してから押してください。' });
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // 登録有無を推測されないよう、結果にかかわらず同じ表示にする
    }
    setMsg({ ok: true, text: `${email.trim()} 宛にパスワード設定用のメールを送りました（登録済みのアドレスの場合）。` });
  };

  return (
    <div className="card login">
      <h2>管理画面ログイン</h2>
      <div className="field">
        <label>メールアドレス</label>
        <input className="inp" type="email" autoComplete="username" value={email}
          onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter(login)} />
      </div>
      <div className="field">
        <label>パスワード</label>
        <input className="inp" type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} onKeyDown={onEnter(login)} />
      </div>
      {msg && <div className="hint" style={{ color: msg.ok ? 'var(--accent)' : 'var(--warn)' }}>{msg.text}</div>}
      <button className="btn primary" disabled={busy || !email.trim() || !password} onClick={login}>
        {busy ? 'ログイン中…' : 'ログイン'}
      </button>
      <button className="btn ghost sm" onClick={reset}>パスワードを忘れた／初回設定</button>
    </div>
  );
}
