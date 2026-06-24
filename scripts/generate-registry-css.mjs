#!/usr/bin/env node
// Generate pwa/antcv-packages-registry.css from packages/registry.json.
// Run with: node scripts/generate-registry-css.mjs
//
// Output is a single CSS file that lives in pwa/ alongside the vanilla
// files. index.html loads it via a <link> tag. Each package is a
// [data-package="..."] selector setting the CSS variables in §2.2 of
// the plan, derived from the locked tokens in §3.

import fs from 'node:fs';

const reg = JSON.parse(fs.readFileSync('packages/registry.json', 'utf8'));

const header = `/*
 * pwa/antcv-packages-registry.css — generated from packages/registry.json by
 * scripts/generate-registry-css.mjs. DO NOT EDIT BY HAND. Re-run the script
 * whenever the registry changes.
 *
 * Selector convention: body[data-package="<id>"]. Switching the attribute
 * swaps every visible colour in a single paint per plan §2.3.
 */
`;

const lines = [header];

// Universal defaults — locked-source globals that don't vary per package.
lines.push(':root {');
lines.push("  /* Universal text-on-light defaults (not per-package). */");
lines.push("  --main-text-color: #1F2937;");
lines.push("  --bullet-text-color: var(--main-text-color);");
lines.push("  --main-year-color: #6B7280;");
lines.push("  --achievement-marker-color: #16A34A;");
lines.push("  --warning-marker-color: #DC2626;");
lines.push("  --header-name-color: #FFFFFF;");
lines.push("  --table-odd-bg: #FFFFFF;");
lines.push("  --table-even-bg: #F7F9FB;");
lines.push('}');
lines.push('');

function blockFor(pkgId, pkg) {
  const out = [];
  out.push(`body[data-package="${pkgId}"] {`);
  out.push(`  /* ${pkg.displayName} — locked from Unified Visual doc */`);
  out.push(`  --package-base: ${pkg.base};`);
  out.push(`  --package-primary: ${pkg.primary};`);
  out.push(`  --package-interactive: ${pkg.interactive};`);
  out.push(`  --package-bullet: ${pkg.bullet};`);
  out.push(`  --package-glyph: ${pkg.glyph};`);
  out.push(`  --package-heading-font: '${pkg.headingFont}', system-ui, sans-serif;`);
  out.push(`  --package-body-font: '${pkg.bodyFont}', system-ui, sans-serif;`);
  out.push(`  --package-image-size: ${pkg.imageSize}px;`);
  out.push(`  --package-image-shape: ${pkg.shape};`);
  // Quick alternatives.
  out.push(`  --package-alt1-head: ${pkg.alt1.head};`);
  out.push(`  --package-alt1-sidebar: ${pkg.alt1.sidebar};`);
  out.push(`  --package-alt2-head: ${pkg.alt2.head};`);
  out.push(`  --package-alt2-sidebar: ${pkg.alt2.sidebar};`);
  // Dark-mode variants (referenced only inside @media (prefers-color-scheme: dark)).
  out.push(`  --package-dark-alt1-head: ${pkg.dark.alt1.head};`);
  out.push(`  --package-dark-alt1-sidebar: ${pkg.dark.alt1.sidebar};`);
  out.push(`  --package-dark-alt2-head: ${pkg.dark.alt2.head};`);
  out.push(`  --package-dark-alt2-sidebar: ${pkg.dark.alt2.sidebar};`);
  // Global semantic tokens — light-mode defaults derived from the package.
  out.push(`  --main-head-color: ${pkg.base};`);
  out.push(`  --main-bullet-color: ${pkg.bullet};`);
  out.push(`  --sidebar-bullet-color: ${pkg.bullet};`);
  out.push(`  --emoji-bullet-color: ${pkg.glyph};`);
  out.push(`  --main-line-color: ${pkg.primary};`);
  out.push(`  --main-sub-head-color: ${pkg.primary};`);
  out.push(`  --main-company-color: ${pkg.primary};`);
  out.push(`  --header-bg: ${pkg.base};`);
  out.push(`  --header-contact-color: ${pkg.primary};`);
  out.push(`  --sidebar-bg: ${pkg.alt2.sidebar};`);
  out.push(`  --sidebar-head-color: ${pkg.primary};`);
  out.push(`  --sidebar-text-color: var(--main-text-color);`);
  out.push(`  --table-header-bg: ${pkg.alt1.sidebar};`);
  out.push('}');
  out.push('');
  return out.join('\n');
}

for (const [id, pkg] of Object.entries(reg.packages)) {
  lines.push(blockFor(id, pkg));
}

// WITHIN-PACKAGE-STYLE-ALT-RECOLOR-001 (owner 2026-06-24): selecting a
// Quick Alternative (Alt 1 / Alt 2) sets body[data-package-quick-alt="altN"]
// but NO selector consumed it, so --header-bg stayed on the base value and the
// candidate band + table headers (both var(--header-bg)) never recoloured. Emit
// per-alt overrides: the 2-attribute selector outranks the 1-attribute base
// block, so the alt's head/sidebar win when its attribute is present. "default"
// has no attribute override → keeps the base block (unchanged).
for (const [id, pkg] of Object.entries(reg.packages)) {
  for (const alt of ['alt1', 'alt2']) {
    lines.push(`body[data-package="${id}"][data-package-quick-alt="${alt}"] {`);
    lines.push(`  /* ${pkg.displayName} — ${alt} head/sidebar pair (WITHIN-PACKAGE-STYLE-ALT-RECOLOR-001) */`);
    lines.push(`  --header-bg: ${pkg[alt].head};`);
    lines.push(`  --sidebar-bg: ${pkg[alt].sidebar};`);
    lines.push('}');
    lines.push('');
  }
}

// Dark-mode overrides per package. Plan §3 reserves dark-mode tokens for v1.52
// (Pass 5). We still emit the CSS so the values are available when the dark
// mode flag is wired; the selectors are gated by prefers-color-scheme so they
// have no effect today.
lines.push('@media (prefers-color-scheme: dark) {');
for (const [id, pkg] of Object.entries(reg.packages)) {
  lines.push(`  body[data-package="${id}"][data-dark-mode="active"] {`);
  lines.push(`    --main-head-color: ${pkg.dark.alt1.head};`);
  lines.push(`    --sidebar-bg: ${pkg.dark.alt2.sidebar};`);
  lines.push(`    --header-bg: ${pkg.dark.alt2.sidebar};`);
  lines.push('  }');
}
lines.push('}');
lines.push('');

const out = lines.join('\n');
fs.writeFileSync('pwa/antcv-packages-registry.css', out);
console.log('Wrote pwa/antcv-packages-registry.css —', out.length, 'bytes,', Object.keys(reg.packages).length, 'packages.');
