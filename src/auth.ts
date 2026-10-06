// 管理画面のログイン（Firebase Authentication / メール＋パスワード）
// 書き込み可否の本当の制御は firestore.rules の許可リスト。ここは画面表示の判定用。
// ※ メンバーを増やすときは、この配列と firestore.rules の両方に追加する。

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';

export const ADMIN_EMAILS: string[] = [
  'suzuki@growup-do.com', // オーナー
  'iiken0126@gmail.com', // コーダー
];

export const isAdmin = (u: User | null): boolean =>
  !!u?.email && ADMIN_EMAILS.includes(u.email.toLowerCase());

/** ログイン状態。undefined=確認中 */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}
