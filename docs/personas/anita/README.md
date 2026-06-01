# Anita Myre-Kornfeldt — test persona

Synthetic candidate for end-to-end testing. Ant-themed identity, deliberately unmistakable so test runs never get confused with real candidate data.

## Files

| File | What it is | Use for |
|---|---|---|
| `personalInfo.json` | Complete personalInfo blob in the current schema. | Sign-in and confirm cloud-restore populates the Personal tab; import via "Import profile from raw data". |
| `Anita_avatar.jpg` | Avatar (cartoon ant in a suit). 1024×1024. | Wizard step where profile photo is uploaded; sidebar photo rendering test. |
| `Anita_HiveIn_Profile.jpeg` | Synthetic LinkedIn-style profile screenshot ("HiveIn"). | OCR / image-import test (the wizard's "extract from screenshot" path). |
| `Anita_Logistics_Cert.pdf` | Synthetic certification PDF, Nordic Foraging Institute. | Certifications import + PDF text-extraction test. |
| `Anita_MSc_Diploma.pdf` | Synthetic MSc diploma, University of Agricultural Sciences, Alnarp. | Education import + diploma OCR test. |

## Profile summary

- **Name:** Anita Myre-Kornfeldt
- **Headline:** MSc in Subterranean Micro-Climates, Grasshopper Mitigation Lead
- **Location:** Greater Nordic Foraging Region / Copenhagen, Denmark
- **Affiliation:** Nordic Ant Colony, 500+ colony members
- **Education:** MSc Agricultural Sciences (Subterranean Micro-Climates), Alnarp
- **Certifications:** Advanced Certification in Logistics Coordination, Nordic Foraging Institute (2019)
- **Roles:** Senior Research Associate (MSc), Forager Lead & Logistics Coordinator, Network Cartographer & Planner

## Use this persona for

- Verifying the wizard end-to-end without burning a real candidate's data on a broken build.
- Smoke-testing a new writing style or visual package — Anita has enough content in every section type (Profile, Experience, Outcomes, Education, Certifications, Publications, Tools) for every section to render.
- Regression testing import flows: JSON, PDF (cert + diploma), JPEG (avatar + HiveIn screenshot).

## Do not use this persona for

- Any production data path.
- Anything that writes to a real LLM provider without the demo-cap enforcement enabled (you'd burn tokens on a fake candidate).
- Anything that ships to a real user.
