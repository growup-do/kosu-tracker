// クライアント共有ビュー（閲覧専用）
// 管理用データを読み取り表示。操作ボタンなし。3作業の時間と費用（時給7,000円）、
// 現在作業中、月次アーカイブ、作業予定の閲覧。

import { useNow, type StoreApi } from '../store';
import { WorkTag } from './WorkTag';
import { CLIENT_RATE, durationMs, fmtDateTime, fmtHM, fmtYen, hoursOf, isMonthEnded, monthKey } from '../util';

export function ClientView({ api, projectId, month }: { api: StoreApi; projectId: string; month: string }) {
  const { store } = api;
  const workTypes = store.workTypes.filter((w) => w.projectId === projectId);
  const running = store.entries.filter((e) => e.projectId === projectId && e.end == null);
  const now = useNow(running.length > 0);

  const monthEntries = store.entries
    .filter((e) => e.projectId === projectId && monthKey(e.start) === month)
    .sort((a, b) => b.start - a.start);

  const perType = workTypes.map((w) => {
    const es = monthEntries.filter((e) => e.workTypeId === w.id);
    const ms = es.reduce((acc, e) => acc + durationMs(e, now), 0);
    return { w, ms, cost: hoursOf(ms) * CLIENT_RATE };
  });
  const totalMs = perType.reduce((a, x) => a + x.ms, 0);
  const totalCost = hoursOf(totalMs) * CLIENT_RATE;

  const plans = store.plans.filter((p) => p.projectId === projectId && p.month === month);
  const wt = (id: string) => workTypes.find((w) => w.id === id);
  const ended = isMonthEnded(month);

  return (
    <>
      {/* 現在作業中 */}
      {running.length > 0 && (
        <div className="card">
          <h2>現在の作業状況</h2>
          {running.map((e) => (
            <div className="trow" key={e.id} style={{ background: 'var(--live-soft)', borderRadius: 10, padding: '10px 12px', borderBottom: 'none', marginBottom: 6 }}>
              <div className="rowwrap">
                <span className="live"><span className="pulse" />現在作業中</span>
                {wt(e.workTypeId) && <WorkTag w={wt(e.workTypeId)!} />}
              </div>
              <span className="clock">{new Date(now - e.start).toISOString().substr(11, 8)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 月次サマリー（費用）※当月が終了した月は確定として強調 */}
      <div className={'card' + (ended ? ' ended' : '')}>
        <h2>
          {month} の作業時間と費用
          {ended && <span className="ended-badge">確定・この月は終了</span>}
        </h2>
        <div className="tiles">
          {perType.map(({ w, ms, cost }) => (
            <div className="tile" key={w.id}>
              <div className="l"><span className="wdot" style={{ background: w.kind === 'design' ? 'var(--design)' : 'var(--codeA)' }} />{w.name}</div>
              <div className="v">{fmtHM(ms)}</div>
              <div className="s">{fmtYen(cost)}</div>
            </div>
          ))}
          <div className="tile total">
            <div className="l">合計時間 ／ 費用</div>
            <div className="v">{fmtHM(totalMs)}</div>
            <div className="s">費用合計 {fmtYen(totalCost)}（{fmtYen(CLIENT_RATE)}/h）</div>
          </div>
        </div>
      </div>

      {/* アーカイブ */}
      <div className="card">
        <h2>作業アーカイブ（{month}） <span className="sub">いつ・どの作業に・どれだけ</span></h2>
        {monthEntries.length === 0 ? (
          <div className="empty">この月の作業記録はありません。</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>作業</th>
                <th className="r">時間</th>
                <th className="r">費用</th>
              </tr>
            </thead>
            <tbody>
              {monthEntries.map((e) => {
                const dur = durationMs(e, now);
                return (
                  <tr key={e.id}>
                    <td className="num">{fmtDateTime(e.start)}</td>
                    <td>{wt(e.workTypeId)?.name ?? '—'}</td>
                    <td className="r amt">{e.end == null ? <span className="live"><span className="pulse" />作業中</span> : fmtHM(dur)}</td>
                    <td className="r amt">{fmtYen(hoursOf(dur) * CLIENT_RATE)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 作業予定（閲覧） */}
      <div className="card">
        <h2>{month} の作業予定</h2>
        {plans.length === 0 ? (
          <div className="empty">この月の作業予定は登録されていません。</div>
        ) : (
          plans.map((p) => {
            const w = workTypes.find((x) => x.id === p.workTypeId);
            return (
              <div className={'plan' + (p.done ? ' done' : '')} key={p.id}>
                <span style={{ fontSize: 15 }}>{p.done ? '✅' : '⬜️'}</span>
                <span className="title">{p.title}</span>
                {w && <WorkTag w={w} />}
                {p.done && <span className="badge-done">完了</span>}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
