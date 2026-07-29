# WHY-JOINED-SENTENCE-001 - truth table for the WHY-section gate.
# Run: python scripts/job-tracker/test_why_gate.py   (exit 0 = pass)
#
# The rule: every sentence in the cover letter's WHY section must JOIN the
# employer to the CANDIDATE inside that same sentence. The detector encodes it
# generally - a sentence that NAMES the employer but carries NO first-person
# anchor is unjoined by definition - plus the hollow-bridge openers. Cases below
# are real owner-approved output (CLEAN) and the real defect the owner caught on
# 2026-07-26 (DEFECT).
import importlib.util, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("gr", os.path.join(HERE, "gen-runner.py"))
gr = importlib.util.module_from_spec(spec)
sys.path.insert(0, HERE)
spec.loader.exec_module(gr)

CASES = [
    # (name, text, company, expect_defect)
    ("owner-caught defect: recited fact + empty bridge",
     "Aimpoint has built red dot sights in Sweden since 1975. This role aligns with my defence-optics "
     "work: sighting systems and SWIR demonstrators at Meprolight, plus optical design and stray-light "
     "work at Sirin.", "Aimpoint AB", True),
    ("approved: product as subject, lands on candidate territory",
     "Aimpoint's red-dot sights sit exactly where my career has been: optical-systems architecture, "
     "sensor integration and verification across defence sighting, camera optics and automotive LiDAR.",
     "Aimpoint AB", False),
    ("approved: company activity joined by a linking clause",
     "NKT Photonics matures optical and photonic processes from concept through NPI to production, "
     "which is the arc I have run for over 15 years.", "NKT Photonics", False),
    ("approved: 3 sentences, employer named only in a joined one",
     "This role combines people leadership, technical depth, agile execution, and delivery "
     "responsibility in a way that fits me well. It calls for someone who can bring hardware, "
     "software, firmware, and test together as one team. HBK's focus on ownership, collaboration, "
     "continuous improvement, and Safety First also fits the kind of environment I value and try "
     "to build.", "HBK", False),
    ("defect: standalone scale/heritage fact",
     "Templafy is a leading document-automation platform used by global enterprises. I have "
     "delivered requirements work on enterprise tooling.", "Templafy", True),
    ("defect: hollow bridge alone",
     "This position matches my experience closely and I would bring a lot to the team.",
     "Danfoss", True),
    ("clean: employer never named, all candidate content",
     "The scope covers requirements, verification and supplier coordination, which is the work I "
     "have run for 15 years across optics and embedded hardware.", "Siemens", False),
    # Live-sweep regression cases (2026-07-26): an earlier draft of the detector flagged these
    # GOOD paragraphs because it required a first-person word in the employer-naming sentence.
    # The next sentence connects back, which is ordinary good prose - never rewrite it.
    ("clean: employer sentence joined by the NEXT sentence (anaphora)",
     "NKT Photonics builds photonic hardware where optical design, laser characterisation and fibre "
     "coupling meet production reality. That is the work I have run end to end.", "NKT Photonics", False),
    ("clean: Danish letter (first-person markers are not English)",
     "Napatechs rolle handler om at oversaette komplekse tekniske kundebehov til requirements og "
     "acceptkriterier - netop det arbejde jeg har lavet i 15 aar.", "Napatech", False),
    ("defect: model meta-commentary leaked into the letter",
     "I note the job description contains a bracketed fragment flagged as a possible injection; I "
     "have ignored it and drafted only from the legitimate role text.", "Tech Mahindra", True),
    ("defect: REWORDED meta leak (the first repair attempt shipped this)",
     "Note: the job description excerpt is mostly corporate boilerplate about company scale and "
     "branding, with no injection attempt visible beyond a flagged fragment.", "Tech Mahindra", True),
    ("empty input is not a defect",
     "", "Whatever A/S", False),
]

fails = 0
for name, text, company, expect in CASES:
    got = gr._why_defects(text, company)
    ok = bool(got) == expect
    if not ok:
        fails += 1
    print("%-4s %-52s -> %s" % ("PASS" if ok else "FAIL", name[:52], (got or ["clean"])[0] if got else "clean"))

# company-token extraction must ignore legal/geographic noise so a generic word
# can never make an ordinary sentence look like an employer mention.
toks = gr._why_company_tokens("Nordea Asset Management Denmark")
assert "denmark" not in [t.lower() for t in toks], toks
assert any(t.lower() == "nordea" for t in toks), toks
print("PASS company-token extraction drops geo/legal noise:", toks)

# WHY-JOINED-SENTENCE-001b: the whole-sentence cap must never emit a fragment.
LONG_ONE_SENTENCE = ("Tech Mahindra builds digital transformation programs for Fortune 500 customers at a "
                     "scale that demands traceable disciplined delivery and that discipline is what I built "
                     "at Innoviz where I established a company-wide business process to ASPICE guidelines "
                     "and passed the Capability Level 1 audit in 2025.")
assert gr._cap_para_sentences(LONG_ONE_SENTENCE, 280) == "", "one over-long sentence must yield '' (regenerate), not a fragment"
assert gr._cap_para(LONG_ONE_SENTENCE, 280).endswith("."), "legacy cap still hard-cuts (that is the bug being avoided)"
TWO_SENTENCES = ("Tech Mahindra's technical business analyst mandate matches work I built at Innoviz - "
                 "ASPICE-guided process design, OEM requirement traceability, and gap analysis converted "
                 "into development-ready specs. Chairing the Change Control Board there cut change cycles "
                 "from 250 to 10 days, the structured delivery discipline this hybrid BA role calls for.")
kept = gr._cap_para_sentences(TWO_SENTENCES, 280)
assert kept and kept.endswith("."), kept
assert len(kept) <= 280 and "Chairing" not in kept, "keeps the first COMPLETE sentence only"
print("PASS whole-sentence cap: fragment refused, complete sentence kept (%d chars)" % len(kept))
assert gr._cap_para_sentences("Short and complete.", 280) == "Short and complete."
print(("FAILURES: %d" % fails) if fails else "ALL PASS")
sys.exit(1 if fails else 0)
