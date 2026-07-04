// section-title-in-editor.test.mjs
// ============================================================
// SECTION-TITLE-IN-EDITOR-001 (owner 2026-07-05): "make the section title editable
// inside the detailed editor" + a click on the panel title should OPEN the editor,
// not inline-edit it. So: (1) the rich-block editor gains a "Section heading" field;
// (2) the panel-row rich_block title is no longer contentEditable and its click
// opens the editor. Both bundles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const srcSource = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const srcMin = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
const rbe = await readFile(new URL('../../antcv-rich-block-editor.js', import.meta.url), 'utf8');

test('the rich-block detailed editor now has a Section heading title field', () => {
  assert.ok(/SECTION-TITLE-IN-EDITOR-001/.test(rbe), 'the marker comment is present');
  assert.ok(/placeholder:\s*"Section heading"/.test(rbe), 'a Section heading input exists');
  assert.ok(/d\(\{\s*title:\s*x\.target\.value\s*\}\)/.test(rbe), 'the input writes section.title via update');
  assert.ok(/titleField,\s*bar,\s*rowEls/.test(rbe), 'the title field is the first element of the editor');
});

test('the panel-row title is no longer inline-editable (click-thief removed), both bundles', () => {
  assert.ok(!srcSource.includes('Click to rename this section heading'), 'source: old inline-rename title gone');
  assert.ok(!srcMin.includes('Click to rename this section heading'), 'minified: old inline-rename title gone');
  assert.ok(srcSource.includes('Click to open the section editor (rename the heading inside it)'), 'source: new click-to-open title');
  assert.ok(srcMin.includes('Click to open the section editor (rename the heading inside it)'), 'minified: new click-to-open title');
});

test('the panel title click opens the editor (both bundles)', () => {
  // source: onClick stops propagation then opens via d(e.id)
  assert.ok(/title: "Click to open the section editor[^"]*",\s*onClick: \(ev\) => \{\s*ev\.stopPropagation\(\);\s*d\(e\.id\);/.test(srcSource),
    'source onClick opens the editor');
  // minified: onClick:ev=>{ev.stopPropagation();l(e.id)}
  assert.ok(srcMin.includes('onClick:ev=>{ev.stopPropagation();l(e.id)}'), 'minified onClick opens the editor');
});
