import React from 'react';
import { SectionFormatLegend } from '../shared/SectionFormatLegend';

// Read-only showcase of the section formats, mounted inside the first-run
// wizard's final slide (the language-slide modal).
//
// v1.50.533 — the tile content now lives in the SHARED SectionFormatLegend
// (src/islands/shared/SectionFormatLegend.tsx) so the wizard and the
// Settings → Layout tab render the SAME visual (owner: "the visual is not
// seen in either the wizard nor settings" + add the Selected-Outcomes
// bullets-vs-results tile). This component is just the wizard's anchor for
// that shared legend; the sidecar still owns the modal chrome + heading.
export function WizardSectionShowcase(): JSX.Element {
  return (
    <div data-antcv-react-island="wizard-section-showcase" style={{ marginBottom: 16 }}>
      <SectionFormatLegend />
    </div>
  );
}
