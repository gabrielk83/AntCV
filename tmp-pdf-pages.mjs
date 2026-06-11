/* tmp probe — per-page text of the owner's PDF to map break positions. */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const file = process.argv[2];
const doc = await getDocument({ url: file, useSystemFonts: true }).promise;
console.log('pages:', doc.numPages);
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  // group items into lines by y
  const lines = new Map();
  for (const it of tc.items) {
    const y = Math.round(it.transform[5]);
    const key = [...lines.keys()].find(k => Math.abs(k - y) <= 2) ?? y;
    lines.set(key, (lines.get(key) || '') + it.str);
  }
  const ordered = [...lines.entries()].sort((a, b) => b[0] - a[0]).map(e => e[1].trim()).filter(Boolean);
  console.log(`\n===== PAGE ${p} (${ordered.length} lines) =====`);
  for (const l of ordered.slice(0, 60)) console.log('  ' + l.slice(0, 110));
}
