# Design packages

AntCV ships with seven visual packages. Each one controls the look of the document: colors, fonts, photo shape, sidebar placement, page rhythm. The package does **not** decide what the words say — that is set separately by the writing style. The two work together but independently, so any combination of style and package is valid.

You pick a package when you start an application. You can change it later without losing a word of your content.

## The 30-second guide

If you want to decide quickly:

- Applying broadly across European and global commercial roles → **Copenhagen Modern** (the default)
- Senior commercial role in finance, consulting, executive search → **Navy Executive**
- Humanities, creative industries, education, NGOs → **Warm Terracotta**
- Nordic-region applications, public sector, healthcare → **Nordic Frost**
- LATAM applications, narrative-leaning roles → **Pampas Contemporary**
- Engineering, research, technical product management with a lot of content to fit → **Tokyo Precision**
- Applied science, technical academic, engineering → **Delhi Technical**

If a package's typical context fits, use it. If two seem to fit, the one you find easier to read is probably the better pick.

## The seven packages

### Copenhagen Modern

The AntCV default. Navy header band with green and blue accents. Segoe UI Bold headings and Segoe UI body — a unified modern Microsoft system font family. Circular photo.

Visually it reads as calm, contemporary, slightly Nordic but globally readable. Recruiters in most regions and industries find it easy to skim. It is the safest first pick when no specific cultural or industry signal points elsewhere.

### Navy Executive

Deep navy with a gold accent. Cambria Bold headings and Cambria body — a full-serif executive document. Rounded photo.

This package signals seniority and formality. The serif typography reads as institutional rather than startup-modern. Good for finance, management consulting, executive search, board roles, and senior commercial positions where the reader expects a polished, careful document.

### Warm Terracotta

Earthy terracotta with a deep brown accent. Georgia Bold headings, Palatino Linotype body — warm serif character throughout. Rounded photo, slightly larger than other packages.

Less corporate, more human. The colour palette and the rounded photo together pull the document away from the navy-and-grey baseline that most CVs share. Good for humanities, education, NGOs, communications, sustainability, design and creative roles, and any role where the reader expects warmth alongside competence.

### Nordic Frost

Cool blue with a teal accent. Trebuchet MS Bold headings, Verdana body — humanist sans designed for screen reading. Circular photo.

Calm and clean. The cool palette and the screen-friendly body font read well in public-sector and healthcare contexts where the reader is busy and wants the document to step out of the way. Strong choice for Nordic-region applications including Danish municipal roles, hospital systems, and regulated environments.

### Pampas Contemporary

Navy with a terracotta accent. Palatino Linotype Bold headings and Palatino Linotype body — classical executive feel. Rounded-square photo.

Designed for LATAM applications and roles where a more narrative writing style works. The navy keeps the document professional; the terracotta accent adds enough warmth to soften the formality. Pairs naturally with the Context Rich and Mediterranean Formal writing styles.

### Tokyo Precision

Charcoal with a cool grey-blue accent. Tahoma Bold headings and Tahoma body — geometric coherence. Square photo, smaller than other packages at 90 pixels.

Built for dense-information roles. The smaller photo and the geometric typography free up space for content. Good for engineering, research, technical product management, scientific roles, and any application where you have substantial bullet-point content and want to fit it cleanly in 1.5 to 2 pages.

### Delhi Technical

Navy with teal and bright teal accents. Segoe UI Bold headings and Segoe UI body — modern technical feel. Hexagon or square photo, also small at 85 pixels.

A technical-academic package. The hexagon photo and the bright teal accent give it personality beyond a standard navy-and-white template, but the underlying typography stays clean. Strong choice for applied science, engineering, technical academic positions, PhD applications in applied fields, and engineering management roles.

## Picking the right one

Three rough heuristics that work in practice:

**By region.** Copenhagen Modern works almost anywhere. Nordic Frost reads particularly well in the Nordic public sector and healthcare. Pampas Contemporary is built for LATAM. Warm Terracotta works well in European humanities and NGO contexts. Navy Executive reads as international corporate.

**By seniority.** Junior and mid-level roles can use any package; Copenhagen Modern is the safest default. Senior commercial roles benefit from Navy Executive's formality. Director and above tend to look right in Navy Executive or a sober Copenhagen Modern. Technical seniority (lead engineer, principal scientist) reads cleanly in Tokyo Precision or Delhi Technical.

**By role type.** Engineering and research → Tokyo Precision or Delhi Technical. Finance, consulting, executive → Navy Executive. Creative, education, NGO → Warm Terracotta. Generalist commercial → Copenhagen Modern. Public sector and healthcare → Nordic Frost. LATAM hybrid roles → Pampas Contemporary.

If two packages both seem to fit, pick the one that feels easier to read at a glance. The reader will react to readability before they react to anything else.

## Changing your mind

You can switch packages at any point during an application. Your content stays the same; only the visual treatment changes. AntCV reflows the document and re-renders the preview. If a section was sized for one package and now overflows in the new one, AntCV flags it and lets you compress or expand.

## Parser compatibility

All seven packages produce documents that pass modern ATS parsers (Greenhouse, Lever, Ashby, modern Workday, SmartRecruiters, BambooHR). The body fonts chosen per package are Microsoft and Apple system fonts with mature parser support and PDF embedding for cross-device rendering.

If you are applying through a legacy system (Taleo, iCIMS, older corporate portals from large healthcare or government employers), tell AntCV in the application setup and it switches to ATS-Legacy mode. In Legacy mode:

- The photo is omitted
- The sidebar content moves into the main column
- Tables become bulleted lists with em-dash separators
- The body font is replaced with Calibri throughout

Your content is not rewritten — only re-formatted. The package's colour palette and heading font are preserved where possible. Section names normalise to the canonical set (Summary, Skills, Work Experience, Education, Certifications, Publications, Additional Information).

## Accessibility

Each package is tested for adequate contrast between text and background (WCAG 2.2 AA at minimum, AAA where the typography allows). The structural elements (headings, bullets, tables) carry semantic markup in the exported DOCX so screen readers can navigate them. PDFs are produced with selectable text, not as flattened images.

## Behind the scenes

If you want to read the implementation reference, see `skills/antcv-writer/references/design-packages.md` in this repository. That document is the contract the skill follows when generating package-aware content. This page is the human-facing version.
