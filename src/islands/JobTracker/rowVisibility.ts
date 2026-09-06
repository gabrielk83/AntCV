// JOBLIST-FILTER-002 — which rows the Job List shows, as pure logic.
//
// Standalone and import-free on purpose, so Node's type-stripping loader can
// import it directly in a unit test (same constraint as top5controls.ts). Rows
// are typed structurally rather than as the `Row` tuple from api.ts, which would
// drag the whole module graph in.
//
// THE BUG THIS FIXES (owner, 2026-08-26): the legend filter gated only on the
// row's BAND, so a row whose TRACKED STATUS said "Archive / closed" but which
// still carried its original T1 band stayed at the top of the list with the
// Archive swatch unchecked. Setting the status from the dropdown — which is what
// the owner does by hand, and what an older archive pass did — never touches the
// band, so band alone was never a sound test for "is this row closed".
//
// Closed-ness is now decided the same way Top-5 already decided it (isClosedRow),
// and every row falls into EXACTLY ONE bucket, so exactly one checkbox governs it
// and ticking that box always reveals it:
//
//   'rejected' → the tracked status says rejected/declined      → ⛔ Rejected box
//   'archive'  → otherwise closed: D9D9D9 band, an archive/
//                closed/withdrawn status, or a "Dropped (…)" flag → Archive box
//   null       → live; governed by its tier band, as before
//
// Precedence matters: isClosedRow() matches "rejected" too, so 'rejected' is
// tested FIRST or a rejected row would be swallowed by the Archive box and the
// ⛔ checkbox would appear to do nothing.
//
// JOBLIST-FILTER-003 (owner, 2026-09-06): the SAME bug on the "In progress"
// swatch. It gated on the FFF2CC band only, but a row marked Submitted /
// Interview / Offer from the tracked-status dropdown keeps its T1/T2/T3 band, so
// unticking "In progress" hid nothing. A live row is now bucketed 'progress'
// when its band is FFF2CC OR its tracked status says it has been sent off, and
// that bucket answers ONLY to the In-progress swatch (not to its tier band).
// Pre-submission statuses (CV/CL drafting, drafted) stay tier-governed: nothing
// has left the building yet.

export type VisRow = readonly (string | number | null | undefined)[];

const TRACKED = 8;   // tracked status
const FLAG = 10;     // free-text flag / note
const BAND = 12;     // tier band hex

const cell = (r: VisRow, i: number): string => String((r && r[i]) || '');

export const ARCHIVE_BAND = 'D9D9D9';
export const PROGRESS_BAND = 'FFF2CC';

/** Tracked status reads as a rejection. */
export function isRejectedRow(r: VisRow): boolean {
  return /\b(rejected|declined)\b/i.test(cell(r, TRACKED));
}

/**
 * TOP5-REFILL-001 predicate, moved here so the list filter and the Top-5 panel
 * cannot drift apart. Closed = the archive band, an archived/rejected/withdrawn
 * tracked status, or a "Dropped (…)" flag written by dropFromTop5.
 */
export function isClosedRow(r: VisRow): boolean {
  return cell(r, BAND).toUpperCase() === ARCHIVE_BAND
    || /rejected|archive|closed|withdrawn/i.test(cell(r, TRACKED))
    || /^\s*dropped\b/i.test(cell(r, FLAG));
}

/** The one bucket this row belongs to, or null when it is live. */
export function closedBucket(r: VisRow): 'rejected' | 'archive' | null {
  if (isRejectedRow(r)) return 'rejected';
  return isClosedRow(r) ? 'archive' : null;
}

/**
 * JOBLIST-FILTER-003: the application has been sent off — the FFF2CC band, or a
 * tracked status of Submitted / Applied / Interview / Offer. Closed-ness is NOT
 * tested here; callers go through visBucket(), which tests closed first.
 */
export function isInProgressRow(r: VisRow): boolean {
  return cell(r, BAND).toUpperCase() === PROGRESS_BAND
    || /\b(submitted|applied|interview(ing|s)?|offer(ed)?)\b/i.test(cell(r, TRACKED));
}

/** Every legend bucket, closed ones first; null = governed by its tier band. */
export function visBucket(r: VisRow): 'rejected' | 'archive' | 'progress' | null {
  const closed = closedBucket(r);
  if (closed) return closed;
  return isInProgressRow(r) ? 'progress' : null;
}

/**
 * The tier/closed half of the legend filter — the half that was broken. The
 * ★/✅/⏰ narrowing toggles stay in the island; they only ever subtract, and
 * they were already correct.
 *
 * `bands` holds the SHOWN tier swatches. A band that is not one of the five
 * known swatches always shows: there is no legend item to hide it by.
 */
export function passesTierFilter(
  r: VisRow,
  bands: ReadonlySet<string> | readonly string[],
  showRejected: boolean,
  knownBands: readonly string[],
): boolean {
  const has = (b: string): boolean =>
    Array.isArray(bands) ? bands.indexOf(b) !== -1 : (bands as ReadonlySet<string>).has(b);
  const bucket = visBucket(r);
  if (bucket === 'rejected') return !!showRejected;
  if (bucket === 'archive') return has(ARCHIVE_BAND);
  if (bucket === 'progress') return has(PROGRESS_BAND);
  const band = cell(r, BAND).toUpperCase();
  if (knownBands.indexOf(band) !== -1 && !has(band)) return false;
  return true;
}
