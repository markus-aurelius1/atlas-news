/**
 * The PYQ ledger: one entry per previous-year question appearance that names
 * a place, built with Q() from ../dsl.mjs. Split by exam; add a file and list
 * it here.
 *
 * Rules
 * - Every entry cites where it was read: `source: { title, url }`, a web page
 *   or `pdf:<file>#p<page>` for a question paper (PDF page number, 1-based).
 * - Record only what the source shows (exam, year, the question). Never fill
 *   years or appearances from memory. A question tagged with several papers
 *   is one entry per paper.
 * - Name places by id (`in.lake.chilika-lake`) or by name/alias; the build
 *   reports names it cannot match. Add the place (content/*.mjs, with `src`)
 *   or an `aka`, or list the name with a reason in ./not-mapped.mjs. Settle
 *   ambiguous names with `{ name, kind, state }`.
 *
 * Sources transcribed (M7, 2026-09): the user's PDFs, kept in pyq-sources/ at
 * the repo root and not committed (copyrighted compilations):
 * - "UPPSC 1990-2026 Papers - Geography.pdf" and "… - Uttar Pradesh Special.pdf"
 *   → ./uppsc.mjs
 * - "ToolkitGeoOCRed.pdf" (ForumIAS PYQ Workbook of General Geography, 2nd ed.,
 *   UPSC CSE sections only) → ./upsc-prelims.mjs
 *
 * Also supplied but not yet transcribed (web pages; see docs/HANDOFF.md):
 * - https://www.pmfias.com/category/prelims/protected-area-network/
 * - https://www.pmfias.com/category/upsc-cse-prelims-pyqs/prelims-pyqs-geography/prelims-pyqs-mapping/ (+ /page/N/)
 * - https://thedistrictminds.com/UPPSC_PYQs_Analysis_District_Minds.html
 * - https://superkalam.com/upsc-preparation/resources/upsc-map-based-pyqs-2015-2025-practice-map-questions
 */
import upscPrelims from './upsc-prelims.mjs'
import uppsc from './uppsc.mjs'

export default [...upscPrelims, ...uppsc]
