import React, { useCallback, useEffect, useState } from 'react';
import {
  PACKAGES,
  PACKAGE_IDS,
  type PackageId,
  type QuickAlt,
} from '../../lib/packages';
import {
  applyPackageToBody,
  readPackageState,
  writePackageState,
  type PackageState,
} from '../../lib/body-package';
import { NATIVE_SECTION_HEADER_STYLE } from '../../lib/settings-dom';

// Three-mode picker per plan §3.3:
//   - Package         (one of seven)
//   - Quick Alternative (within the active package: default / alt1 / alt2)
//   - Custom          (user-edited; persists only on explicit save)
//
// State is held in React; persisted to localStorage personalInfo on each
// selection AND broadcast via the antcv:package-changed event so the
// vanilla app.js sidecar can pick the change up.
//
// `context` controls which modes are exposed:
//   - 'personal' (legacy): all three modes incl. the 7-package grid.
//   - 'layout'   (v1.50.95): mounted under the native STYLE PACKAGE buttons,
//     which already own package SELECTION — so the redundant grid is hidden
//     and the card supplies only Quick-alt + Custom, defaulting to Quick-alt.

type Mode = 'package' | 'quickAlt' | 'custom';
type Context = 'personal' | 'layout';

interface Props {
  initialMode?: Mode;
  context?: Context;
}

// ─── small UI primitives ─────────────────────────────────────────────────

function Swatch({ color, size = 18, ring = false }: { color: string; size?: number; ring?: boolean }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 4,
        background: color,
        boxShadow: ring ? '0 0 0 2px rgba(255,255,255,0.6), 0 0 0 4px rgba(1,183,187,.45)' : '0 0 0 1px rgba(0,0,0,0.18)',
      }}
    />
  );
}

// v1.50.28 — visual preview of the package's photo shape. Each
// package's registry.json `shape` field is one of:
//   circle, rounded, rounded-square, square, hexagon
// The svg silhouette is rendered next to the colour swatches so
// users can see the photo treatment at a glance without scanning
// the meta line. Falls back to a circle for unrecognised shapes.
function ShapePreview({ shape, color, size = 18 }: { shape: string; color: string; size?: number }): JSX.Element {
  const half = size / 2;
  const stroke = color;
  const fill = 'rgba(255,255,255,.08)';
  const common = { fill, stroke, strokeWidth: 1.5 };
  let inner: JSX.Element;
  switch (shape) {
    case 'square':
      inner = <rect x={1} y={1} width={size - 2} height={size - 2} {...common} />;
      break;
    case 'rounded-square':
      inner = <rect x={1} y={1} width={size - 2} height={size - 2} rx={3} ry={3} {...common} />;
      break;
    case 'rounded':
      inner = <rect x={1} y={1} width={size - 2} height={size - 2} rx={half / 1.7} ry={half / 1.7} {...common} />;
      break;
    case 'hexagon': {
      // Regular hexagon with flat top/bottom, centred at (half, half).
      const r = half - 1.5;
      const cx = half;
      const cy = half;
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6; // pointy top
        pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
      }
      inner = <polygon points={pts.join(' ')} {...common} />;
      break;
    }
    case 'circle':
    default:
      inner = <circle cx={half} cy={half} r={half - 1.5} {...common} />;
      break;
  }
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'inline-block', flex: '0 0 auto' }}
    >
      {inner}
    </svg>
  );
}

function PackageCard({
  id,
  active,
  onSelect,
}: {
  id: PackageId;
  active: boolean;
  onSelect: (id: PackageId) => void;
}): JSX.Element {
  const pkg = PACKAGES[id];
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={active}
      data-antcv-package-card={id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 10,
        textAlign: 'left',
        background: active ? 'rgba(1,183,187,.12)' : 'rgba(255,255,255,.04)',
        border: '1px solid ' + (active ? 'rgba(1,183,187,.55)' : 'rgba(255,255,255,.14)'),
        borderRadius: 10,
        cursor: 'pointer',
        color: '#e6eef3',
      }}
    >
      <span style={{ fontWeight: 700, letterSpacing: '.02em' }}>{pkg.displayName}</span>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <Swatch color={pkg.base} />
        <Swatch color={pkg.primary} />
        <Swatch color={pkg.interactive} />
        <Swatch color={pkg.bullet} />
        <Swatch color={pkg.glyph} />
        <span style={{ width: 4 }} />
        <ShapePreview shape={pkg.shape} color={pkg.primary} />
      </span>
      <span style={{ fontSize: 11, opacity: 0.7 }}>
        {pkg.headingFont.replace(/ Bold$/, '')} · {pkg.shape} · {pkg.imageSize}px
      </span>
    </button>
  );
}

// ─── main component ──────────────────────────────────────────────────────

export function PackagePicker({ initialMode, context = 'personal' }: Props): JSX.Element {
  const isLayout = context === 'layout';
  // In Layout the native STYLE PACKAGE buttons own selection, so the package
  // grid is dropped and Quick-alt is the landing mode.
  const modes: Mode[] = isLayout ? ['quickAlt', 'custom'] : ['package', 'quickAlt', 'custom'];
  const [mode, setMode] = useState<Mode>(initialMode ?? (isLayout ? 'quickAlt' : 'package'));
  const [state, setState] = useState<PackageState>(() => readPackageState());

  // Cross-tab + external sync.
  useEffect(() => {
    const refresh = () => setState(readPackageState());
    window.addEventListener('antcv:package-changed', refresh);
    window.addEventListener('storage', (ev: StorageEvent) => {
      if (ev.key === 'personalInfo') refresh();
    });
    return () => {
      window.removeEventListener('antcv:package-changed', refresh);
    };
  }, []);

  const selectPackage = useCallback((id: PackageId) => {
    const next = writePackageState({ packageId: id, quickAlt: 'default', isCustom: false });
    setState(next);
    applyPackageToBody(next);
  }, []);

  const selectQuickAlt = useCallback((alt: QuickAlt) => {
    // §3.3: "Quick alternative within package → not Custom."
    const next = writePackageState({ quickAlt: alt, isCustom: false });
    setState(next);
    applyPackageToBody(next);
  }, []);

  const pkg = PACKAGES[state.packageId];

  return (
    <section
      data-antcv-react-island="package-picker"
      style={{
        marginTop: isLayout ? 8 : 16,
        borderTop: '1px dashed rgba(255,255,255,.14)',
        paddingTop: isLayout ? 6 : 10,
        color: '#d7e6ee',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span style={{ ...NATIVE_SECTION_HEADER_STYLE }}>
          {isLayout ? 'Within-package style' : 'Visual package'}
        </span>
        {state.isCustom && (
          <span
            data-antcv-custom-flag="1"
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(217,164,65,.22)',
              border: '1px solid rgba(217,164,65,.55)',
              color: '#fde9c6',
            }}
            title="Your style has overrides outside the active package"
          >
            Custom
          </span>
        )}
      </div>

      {isLayout ? (
        // The native STYLE PACKAGE buttons above already own package
        // selection AND expose the ready-made quick-alternatives (the colour
        // pairs shown on each button). This card must NOT re-implement that
        // selector — it only explains the two within-package behaviours.
        <LayoutNotes packageName={pkg.displayName} isCustom={state.isCustom} />
      ) : (
        <>
          <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 8,
                  background: mode === m ? 'rgba(1,183,187,.16)' : 'transparent',
                  border: '1px solid ' + (mode === m ? 'rgba(1,183,187,.55)' : 'rgba(255,255,255,.14)'),
                  color: '#e6eef3',
                  cursor: 'pointer',
                  fontWeight: mode === m ? 700 : 500,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                }}
              >
                {m === 'package' ? 'Package' : m === 'quickAlt' ? 'Quick alt.' : 'Custom'}
              </button>
            ))}
          </div>

          {mode === 'package' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))',
                gap: 8,
              }}
            >
              {PACKAGE_IDS.map((id) => (
                <PackageCard key={id} id={id} active={!state.isCustom && id === state.packageId} onSelect={selectPackage} />
              ))}
            </div>
          )}

          {mode === 'quickAlt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                Within the selected visual style (<strong>{pkg.displayName}</strong>). Two ready-made head/sidebar pairs are part of the package — picking one does not switch to Custom.
              </span>
              {(['default', 'alt1', 'alt2'] as QuickAlt[]).map((alt) => {
                const isActive = state.quickAlt === alt && !state.isCustom;
                const head = alt === 'default' ? pkg.primary : alt === 'alt1' ? pkg.alt1.head : pkg.alt2.head;
                const sidebar = alt === 'default' ? pkg.base : alt === 'alt1' ? pkg.alt1.sidebar : pkg.alt2.sidebar;
                const label = alt === 'default' ? 'Default' : alt === 'alt1' ? 'Alt 1' : 'Alt 2';
                return (
                  <button
                    key={alt}
                    type="button"
                    onClick={() => selectQuickAlt(alt)}
                    aria-pressed={isActive}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: isActive ? 'rgba(1,183,187,.14)' : 'rgba(255,255,255,.04)',
                      border: '1px solid ' + (isActive ? 'rgba(1,183,187,.55)' : 'rgba(255,255,255,.14)'),
                      color: '#e6eef3',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Swatch color={head} ring={isActive} />
                    <Swatch color={sidebar} />
                    <span style={{ fontWeight: 650 }}>{label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.65 }}>
                      {head} / {sidebar}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {mode === 'custom' && (
            <CustomPanel state={state} onChange={setState} />
          )}
        </>
      )}
    </section>
  );
}

// Explanation-only body for the Layout subtab. No selectors — the native
// STYLE PACKAGE buttons own selection and quick-alternatives.
function LayoutNotes({ packageName, isCustom }: { packageName: string; isCustom: boolean }): JSX.Element {
  const strong: React.CSSProperties = { color: '#cfe3ea', fontWeight: 650 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, lineHeight: 1.4, opacity: 0.7 }}>
      <p style={{ margin: 0 }}>
        <span style={strong}>Quick alt:</span> ready-made colour pairs within {packageName} — stays on the package.
      </p>
      <p style={{ margin: 0 }}>
        <span style={strong}>Custom:</span> set automatically when you edit beyond the package&rsquo;s range.
      </p>
      {isCustom && (
        <p style={{ margin: 0, opacity: 0.85 }}>
          Now <strong>Custom</strong> — overrides outside {packageName}.
        </p>
      )}
    </div>
  );
}

// ─── custom panel (separate so it can grow independently) ────────────────

function CustomPanel({
  state,
  onChange,
}: {
  state: PackageState;
  onChange: (next: PackageState) => void;
}): JSX.Element {
  const exitCustom = useCallback(() => {
    const next = writePackageState({ isCustom: false, packageId: state.packageId, quickAlt: state.quickAlt });
    onChange(next);
    applyPackageToBody(next);
  }, [onChange, state.packageId, state.quickAlt]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
      {!state.isCustom && (
        <p style={{ opacity: 0.7, margin: 0 }}>
          No custom overrides yet. Your CV uses the <strong>{PACKAGES[state.packageId].displayName}</strong> package.
          Custom mode activates automatically when you pick a colour off the package palette, switch to a restricted
          font, or change an image setting outside the package. Refreshing without saving discards custom edits.
        </p>
      )}
      {state.isCustom && (
        <>
          <p style={{ opacity: 0.85, margin: 0 }}>
            Your style currently has overrides outside <strong>{PACKAGES[state.packageId].displayName}</strong>.
            The colour and font picker controls in this Settings panel modify these overrides. Save explicitly to
            persist them across reloads.
          </p>
          <button
            type="button"
            onClick={exitCustom}
            style={{
              alignSelf: 'flex-start',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(255,255,255,.05)',
              border: '1px solid rgba(255,255,255,.18)',
              color: '#e6eef3',
              cursor: 'pointer',
              fontWeight: 650,
            }}
          >
            Reset to {PACKAGES[state.packageId].displayName} defaults
          </button>
        </>
      )}
      <p style={{ opacity: 0.55, fontSize: 11, margin: 0 }}>
        Custom-mode font / colour / image pickers are owned by the existing Appearance controls and integrate with
        this state in v1.50.1. See <code>docs/qa/pass2-status-report.md</code>.
      </p>
    </div>
  );
}
