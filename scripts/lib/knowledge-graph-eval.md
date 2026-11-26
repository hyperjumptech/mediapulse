# Knowledge graph eval

Each pass judges what nightly ingestion stored in the knowledge graph against the article's own text, as described in step 5 of `.cursor/skills/knowledge-graph-maintenance/SKILL.md`. The cases are in `knowledge-graph.cases.json`, one per article, with each item's label and verdict and the facts the graph missed. Nothing is read again, so a pass costs no model calls.

## Pass 1, 2026-11-26

**Scope.** 26 articles from the first three nights on Concepts 11 (24, 25 and 26 Nov), read with knowledge-ingestion 2.1.0 to 2.3.0. That's two or more for every subscribed ticker that had at least two articles sent: AGRO, AMMN, ANTM, BBCA, DATA, DCII, DSSA, EXCL, GOTO, INDY, MORA, NOBU, SMMA, SOHO, TLKM and WIFI. An article placed for several tickers counts for each.

**Tickers with fewer than two articles.**

- One article each, judged: AADI, ADES and DOOH.
- None sent in the three nights: ACES, AMAN, AMRT, BUVA, ERAA, FORE, IRSX, LUCY, MAPA, MAPI and SMAR. At 20 sends a night, the nights went mostly to telecom, banking and mining stories.

**Items fixed before judging.** 33 items were fixed by the 24 and 25 Nov morning reports before this pass. They keep their verdict, and each says which report fixed it. That way a hand fix doesn't hide a mistake the model made.

### Results

| What                                | Correct   | Share |
| ----------------------------------- | --------- | ----- |
| Points quoted word for word         | 117 / 118 | 99%   |
| Points right overall (quote, about) | 113 / 118 | 96%   |
| Relations                           | 58 / 72   | 81%   |
| Figures (value, unit, metric)       | 11 / 26   | 42%   |
| Memberships                         | 4 / 14    | 29%   |
| Events                              | 6 / 10    | 60%   |
| Corporate actions                   | 7 / 9     | 78%   |
| Regulations                         | 6 / 7     | 86%   |
| All items except parties            | 205 / 256 | 80%   |

The judges recorded a party only when the article gave it a wrong value or made a duplicate of it, so all 21 party items are mistakes. They're left out of the last row.

**Verdicts:**

- correct: 205
- wrong-value: 58
- not-in-text: 9
- wrong-company: 4
- quote-paraphrased: 1
- ticker-missing: 0

**Points.** Every point carried exactly its article's placed tickers. Derived tickers (since 2.1.0) work.

**Articles.**

- 21 relevant.
- 3 wrong placements:
  - the Ujung Kulon national park story for five mining and energy tickers
  - the katadata AKRA–Vivo deal for INDY and DSSA
  - the Djarum tower merger for EXCL
- 2 junk: a two-paragraph Kontan paywall stub and the Kemenkes sanitation video page.

### What went wrong, by cause

72 items weren't correct.

| Cause                         | Items | Examples                                                                                                                                                                                                                                                       |
| ----------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Figure under the wrong metric | 15    | Five mobile subscriber counts stored as Company count. A churn rate, a merger synergy (twice), a donation, GMV, a bond yield, a foreign fund outflow, total assets as equity, a fibre length and a buyer's chip purchases, none of which has a fitting metric. |
| Duplicates                    | 12    | Second and third Protelindo items, BEI next to IDX, a second BAZNAS, Kemenko Perekonomian and Kementerian UMKM, and a second MIND ID. Also a second TOWR merger and a second INET purchase under other labels.                                                 |
| Ownership and other relations | 9     | Two buyers of a 49.9% stake read as parents. A pending 10% holding read as owned now. Two merger partners read as subsidiaries. A world-knowledge link (Jensen Huang member of Nvidia).                                                                        |
| Membership role               | 9     | Director for a ministry directorate head and for a think-tank director. Head of agency for officials below the head of OJK. Minister for a deputy minister. Labels using another form of the organization's name, such as "at DJBC" for Bea Cukai.             |
| Header line                   | 6     | GoTo made Tokopedia's parent, XLSmart made a competitor of Telkom and Telkomsel, and Indosat of Telkom, all from the "Placed for" line, which the article bodies never mention. A point was also written about the placement itself.                           |
| Other values on parties       | 8     | Papua New Guinea and Timor-Leste given the country Indonesia. Places and alternative names that aren't names ("Swiss", "Manila, Filipina"). Arsari Group read as a Company.                                                                                    |
| Legal name and other forms    | 5     | A curated PP 8/2025 read again as "PP Nomor 8 Tahun 2025". "Kementerian Pekerjaan Umum" next to Kementerian PU. Links dropped because the model named an item "PT … Tbk".                                                                                      |
| Description about the article | 3     | Kemenaker as the ministry "which issued the SKKNI competency standard", Grup Djarum as a "group with telecom tower entities", and Peradi Bekasi Raya as the association "that reported affected sellers".                                                      |

The 72 also hold five one-off mistakes not counted above:

- a point about the rupiah code-list term instead of the rupiah figure
- Freeport's own permit application stored as a policy decision
- an event labelled as if Le Minerale launched a city
- a point about BP's brand where the seller is BP the company
- a quote missing one word

**Missed facts.** The judges listed 84 facts a reader of the placed tickers would expect and the graph lacks. The most common:

- a deal or event that was skipped because its main party was named by another form
- a figure no metric fits, which is right to leave out
- a short body: the paywall stubs, or a stored body that starts mid-article

### Fixes this pass points to

**knowledge-ingestion 2.4.0 (#1487).** The content no longer has the "Placed for" line, so the model can't read relations from it.

**Concepts 12:**

- **Metrics.** Subscribers and users go under Customer count. Synergies, churn, donations, GMV, yields, fund flows, network lengths and purchases have no metric, so the figure is left out. Total assets aren't equity.
- **Ownership.** Parent of is for control, never for a part stake. A pending deal states no holding. Merging companies aren't parent and subsidiary.
- **Relations.** A relation is stated only when the article's text states it, never from what the model already knows.
- **Membership roles.** Director is only for a company's board. Head of agency is only for the head of the whole body. A deputy minister isn't a Minister. The label uses the organization's label.
- **Names.**
  - Link an item by the exact label it was given, never by its legal name.
  - One deal gets one label: the listed buyer or surviving company, the target, and the year it was announced.
  - The exchange is IDX.
- **Places.** A place's country is its own country, left out when the list doesn't have it. Place labels are in English, so "Switzerland", not "Swiss".

**Placement, for article analysis.** Tickers often get general sector stories that never name them:

- the Ujung Kulon story for five tickers
- AKRA's fuel-station deal for INDY and DSSA
- the Djarum tower merger for EXCL, DCII and DATA
- the Telkom–KPK training for WIFI, DATA, DCII, MORA and EXCL

### Next pass

Judge the first night on Concepts 12 the same way, preferring articles not used here. It's ready to raise the send limit when figures and memberships come out mostly right and no relation comes from outside the text.
