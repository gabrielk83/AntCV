import React, { useState } from 'react';

// v1.50.533 — SECTION-FORMAT-LEGEND-001 (owner 2026-06-17): a single,
// read-only visual showing what each section format looks like. The SAME
// component renders in TWO places so they MIRROR each other:
//   - the onboarding wizard "Set your languages" slide
//     (src/islands/WizardSectionShowcase) and
//   - Settings → Layout (src/islands/LayoutPicker), above the per-section
//     format pickers.
// Previously the wizard had its own tile grid (and it wasn't mounting) and
// the Layout tab had NO visual at all — so the owner saw the graphic in
// neither surface. This is the shared source of truth.
//
// It also carries the new "Selected Outcomes" tile the owner asked for:
// outcomes can render either as a flat BULLET list, or as RESULTS dispersed
// per role (each outcome attributed under the role it came from).

export interface LegendTile {
  name: string;
  preview: React.ReactNode;
}

const tileText: React.CSSProperties = { fontSize: 9, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)' };

export const FORMAT_TILES: readonly LegendTile[] = [
  {
    name: 'Paragraph',
    preview: (
      <div style={{ ...tileText, fontSize: 8.5 }}>
        Brief context line explaining the role&rsquo;s scope, then a continuation that flows naturally.
      </div>
    ),
  },
  {
    name: 'Bullets',
    preview: (
      <div style={tileText}>
        &bull; Outcome one<br />
        &bull; Outcome two<br />
        &bull; Outcome three
      </div>
    ),
  },
  {
    name: 'Emoji bullets',
    preview: (
      <div style={tileText}>
        ✨ Outcome one<br />
        ✅ Outcome two<br />
        📌 Outcome three
      </div>
    ),
  },
  {
    name: 'Hybrid 1',
    preview: (
      <div style={{ ...tileText, lineHeight: 1.45 }}>
        <strong style={{ color: '#01B7BB' }}>Senior role</strong>
        <br />&bull; outcome
        <br />&bull; outcome
      </div>
    ),
  },
  {
    name: 'Hybrid 2',
    preview: (
      <div style={{ ...tileText, fontSize: 8.5, lineHeight: 1.5 }}>
        Brief intro line.
        <br />&bull; outcome
        <br />&bull; outcome
      </div>
    ),
  },
  {
    name: 'Hybrid 3',
    preview: (
      <div style={{ ...tileText, fontSize: 8.5 }}>
        Brief intro.{' '}
        <em style={{ color: '#01B7BB', fontStyle: 'normal' }}>item</em>,{' '}
        <em style={{ color: '#01B7BB', fontStyle: 'normal' }}>item</em>,{' '}
        <em style={{ color: '#01B7BB', fontStyle: 'normal' }}>item</em>
      </div>
    ),
  },
  {
    name: 'Table',
    preview: (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
          fontSize: 8.5,
          color: 'rgba(255,255,255,0.78)',
        }}
      >
        <div style={{ background: 'rgba(1,183,187,0.22)', padding: '3px 4px', borderRadius: 2 }}>Role</div>
        <div style={{ background: 'rgba(255,255,255,0.07)', padding: '3px 4px', borderRadius: 2 }}>Year</div>
        <div style={{ background: 'rgba(255,255,255,0.07)', padding: '3px 4px', borderRadius: 2 }}>Org</div>
        <div style={{ background: 'rgba(1,183,187,0.22)', padding: '3px 4px', borderRadius: 2 }}>Loc</div>
      </div>
    ),
  },
  {
    // OUTCOMES-LAYOUT-001 (owner 2026-06-17): the Selected Outcomes section
    // can render either as a flat bullet list OR as results dispersed per role.
    name: 'Outcomes: bullets vs results',
    preview: (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, fontSize: 8, color: 'rgba(255,255,255,0.78)' }}>
        <div>
          <div style={{ color: '#01B7BB', fontWeight: 700, marginBottom: 2 }}>Bullets</div>
          &bull; +32% revenue<br />
          &bull; Cut cost 18%<br />
          &bull; Shipped v2
        </div>
        <div>
          <div style={{ color: '#01B7BB', fontWeight: 700, marginBottom: 2 }}>Results / role</div>
          <strong style={{ color: 'rgba(255,255,255,0.9)' }}>PM, Acme</strong><br />
          +32% revenue<br />
          <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Lead, Beta</strong><br />
          Cut cost 18%
        </div>
      </div>
    ),
  },
];

function LegendGrid(): JSX.Element {
  return (
    <div
      data-antcv-section-format-legend="1"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))',
        gap: 6,
      }}
    >
      {FORMAT_TILES.map((f) => (
        <div
          key={f.name}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            padding: '7px 8px',
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', marginBottom: 5, letterSpacing: '0.2px' }}>
            {f.name}
          </div>
          <div style={{ minHeight: 48, background: 'rgba(0,0,0,0.22)', borderRadius: 4, padding: '5px 6px', overflow: 'hidden' }}>
            {f.preview}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface SectionFormatLegendProps {
  /** When true, renders a collapsible header (collapsed by default). */
  collapsible?: boolean;
  defaultOpen?: boolean;
  title?: string;
}

export function SectionFormatLegend({
  collapsible = false,
  defaultOpen = false,
  title = 'How each section can look',
}: SectionFormatLegendProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  if (!collapsible) return <LegendGrid />;
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open ? 'true' : 'false'}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 0 4px',
          background: 'transparent',
          border: 0,
          color: '#d7e6ee',
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          fontWeight: 700,
          fontSize: 11,
          opacity: 0.85,
        }}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span>{title}</span>
      </button>
      {open && (
        <div style={{ marginTop: 6 }}>
          <LegendGrid />
        </div>
      )}
    </div>
  );
}
