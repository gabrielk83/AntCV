import React from 'react';

// Read-only showcase of the seven section formats, mounted inside
// the first-run wizard's final slide (the language-slide modal).
//
// Phase A of the wizard step 10 React port (plan
// docs/plan/v1.50.37-wizard-step-10-scoping.md). This component is
// the smallest viable cut: visual-only, no storage writes, no event
// listeners. The vanilla wizard-language-slide-339.js sidecar
// retains ownership of the modal chrome, language picker, and the
// back/skip/continue buttons — we only replace the inner tile grid
// (lines 303-318 of the sidecar pre-v1.50.38).
//
// The tile content mirrors the vanilla FORMATS array verbatim so
// the visual output is indistinguishable from the legacy build at
// first paint.
//
// Why bother with a React island for a read-only grid:
//   1. Removes ~70 lines of DOM-building from the sidecar so the
//      next phases (language picker → modal chrome) shrink it
//      naturally.
//   2. Gives us a clean home for any future interactive variant
//      (Phase D — reuse SectionFormatPicker so users can set
//      per-section formats during onboarding).
//   3. Lets us bundle the format tile styles + microcopy with the
//      rest of the React-driven UI for consistency.

interface FormatTile {
  name: string;
  preview: React.ReactNode;
}

// Order, names, and preview content come from the legacy
// FORMATS constant in antcv-wizard-language-slide-339.js (v1.40.339-j
// lines 63-118). Reproducing them in JSX so React owns the markup.
const FORMATS: readonly FormatTile[] = [
  {
    name: 'Paragraph',
    preview: (
      <div style={{ fontSize: 8.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)' }}>
        Brief context line explaining the role&rsquo;s scope, then a continuation that flows naturally.
      </div>
    ),
  },
  {
    name: 'Bullets',
    preview: (
      <div style={{ fontSize: 9, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)' }}>
        &bull; Outcome one<br />
        &bull; Outcome two<br />
        &bull; Outcome three
      </div>
    ),
  },
  {
    name: 'Emoji bullets',
    preview: (
      <div style={{ fontSize: 9, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)' }}>
        ✨ Outcome one<br />
        ✅ Outcome two<br />
        📌 Outcome three
      </div>
    ),
  },
  {
    name: 'Hybrid 1',
    preview: (
      <div style={{ fontSize: 9, lineHeight: 1.45, color: 'rgba(255,255,255,0.78)' }}>
        <strong style={{ color: '#01B7BB' }}>Senior role</strong>
        <br />&bull; outcome
        <br />&bull; outcome
      </div>
    ),
  },
  {
    name: 'Hybrid 2',
    preview: (
      <div style={{ fontSize: 8.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.78)' }}>
        Brief intro line.
        <br />&bull; outcome
        <br />&bull; outcome
      </div>
    ),
  },
  {
    name: 'Hybrid 3',
    preview: (
      <div style={{ fontSize: 8.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)' }}>
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
];

export function WizardSectionShowcase(): JSX.Element {
  return (
    <div
      data-antcv-react-island="wizard-section-showcase"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))',
        gap: 6,
        marginBottom: 16,
      }}
    >
      {FORMATS.map((f) => (
        <div
          key={f.name}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            padding: '7px 8px',
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 5,
              letterSpacing: '0.2px',
            }}
          >
            {f.name}
          </div>
          <div
            style={{
              minHeight: 48,
              background: 'rgba(0,0,0,0.22)',
              borderRadius: 4,
              padding: '5px 6px',
              overflow: 'hidden',
            }}
          >
            {f.preview}
          </div>
        </div>
      ))}
    </div>
  );
}
