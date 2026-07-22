// 弊社管理ビュー：計測（開始/中断/終了）・手動編集・作業種の追加削除と単価ロック・
// 月次サマリー（時間＋外注原価）・アーカイブ・作業予定。
// ※ 担当者の入力は不要（デザイナー1名・コーダー1名体制で、作業種＝担当者が自明のため）。

import { useState } from 'react';
import { useNow, type StoreApi } from '../store';
import { WorkTag } from './WorkTag';
import { durationMs, fmtDateTime, fmtHM, fmtYen, hoursOf, inputToTs, isMonthEnded, monthKey, onEnter, tsToInput } from '../util';
import type { TimeEntry } from '../types';

export function AdminView({ api, projectId, month }: { api: StoreApi; projectId: string; month: string }) {
  const { store } = api;
  const workTypes = store.workTypes.filter((w) => w.projectId === projectId);
  const running = store.entries.filter((e) => e.projectId === projectId && e.end == null);
  const now = useNow(running.length > 0);

  const monthEntries = store.entries
    .filter((e) => e.projectId === projectId && monthKey(e.start) === month)
    .sort((a, b) => b.start - a.start);

  // 月次集計
  const perType = workTypes.map((w) => {
    const es = monthEntries.filter((e) => e.workTypeId === w.id);
    const ms = es.reduce((acc, e) => acc + durationMs(e, now), 0);
    const cost = w.kind === 'coding' && w.rate != null ? hoursOf(ms) * w.rate : null;
    return { w, ms, cost };
  });
  const totalMs = perType.reduce((a, x) => a + x.ms, 0);
  const totalCost = perType.reduce((a, x) => a + (x.cost ?? 0), 0);

  const wt = (id: string) => workTypes.find((w) => w.id === id);

  return (
    <>
      {/* ===== 計測 ===== */}
      <div className="card">
        <h2>計測 <span className="sub">開始／終了。押し忘れはアーカイブで手動修正できます。</span></h2>

        {running.length > 0 && (
          <div style={{ margin: '4px 0 14px' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>現在計測中</div>
            {running.map((e) => (
              <div className="trow" key={e.id} style={{ background: 'var(--live-soft)', borderRadius: 10, padding: '10px 12px', borderBottom: 'none', marginBottom: 6 }}>
                <div className="rowwrap">
                  <span className="live"><span className="pulse" />計測中</span>
                  {wt(e.workTypeId) && <WorkTag w={wt(e.workTypeId)!} />}
                </div>
                <div className="actions">
                  <span className="clock">{new Date(now - e.start).toISOString().substr(11, 8)}</span>
                  <button className="btn sm primary" onClick={() => api.stopTimer(e.id)}>終了</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="eyebrow" style={{ marginBottom: 4 }}>作業を開始</div>
        {workTypes.map((w) => {
          const isRunning = running.some((e) => e.workTypeId === w.id);
          return (
            <div className="trow" key={w.id}>
              <WorkTag w={w} />
              <div className="actions">
                {isRunning ? (
                  <span className="live"><span className="pulse" />計測中</span>
                ) : (
                  <button className="btn primary sm" onClick={() => api.startTimer(projectId, w.id)}>
                    ▶ 開始
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== 作業種の管理 ===== */}
      <div className="card">
        <h2>作業種の管理 <span className="sub">追加・削除ができます（計測済みは削除不可）。単価はコーディングのみ・一度設定で確定。</span></h2>
        {workTypes.map((w) => {
          const measured = api.hasMeasurements(w.id);
          return (
            <div className="trow" key={w.id}>
              <WorkTag w={w} />
              <div className="actions">
                {w.kind === 'coding' ? (
                  w.rate == null ? (
                    <SetRate api={api} workTypeId={w.id} />
                  ) : (
                    <span className="pill-rate">{fmtYen(w.rate)}/h <span className="locked">確定・変更不可</span></span>
                  )
                ) : (
                  <span className="locked">単価対象外</span>
                )}
                <button
                  className="btn sm danger"
                  disabled={measured}
                  title={measured ? '計測済みのため削除できません' : ''}
                  onClick={() => api.deleteWorkType(w.id)}
                >
                  削除
                </button>
              </div>
            </div>
          );
        })}
        <AddWorkType api={api} projectId={projectId} />
        <div className="hint">※ 単価はあなたの外注コスト管理用です（デザインは対象外）。コーディングC・Dなどは「作業を追加」で増やせます。</div>
      </div>

      {/* ===== 当月サマリー（終了した月は確定として強調） ===== */}
      <div className={'card' + (isMonthEnded(month) ? ' ended' : '')}>
        <h2>
          {month} のサマリー
          {isMonthEnded(month) && <span className="ended-badge">確定・この月は終了</span>}
        </h2>
        <div className="tiles">
          {perType.map(({ w, ms, cost }) => (
            <div className="tile" key={w.id}>
              <div className="l"><span className="wdot" style={{ background: w.kind === 'design' ? 'var(--design)' : 'var(--codeA)' }} />{w.name}</div>
              <div className="v">{fmtHM(ms)}</div>
              <div className="s">{cost != null ? `外注原価 ${fmtYen(cost)}` : '単価対象外'}</div>
            </div>
          ))}
          <div className="tile total">
            <div className="l">合計時間 ／ 外注原価</div>
            <div className="v">{fmtHM(totalMs)}</div>
            <div className="s">外注原価（コーディング）{fmtYen(totalCost)}</div>
          </div>
        </div>
      </div>

      {/* ===== アーカイブ ===== */}
      <div className="card">
        <h2>アーカイブ（{month}） <span className="sub">{monthEntries.length} 件</span></h2>
        <ManualAdd api={api} projectId={projectId} month={month} />
        {monthEntries.length === 0 ? (
          <div className="empty">この月の計測記録はありません。</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>日時</th>
                <th>作業</th>
                <th className="r">時間</th>
                <th className="r">操作</th>
              </tr>
            </thead>
            <tbody>
              {monthEntries.map((e) => (
                <EntryRow key={e.id} api={api} e={e} now={now} typeName={wt(e.workTypeId)?.name ?? '—'} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== 作業予定 ===== */}
      <PlanSection api={api} projectId={projectId} month={month} />
    </>
  );
}

/* ---------- 小コンポーネント ---------- */

function SetRate({ api, workTypeId }: { api: StoreApi; workTypeId: string }) {
  const [v, setV] = useState('');
  return (
    <span className="rowwrap">
      <input className="inp" style={{ width: 100 }} inputMode="numeric" value={v}
        onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, ''))} placeholder="単価/時" />
      <button
        className="btn sm"
        disabled={!v}
        onClick={() => {
          if (confirm(`単価を ¥${Number(v).toLocaleString('ja-JP')}/h で確定します。\n※ 一度設定すると変更できません。よろしいですか？`))
            api.setRate(workTypeId, Number(v));
        }}
      >
        単価を確定
      </button>
    </span>
  );
}

function AddWorkType({ api, projectId }: { api: StoreApi; projectId: string }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'design' | 'coding'>('coding');
  return (
    <div className="formrow" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-2)' }}>
      <div className="field" style={{ flex: 1, minWidth: 200 }}>
        <label>作業名</label>
        <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：コーディング作業（難易度C）"
          onKeyDown={onEnter(() => { api.addWorkType(projectId, name, kind); setName(''); })} />
      </div>
      <div className="field">
        <label>種別</label>
        <select className="inp" value={kind} onChange={(e) => setKind(e.target.value as 'design' | 'coding')}>
          <option value="coding">コーディング（単価あり）</option>
          <option value="design">デザイン（単価なし）</option>
        </select>
      </div>
      <button className="btn primary" onClick={() => { api.addWorkType(projectId, name, kind); setName(''); }}>作業を追加</button>
    </div>
  );
}

function EntryRow({ api, e, now, typeName }: { api: StoreApi; e: TimeEntry; now: number; typeName: string }) {
  const [edit, setEdit] = useState(false);
  const [start, setStart] = useState(tsToInput(e.start));
  const [end, setEnd] = useState(e.end ? tsToInput(e.end) : '');
  const dur = durationMs(e, now);

  if (edit) {
    return (
      <tr>
        <td colSpan={4}>
          <div className="formrow">
            <div className="field"><label>開始</label>
              <input className="inp" type="datetime-local" value={start} onChange={(ev) => setStart(ev.target.value)} /></div>
            <div className="field"><label>終了（空欄＝計測中）</label>
              <input className="inp" type="datetime-local" value={end} onChange={(ev) => setEnd(ev.target.value)} /></div>
            <button className="btn primary sm" onClick={() => {
              api.updateEntry(e.id, { start: inputToTs(start), end: end ? inputToTs(end) : null });
              setEdit(false);
            }}>保存</button>
            <button className="btn sm ghost" onClick={() => setEdit(false)}>取消</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="num">{fmtDateTime(e.start)}{e.manual && <span className="locked"> ・手動</span>}</td>
      <td>{typeName}</td>
      <td className="r amt">{e.end == null ? <span className="live"><span className="pulse" />計測中</span> : fmtHM(dur)}</td>
      <td className="r">
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button className="btn sm" onClick={() => setEdit(true)}>編集</button>
          <button className="btn sm danger" onClick={() => { if (confirm('この記録を削除しますか？')) api.deleteEntry(e.id); }}>削除</button>
        </div>
      </td>
    </tr>
  );
}

function ManualAdd({ api, projectId, month }: { api: StoreApi; projectId: string; month: string }) {
  const { store } = api;
  const workTypes = store.workTypes.filter((w) => w.projectId === projectId);
  const [open, setOpen] = useState(false);
  const [typeId, setTypeId] = useState(workTypes[0]?.id ?? '');
  const [start, setStart] = useState(`${month}-01T09:00`);
  const [end, setEnd] = useState(`${month}-01T10:00`);

  if (!open)
    return (
      <div style={{ marginBottom: 12 }}>
        <button className="btn sm" onClick={() => setOpen(true)}>＋ 手動で記録を追加</button>
      </div>
    );

  return (
    <div className="formrow" style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--line-2)' }}>
      <div className="field"><label>作業</label>
        <select className="inp" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          {workTypes.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select></div>
      <div className="field"><label>開始</label>
        <input className="inp" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div className="field"><label>終了</label>
        <input className="inp" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      <button className="btn primary sm" disabled={!typeId} onClick={() => {
        api.addManualEntry(projectId, typeId, inputToTs(start), inputToTs(end));
        setOpen(false);
      }}>追加</button>
      <button className="btn sm ghost" onClick={() => setOpen(false)}>取消</button>
    </div>
  );
}

function PlanSection({ api, projectId, month }: { api: StoreApi; projectId: string; month: string }) {
  const { store } = api;
  const workTypes = store.workTypes.filter((w) => w.projectId === projectId);
  const plans = store.plans.filter((p) => p.projectId === projectId && p.month === month);
  const [title, setTitle] = useState('');
  const [typeId, setTypeId] = useState('');

  return (
    <div className="card">
      <h2>{month} の作業予定 <span className="sub">今月やる作業を登録し、終わったら完了にできます。</span></h2>
      <div className="formrow" style={{ marginBottom: 12 }}>
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <label>予定の内容</label>
          <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：仕訳一覧・元帳のデザイン調整"
            onKeyDown={onEnter(() => { api.addPlan(projectId, month, title, typeId || null); setTitle(''); })} />
        </div>
        <div className="field">
          <label>作業種（任意）</label>
          <select className="inp" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">指定なし</option>
            {workTypes.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <button className="btn primary" onClick={() => { api.addPlan(projectId, month, title, typeId || null); setTitle(''); }}>追加</button>
      </div>
      {plans.length === 0 ? (
        <div className="empty">この月の作業予定はまだありません。</div>
      ) : (
        plans.map((p) => {
          const w = workTypes.find((x) => x.id === p.workTypeId);
          return (
            <div className={'plan' + (p.done ? ' done' : '')} key={p.id}>
              <input type="checkbox" checked={p.done} onChange={() => api.togglePlan(p.id)} />
              <span className="title">{p.title}</span>
              {w && <WorkTag w={w} />}
              {p.done && <span className="badge-done">完了</span>}
              <button className="btn sm ghost danger" onClick={() => api.deletePlan(p.id)}>削除</button>
            </div>
          );
        })
      )}
    </div>
  );
}
