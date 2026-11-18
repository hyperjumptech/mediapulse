---
name: knowledge-graph-duplicates
description: Find and fix duplicate instances in the MediaPulse knowledge graph in Organon, such as OJK and Otoritas Jasa Keuangan, one ministry stored as a Regulator and as a Government body, or one deal read twice under two labels. Use when the nightly report shows a duplicate party, when the user asks to audit or clean up duplicates, or after a Concepts change to label forms.
---

# Knowledge graph duplicates

Ingestion matches a new item to an existing one only by its exact label, and only within the same class or a narrower one. So duplicates keep appearing:

- **Another form of the name.** Alternative titles aren't compared, so "Central Java" doesn't find "Jawa Tengah" and "Otoritas Jasa Keuangan" doesn't find "OJK".
- **A sibling class.** A Regulator "Kemenperin" doesn't match a Government body "Kemenperin".
- **A new label form.** A Concepts change or a second article gives the same deal or event a different label, such as "Era Media Sejahtera rights issue, 2026" and "Era Media Sejahtera rights issue PMHMETD I, 2026".

This skill finds them across the whole graph and links them. The `knowledge-graph-maintenance` skill covers the nightly report and single articles. The safety rules there apply here too.

## 1. Run the audit

```bash
ORGANON_API_URL=https://organon.hyperjump.tech ORGANON_API_KEY=<read key> \
  pnpm knowledge-graph:duplicates \
  --out reports/knowledge-graph/<date>-duplicates.md \
  --json <scratchpad>/duplicate-candidates.json
```

A read key for the environment is enough. The script only reads. It loads every shared instance (not article points, figures or Data sources) with its alternative titles, legal name and ticker, plus the `sameAs` and `differentFrom` links and the memberships. The report has three parts:

| Part             | What it holds                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate pairs  | Two instances that look like one thing, with the rule that found them. The `--json` file has the same pairs with IRIs, for linking.                         |
| Events and deals | Each party's events and corporate actions in one year, one line per linked set. Read them for one deal under two labels.                                    |
| Small classes    | Every class with up to 100 instances, with alternative titles. Read them for what no rule catches, such as an English and an Indonesian name for one place. |

The rules:

| Rule                         | Finds                                                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same name                    | A shared label, alternative title or legal name once `PT`, `Tbk`, `Persero` and similar words are dropped. A short acronym that both hold only as an alternative title is skipped. |
| Acronym                      | A public body's initials matching another public body's label, such as OJK, or a company whose own alternative titles hold the acronym.                                            |
| Same regulation              | The same kind and number however it's written, so "UU No. 4 Tahun 2023" matches "Undang-Undang Nomor 4 Tahun 2023".                                                                |
| Name inside name             | Two people where the shorter name has at least two words, all inside the longer one.                                                                                               |
| Same person and organization | Two memberships of one person at one organization, counting organizations already linked as the same.                                                                              |

It never pairs two listed companies, a brand with an organization, or a business group with a company. Pairs already linked as `sameAs` or `differentFrom` are left out, so each audit shows only what's new.

## 2. Judge each pair

Look at the values when the label doesn't settle it: `get_instance` with stated values, and above all `legalName`, `parentOf`, `ownsStakeIn` and `subsidiaryOf`.

**The same thing:**

- One body under its acronym and its full name: OJK and Otoritas Jasa Keuangan, BI and Bank Indonesia, IDX and Bursa Efek Indonesia.
- One ministry stored as a Regulator and as a Government body: Kemenpar and Kementerian Pariwisata, the two BKPM, the Komdigi entries.
- A renamed company: Indofood Fritolay Makmur and Indofood Fortuna Makmur, Aneka Gas and Samator Indo Gas.
- A company record for a listed company, made by an article or a competitor list: Indosat Ooredoo and Indosat, IBS and Inti Bangun Sejahtera.
- A brand under a short and a long name: EMC and EMC Healthcare, NICE and Nusantara International Convention Exhibition.
- A person with and without a middle name: Raffi Ahmad and Raffi Farid Ahmad.
- A short and a long form of one provincial government: Pemprov DKI Jakarta and Pemerintah Provinsi DKI Jakarta.
- One deal or event under two label forms, such as the same general meeting read as "EGM approves name change" and "RUPSLB approves all nine agenda items".

**Not the same thing:**

- A parent and its subsidiary: Falmaco owns Falmaco Nonwoven Industri, Oona Indonesia owns Asuransi Bina Dana Arta, Sea Group and Shopee, Pertamina and Pertamina Patra Niaga.
- A business group and a company in it, or the company record a competitor list uses for the group, such as Wings Group and Kompas Gramedia as Companies.
- A foreign branch: Arsy Buana Travelindo LLC.
- Two products of one company: RCTI and RCTI+.
- One-word person names such as Santoso or Solihin, unless their memberships show they're one person.
- A province and a city with one name, such as DKI Jakarta and Jakarta, because a place holds only one place kind.

When you can't tell, leave the pair for the user and say why.

## 3. Fix

Every link needs the user's approval. Show the pairs you judged the same and the ones you judged different, then wait.

1. **Link the same things** with `link_instances` and `relation: "sameAs"`, one call per pair. For three or more, link each to the first. Both instances stay and reasoning shares their facts. Never delete one of the pair to merge them, and never edit a listed company's curated fields.
2. **Log each link**, with both labels and IRIs, in `reports/knowledge-graph/backups/<date>-same-as-links.json`. The `reports/` folder isn't committed, so IRIs are fine there.
3. **Check for contradictions.** Call `list_contradictions` until `isUpdating` is false. A "Disjoint classes" contradiction, such as a Company with a Business group or a Brand with an Organization, means the two can't be one thing. Undo that link with `unlink_instances`.
4. **Record the pairs judged different** with `link_instances` and `relation: "differentFrom"`, so the next audit leaves them out. These need approval too.
5. **Run the audit again** and report what's left.

## 4. Stop it happening again

Say which of these the fix points to:

- **A Concepts change** when one kind keeps splitting: one class for ministries, Indonesian names for Indonesian places, a fixed label form for deals and events. Draft it as in `knowledge-graph-maintenance`.
- **A ticker profile change** when a listed company keeps getting a second record: add the name articles use as an alternative title.
- **An entry in the nightly report**, so the same pair isn't proposed again by hand.

Run the audit after every Concepts change to label forms, about once a week, and whenever the nightly report shows a duplicate party.
