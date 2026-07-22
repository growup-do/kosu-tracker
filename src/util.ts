// 工数管理 — 時間・金額・月のユーティリティ

import type { KeyboardEvent } from 'react';
import type { TimeEntry } from './types';

/** クライアント請求の時給単価（円） */
export const CLIENT_RATE = 7000;

/**
 * Enterで実行するハンドラ。ただし日本語IMEの変換確定Enterは無視する。
 * （変換確定のつもりのEnterで誤送信されるのを防ぐ）
 */
export function onEnter(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    // IME変換中／変換確定のEnter（isComposing、または keyCode 229）は無視
    if (e.nativeEvent.isComposing || (e.nativeEvent as unknown as { keyCode: number }).keyCode === 229) return;
    e.preventDefault();
    fn();
  };
}

/** 現在URLをベースに、管理/共有ビューのURLを生成 */
export function viewUrl(projectId: string, view: 'admin' | 'client'): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}?project=${encodeURIComponent(projectId)}&view=${view}`;
}

export const uid = (): string =>
  (crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

/** timestamp → 'YYYY-MM' */
export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 現在の月キー */
export const currentMonth = (): string => monthKey(Date.now());

/** 'YYYY-MM' → '2026年7月' */
export function fmtMonth(m: string): string {
  const [y, mo] = m.split('-');
  return `${y}年${Number(mo)}月`;
}

/** 月キーを増減（delta月） */
export function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** セッションの経過ミリ秒（計測中は now まで） */
export function durationMs(e: TimeEntry, now: number): number {
  return Math.max(0, (e.end ?? now) - e.start);
}

export const hoursOf = (ms: number): number => ms / 3_600_000;

/** ミリ秒 → 'H:MM:SS'（計測中の表示用） */
export function fmtClock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** ミリ秒 → '3時間05分' */
export function fmtHM(ms: number): string {
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}時間${String(m).padStart(2, '0')}分`;
}

export const fmtYen = (n: number): string => '¥' + Math.round(n).toLocaleString('ja-JP');

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** timestamp → '7/16(水) 14:30'（曜日つき） */
export function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  const w = WEEKDAYS[d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${w}) ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

/** 指定月（'YYYY-MM'）が当月より前＝すでに終了しているか */
export function isMonthEnded(month: string): boolean {
  return month < currentMonth();
}

/** timestamp → datetime-local 入力値 'YYYY-MM-DDTHH:MM'（ローカル時刻） */
export function tsToInput(ts: number): string {
  const d = new Date(ts - d0(ts));
  return d.toISOString().slice(0, 16);
}
function d0(ts: number): number {
  return new Date(ts).getTimezoneOffset() * 60000;
}

/** datetime-local 入力値 → timestamp */
export function inputToTs(v: string): number {
  return v ? new Date(v).getTime() : Date.now();
}
