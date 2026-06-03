# Writing styles

A writing style decides how AntCV sounds, not how it looks. The visual side is controlled by your package choice; the style controls sentence length, bullet shape, the kind of evidence emphasised, the register, and the tone.

AntCV ships with twelve writing styles. You pick one at the start of an application and can change it later. Changing the style does not change the underlying facts of your CV — only the way they are presented.

## The 30-second guide

If you want to pick fast:

- Most European and global commercial applications → **Measured Professional** or **Nordic Minimal**
- Outcome-heavy senior roles where results matter most → **Achievement-Driven**
- Operations, quality, compliance, process-driven roles → **Structured Professional**
- LATAM and southern European commercial applications → **Mediterranean Formal**
- Senior consulting, finance, executive search → **Prestige Structured**
- Roles where certifications matter as much as experience → **Credential Forward**
- Technical roles where exact numbers signal expertise → **Precision Formal**
- Humanities, education, NGOs, communications → **Context Rich**
- Cold outreach to a company with no open role → **Cold Outreach**
- PhD applications, postdoc applications, faculty applications → **Research Formal**
- Industry-academic transition or hybrid commercial-creative → **Hybrid Balanced**

If two styles seem to fit, pick the one whose voice feels closer to how you would write a careful email. That voice is easier to maintain when you edit afterwards.

## The twelve styles

### Nordic Minimal

Restrained, factual, short sentences. Says less and says it clearly. No filler, no qualifiers, no warm-up phrases. Bullets are short and end with a concrete result.

Default register for Nordic-region applications, especially Danish, Swedish, Norwegian and Finnish commercial roles. Works anywhere a reader values restraint over polish.

### Achievement-Driven

Outcomes first. Each bullet leads with what changed because of you, then names what you did to make that change. Numbers and measurable examples are used wherever they are real and defensible.

Good for senior commercial roles, sales, product management, anywhere a reader scans for impact before scanning for responsibilities. Works less well for roles where what you did matters more than what changed (early-career, process roles, research before publication).

### Measured Professional

Calm and certain. Concrete actions described in plain language with measurable examples when they are available. Neither outcome-first nor process-first; the bullet leads with what is most relevant to the specific role.

The safest default for most commercial applications. If a style does not jump out as the right pick, Measured Professional usually works.

### Structured Professional

Process-led. Bullets describe what you owned, the method or framework you used, and the outcome. Headings emphasise responsibility scope. Reads as disciplined rather than impact-forward.

Good for operations, quality, compliance, regulatory, change governance, project management, anywhere the reader is checking whether you can run a structured process rather than whether you delivered a hit metric.

### Mediterranean Formal

Warmer than Nordic Minimal, more relational, slightly longer sentences. Still formal — the warmth is in tone, not informality. Sentences acknowledge context and people more than the Nordic register would.

Good for southern European applications (Spain, Italy, Portugal, Greece) and LATAM commercial roles. Reads as careful and professional without sounding distant.

### Prestige Structured

Institutional weight. Polished, careful, slightly more formal vocabulary. Bullets reference scope (revenue, headcount, geographic remit) where applicable. Bullets are slightly longer than other styles to carry that weight.

Good for senior consulting (McKinsey, BCG, Bain tier), senior finance (banking, private equity, asset management), executive search, board advisory roles. Works less well for technical or operational roles where the vocabulary reads as overdressed.

### Credential Forward

Credentials and certifications surfaced early and given visual prominence. Bullets reference qualifications, accreditations, and named methodologies (ISO standards, Six Sigma levels, ASPICE assessor levels, regulatory certifications).

Good for regulated industries (medical devices, automotive functional safety, pharmaceutical quality, financial compliance), academic-adjacent technical roles, and any role where the reader is partly buying your accreditations.

### Precision Formal

Engineering and technical register. Specifications, ranges, exact numbers. "Reduced cycle time by 18%" rather than "significantly reduced cycle time". Technical vocabulary used precisely where it is the right vocabulary.

Good for hardware engineering, software engineering at senior levels, scientific roles, technical product management of complex systems, applied research in industry. Signals expertise through precision rather than through claims.

### Context Rich

Narrative voice. Slightly longer paragraphs in the profile section, sentence-shaped bullets rather than fragment-shaped ones. Reads as a thinking, written document rather than a list of accomplishments.

Good for humanities, education, NGO, sustainability, communications, policy, journalism-adjacent roles. Also fits transitions where the why behind a career move needs space to land.

### Cold Outreach

Designed for cold outreach to a company with no open role, not for replies to a posted JD. Shorter than other styles. Speculative and possibility-led: what you might do for them, framed as a conversation opener rather than a credential dump.

Use this when reaching out about roles that have not been advertised, or when introducing yourself to a small company where you would prefer to start a conversation before they write a job description.

### Research Formal

Academic register. Research questions, contributions, methods, publications. Bullets describe research outputs rather than commercial outcomes. Publications and grants are emphasised in the layout.

Good for PhD applications, postdoc applications, faculty applications, research scientist roles in industry, and any context where a hiring committee is reading for academic rigor rather than commercial impact.

### Hybrid Balanced

Bridges two registers. Carries some structure of the commercial styles and some of the narrative weight of Context Rich or the academic emphasis of Research Formal, depending on context. The skill detects which two registers to bridge based on the job description.

Good for industry-academic transitions (postdoc moving to industrial research, scientist moving to product management at a deep-tech company), applied research at corporate labs, and hybrid creative-commercial roles.

## How style and package work together

Style decides voice; package decides look. They are independent — any of the twelve styles can pair with any of the seven packages, giving 84 combinations. The PWA suggests pairings during onboarding (for example, Achievement-Driven naturally pairs with Navy Executive or Tokyo Precision), but the suggestions are nudges, not constraints.

If you change the style, the package stays. If you change the package, the style stays. Your content stays in both cases.

## What changes when you switch style

A few visible things happen when you switch from one style to another on an existing application:

- **Bullet shape**: some styles use sentence-shape bullets, others use fragment-shape. The skill rewrites accordingly.
- **Sentence length**: Nordic Minimal trims; Context Rich expands; Prestige Structured holds steady.
- **Profile paragraph length**: ranges from short (Nordic Minimal, Cold Outreach) to longer (Context Rich, Hybrid Balanced).
- **Density**: some styles support more bullets per role; others trim to the most relevant three.
- **Vocabulary**: register shifts. "Owned" might become "led" or "set up", depending on the style.
- **Order of evidence inside a bullet**: outcome-first vs method-first vs context-first.

Your facts do not change. The skill does not invent or remove items from your career history. Only how each item is presented changes.

## Job description signals

The PWA reads the job description before generation and may suggest a style switch. For example:

- JD heavy on "lead the function", "scale the team", "set strategy" → Achievement-Driven or Measured Professional
- JD emphasising "framework", "process", "governance", "controls" → Structured Professional
- JD listing required certifications prominently → Credential Forward
- JD with academic vocabulary (publications, principal investigator, grant) → Research Formal
- JD from a research-heavy company without strict academic framing → Hybrid Balanced

The suggestion is a nudge. You can accept it, ignore it, or change to a style the skill did not suggest. The PWA logs your decision so future suggestions for similar JDs get better.

## Banned words and phrases

Across every style, AntCV avoids a list of words and phrases that read as filler in professional writing. These include "spearhead", "leverage", "ensure", "robust", "comprehensive", "cutting-edge", "world-class", "passionate", "proven track record", "strong communicator", "results-driven", and roughly forty more. The list is enforced by the validation engine; if a generated bullet contains one of them, the skill retries with a stricter prompt.

You can see the full list in the implementation reference. The intent is not to police your voice — it is to remove the words that have become invisible through overuse.

## Behind the scenes

The implementation reference lives at `skills/antcv-writer/references/style-matrix.md` and the per-style files at `skills/antcv-writer/references/styles/{name}.md`. Those documents are the contract the skill follows when generating style-aware content. This page is the human-facing version.
