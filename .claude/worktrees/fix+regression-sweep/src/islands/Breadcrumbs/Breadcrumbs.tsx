import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ObservabilityEntry } from '../../lib/observability';
import { copySnapshot, downloadSnapshot } from '../../lib/observability';

// Floating bottom-right panel that surfaces the writing-engine activity
// flowing through the proxy worker. Subscribes to the
// 'antcv:writing-engine-response' CustomEvent (v1.50.5 observability
// layer) and keeps an in-component list of the last MAX_ENTRIES entries.
//
// Default state: collapsed to a single badge showing entry count + the
// most recent style. Click to expand into the full list. The verbose
// toggle inside flips localStorage 'antcv:observability-verbose' so the
// observability layer's [antcv-observability] console logging turns on.
// Close button dismisses the panel until the next reload (or until the
// user reopens it from window.AntcvBreadcrumbs.show()).

const MAX_ENTRIES = 8;
const DISMISSED_KEY = 'antcv:breadcrumbs-dismissed';

function readDismissed(): boolean {
  try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

function writeDismissed(v: boolean): void {
  try {
    if (v) sessionStorage.setItem(DISMISSED_KEY, '1');
    else sessionStorage.removeItem(DISMISSED_KEY);
  } catch { /* */ }
}

function readVerbose(): boolean {
  try {
    const v = localStorage.getItem('antcv:observability-verbose');
    return v === '1' || v === 'true';
  } catch { return false; }
}

function ageLabel(ts: number, nowMs: number): string {
  const d = Math.max(0, nowMs - ts);
  if (d < 1000) return 'now';
  if (d < 60_000) return Math.round(d / 1000) + 's';
  if (d < 3_600_000) return Math.round(d / 60_000) + 'm';
  return Math.round(d / 3_600_000) + 'h';
}

export function Breadcrumbs(): JSX.Element | null {
  const [entries, setEntries] = useState<ObservabilityEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed());
  const [verbose, setVerbose] = useState<boolean>(() => readVerbose());
  const [tick, setTick] = useState(0);
  const tickerRef = useRef<number | null>(null);

  useEffect(() => {
    const onEntry = (ev: Event) => {
      const detail = (ev as CustomEvent<ObservabilityEntry>).detail;
      if (!detail) return;
      setEntries((prev) => {
        const next = [...prev, detail];
        return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
      });
    };
    window.addEventListener('antcv:writing-engine-response', onEntry as EventListener);
    return () => window.removeEventListener('antcv:writing-engine-response', onEntry as EventListener);
  }, []);

  // Lightweight ticker so the relative-age labels stay fresh while the
  // panel is open.
  useEffect(() => {
    if (!expanded) return;
    tickerRef.current = window.setInterval(() => setTick((n) => n + 1), 5000);
    return () => {
      if (tickerRef.current != null) window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    };
  }, [expanded]);

  const [copyStatus, setCopyStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const copyResetRef = useRef<number | null>(null);

  const onToggle = useCallback(() => setExpanded((v) => !v), []);
  const onDismiss = useCallback(() => {
    setDismissed(true);
    writeDismissed(true);
  }, []);
  const onVerbose = useCallback(() => {
    setVerbose((v) => {
      const next = !v;
      try { localStorage.setItem('antcv:observability-verbose', next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  }, []);

  // v1.50.24 — copy the full observability snapshot (full 50-entry
  // buffer + build version + active prefs, minus banned-word lists) as
  // pretty-printed JSON to the clipboard. Useful when a user wants to
  // attach diagnostic state to a bug report. Falls back to a hidden
  // textarea + execCommand path on browsers without the Clipboard API.
  // Shift-click bypasses the clipboard and downloads the JSON file
  // directly — handy when the page lost focus and writeText would
  // reject (Safari, Firefox under some focus conditions).
  const onCopy = useCallback(async (ev: React.MouseEvent) => {
    if (copyResetRef.current != null) {
      window.clearTimeout(copyResetRef.current);
      copyResetRef.current = null;
    }
    if (ev.shiftKey) {
      try { downloadSnapshot(); setCopyStatus('ok'); }
      catch { setCopyStatus('fail'); }
    } else {
      const ok = await copySnapshot();
      setCopyStatus(ok ? 'ok' : 'fail');
    }
    copyResetRef.current = window.setTimeout(() => {
      setCopyStatus('idle');
      copyResetRef.current = null;
    }, 1800);
  }, []);

  useEffect(() => () => {
    if (copyResetRef.current != null) {
      window.clearTimeout(copyResetRef.current);
      copyResetRef.current = null;
    }
  }, []);

  const latest = entries.length ? entries[entries.length - 1] : null;
  const flaggedCount = useMemo(() => entries.filter((e) => e.flagged).length, [entries]);
  const now = Date.now() + tick * 0; // tick is a re-render trigger only

  if (dismissed) return null;
  if (entries.length === 0) return null;

  return (
    <div
      data-antcv-react-island="breadcrumbs"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 999,
        color: '#e6eef3',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        userSelect: 'none',
      }}
    >
      {!expanded && (
        <button
          type="button"
          onClick={onToggle}
          aria-label="Show writing-engine breadcrumbs"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(40,53,86,.92)',
            border: '1px solid rgba(1,183,187,.55)',
            color: '#e6eef3',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 11,
            boxShadow: '0 2px 8px rgba(0,0,0,.32)',
          }}
        >
          <span aria-hidden="true">▴</span>
          AI · {entries.length}
          {flaggedCount > 0 && (
            <span
              style={{
                padding: '0 6px',
                borderRadius: 8,
                background: 'rgba(217,164,65,.28)',
                border: '1px solid rgba(217,164,65,.55)',
                fontSize: 10,
              }}
              title={`${flaggedCount} flagged generation(s)`}
            >
              ⚠ {flaggedCount}
            </span>
          )}
          {latest && (
            <span style={{ opacity: 0.7, fontWeight: 500 }}>
              {latest.writingStyle ?? latest.task ?? ''}
            </span>
          )}
        </button>
      )}

      {expanded && (
        <div
          style={{
            width: 320,
            maxWidth: 'calc(100vw - 32px)',
            background: 'rgba(40,53,86,.96)',
            border: '1px solid rgba(1,183,187,.55)',
            borderRadius: 10,
            padding: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,.42)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800, fontSize: 11 }}>
              AI breadcrumbs
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={onVerbose}
                title={verbose ? 'Verbose console logging on' : 'Verbose console logging off'}
                aria-pressed={verbose}
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: verbose ? 'rgba(1,183,187,.18)' : 'transparent',
                  border: '1px solid ' + (verbose ? 'rgba(1,183,187,.55)' : 'rgba(255,255,255,.18)'),
                  color: '#e6eef3',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                LOG
              </button>
              <button
                type="button"
                onClick={onCopy}
                title={
                  copyStatus === 'ok'  ? 'Snapshot copied (or downloaded with Shift-click)' :
                  copyStatus === 'fail' ? 'Copy failed — Shift-click to download instead' :
                  'Copy diagnostic snapshot (Shift-click to download)'
                }
                aria-label="Copy diagnostic snapshot"
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  background:
                    copyStatus === 'ok'   ? 'rgba(155,224,165,.20)' :
                    copyStatus === 'fail' ? 'rgba(217,164,65,.20)'  :
                    'transparent',
                  border: '1px solid ' + (
                    copyStatus === 'ok'   ? 'rgba(155,224,165,.55)' :
                    copyStatus === 'fail' ? 'rgba(217,164,65,.55)'  :
                    'rgba(255,255,255,.18)'
                  ),
                  color: '#e6eef3',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {copyStatus === 'ok' ? 'OK' : copyStatus === 'fail' ? '!?' : 'COPY'}
              </button>
              <button
                type="button"
                onClick={onToggle}
                aria-label="Collapse breadcrumbs"
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,.18)',
                  color: '#e6eef3',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                ▾
              </button>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss breadcrumbs until next reload"
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,.18)',
                  color: '#e6eef3',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.slice().reverse().map((e, i) => (
              <EntryRow key={`${e.ts}-${i}`} entry={e} nowMs={now} />
            ))}
          </div>

          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 8 }}>
            Reading <code>window.AntcvObservability.readBuffer()</code>. Subscribe via{' '}
            <code>antcv:writing-engine-response</code>. COPY/download via{' '}
            <code>copySnapshot()</code> / <code>downloadSnapshot()</code>.
          </div>
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry, nowMs }: { entry: ObservabilityEntry; nowMs: number }): JSX.Element {
  const parts: string[] = [];
  if (entry.writingStyle) parts.push(entry.writingStyle);
  if (entry.targetLanguage) parts.push(entry.targetLanguage);
  if (entry.toneChips.length) parts.push(entry.toneChips.slice(0, 3).join(','));
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 6,
        padding: '6px 8px',
        background: entry.flagged ? 'rgba(217,164,65,.10)' : 'rgba(255,255,255,.04)',
        border: '1px solid ' + (entry.flagged ? 'rgba(217,164,65,.45)' : 'rgba(255,255,255,.10)'),
        borderRadius: 6,
        fontSize: 11,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 700, color: entry.flagged ? '#fde9c6' : '#e6eef3' }}>
          {parts.join(' · ') || entry.task || 'AI call'}
        </span>
        <span style={{ fontSize: 10, opacity: 0.7, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {entry.sceAttempts != null && <span>att {entry.sceAttempts}</span>}
          {entry.sceClean === true && <span style={{ color: '#9be0a5' }}>clean</span>}
          {entry.flagged && <span style={{ color: '#fde9c6', fontWeight: 700 }}>FLAGGED</span>}
          {entry.atsApplied && <span style={{ color: '#7ecee3' }}>ATS</span>}
          {entry.sceBannedWords > 0 && <span>w{entry.sceBannedWords}</span>}
          {entry.sceBannedPhrases > 0 && <span>p{entry.sceBannedPhrases}</span>}
        </span>
      </div>
      <span style={{ fontSize: 10, opacity: 0.5, alignSelf: 'flex-start' }}>
        {ageLabel(entry.ts, nowMs)}
      </span>
    </div>
  );
}
