---
name: knowledge-graph-maintenance
description: Review, fix and evaluate what knowledge-ingestion put in the MediaPulse knowledge graph in Organon. Use when reading the nightly Knowledge Graph Ingestion report, when a fact in the graph is wrong or an article should be removed, when the user asks to correct, remove or improve knowledge graph data, or when running the knowledge graph eval.
---

# Knowledge graph maintenance

The nightly **Knowledge Graph Ingestion** run (agent `knowledge-ingestion`) sends analyzed articles to the MediaPulse project in Organon, where the Ingestion model reads them. This skill covers what happens after: reading the run's report, finding what went wrong, fixing it with the user's approval, judging quality in an eval, and turning each mistake into a change that stops it happening again.

The ingestion contract is the Organon developer page `how-to-ingest-articles`. The agent is described in `dev-docs/docs/mediapulse/apps/agents/knowledge-ingestion.mdx`.

## Access

| What         | How                                                                                                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nightly runs | Hermes MCP, prod profile: `hermes_list_schedules` with `q: "Knowledge Graph Ingestion"`, then `hermes_list_schedule_executions` and `hermes_get_schedule_execution`. The invocation's `agentResponse.details` is the report.            |
| The graph    | The `organon-mediapulse-prod` MCP: `run_sparql_query`, `get_instance`, `update_instance`, `delete_instance`, `search_instances`.                                                                                                        |
| Article text | The Mediapulse database, read only. The user supplies `MEDIAPULSE_DATABASE_URL` for the session. Pass it as an environment variable, open every transaction with `BEGIN READ ONLY`, and never write it to a file, a memory or a commit. |

Jobs are visible only to the key that started them. The MCP key is not the ingestion key, so `list_ingestion_jobs` won't show the nightly jobs. Use the run report and SPARQL instead.

## Safety rules

- **Read before writing.** Look at an instance with `get_instance` before any `update_instance`, and list what an article touched before any delete.
- **Every write needs the user's approval for that item.** Show what will be deleted or changed and why, then wait. A decision about one article doesn't cover the next.
- **Never edit curated profile fields.** On `mp:ListedCompany` these are marked `organon:notFromIngestion`: company overview, business operation, sector and classification, IDX sector, alternative titles, description, ambiguous names and primary competitors. People curate them, and ingestion can't change them either.
- **Never store an IRI.** IRIs differ per environment. Look them up each time.
- **`update_instance` replaces every value of a property you send.** To drop one of several values, send the ones that stay. To clear a property, send it once with an empty value.
- **Report what you changed** at the end: each delete and update, with the article it came from.

## 1. Read the nightly report

`details` on the invocation holds:

- `sent`, `failed` and `failures`: sends Organon refused. Several with the same error usually mean a config problem, not an article problem.
- `sweep`: failed jobs that were retried. `notRetryable` jobs need a look in the Organon dashboard.
- `evidence`: the check on the articles sent in the day before the run.
  - `quotesNotInText`: the model paraphrased instead of copying.
  - `pointsMissingTicker`: a point isn't filed under every ticker the article was sent for.
  - `figuresWithoutPoint`: a figure no sentence supports.
  - `withoutPoints`: a completed job left the article with nothing. An article deleted by hand shows up here the next night. That's expected.
  - `skipped.unfinished`: jobs still queued or running when the check ran. The next night's window has moved past them, so they are never checked. Look at them by hand when the count is large.

The evidence check can't see a fact tied to the wrong company when the quote and tickers are right. Always look at the articles in step 2 that the report doesn't flag, as well as the ones it does.

## 2. Look into an article

Find its Data source by canonical URL. The URL is typed `xsd:anyURI`, so compare with `STR`.

```sparql
PREFIX mp: <https://mediapulse.hyperjump.tech/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?source ?label WHERE {
  ?source a mp:DataSource ; mp:canonicalUrl ?url .
  OPTIONAL { ?source rdfs:label ?label }
  FILTER(STR(?url) = "<canonical url>")
}
```

List everything the article touched, through its versions in the history graph. Run it with `includeProvenance: true` and `includeInferred: false`.

```sparql
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?thing ?label ?class WHERE {
  ?version dcterms:isVersionOf <source iri> .
  ?revision prov:wasDerivedFrom ?version ;
    prov:specializationOf ?thing .
  OPTIONAL { ?thing rdfs:label ?label }
  OPTIONAL { ?thing a ?class . FILTER(!STRSTARTS(STR(?class), STR(prov:))) }
}
```

Its points, the sentences it was read from, are found through `mp:inArticle`, never only through the history. The points converted from the old annotations on 2026-11-18 were written by hand, so they aren't in the article's history.

```sparql
PREFIX mp: <https://mediapulse.hyperjump.tech/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?point ?label ?about ?quote WHERE {
  ?point a mp:ArticlePoint ; mp:inArticle <source iri> .
  OPTIONAL { ?point rdfs:label ?label }
  OPTIONAL { ?point mp:about ?about }
  OPTIONAL { ?point mp:quote ?quote }
}
```

Points and figures belong to the article. Everything else is shared: companies, people, places, periods, events, corporate actions and regulations. For each shared item, check with `get_instance` (stated values only) which values the article added.

To see whether another article also touched a shared item, count the sources behind its revisions. Run it with `includeProvenance: true` and `includeInferred: false`.

```sparql
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>
SELECT ?thing (COUNT(DISTINCT ?source) AS ?sources) (SAMPLE(?ref) AS ?referencedBy) WHERE {
  VALUES ?thing { <iri 1> <iri 2> }
  ?revision prov:specializationOf ?thing .
  OPTIONAL { ?revision prov:wasDerivedFrom ?version . ?version dcterms:isVersionOf ?source . }
  OPTIONAL { ?ref ?p ?thing . FILTER(!STRSTARTS(STR(?p), STR(prov:))) }
} GROUP BY ?thing
```

`get_provenance` on a busy company runs to tens of thousands of characters. Use the queries above instead.

## 3. Fix it

Name the cause first, then pick the fix. Get approval, apply it, and check with the queries from step 2.

| Cause                                                                        | Sign                                                                                                                             | Fix                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrong placement: the article is about another company with a similar name    | Figures in a currency the company doesn't report in, a foreign headquarters, an industry that doesn't match the ticker's profile | Delete the article's points, then the Data source. Then delete the shared items only this article created (one source, referenced only by each other), and clear the values it added to shared items that stay. |
| Wrong link: the article is right but a party is linked to the wrong instance | A real company's facts on a different company                                                                                    | Remove the wrong values with `update_instance`. If the right instance is missing, create it, or leave it for the next read.                                                                                     |
| Junk article: a price page, an outage report or a listing                    | Few or no points, quotes about something else                                                                                    | Delete the article's points, the Data source and the shared items only it created.                                                                                                                              |
| Paraphrased quote                                                            | `quotesNotInText`                                                                                                                | Nothing to fix by hand. Sending the article again replaces the points it owns. Record it for the eval.                                                                                                          |
| Missing ticker on a point                                                    | `pointsMissingTicker`                                                                                                            | Record it for the eval. It points at the Concepts or at the content header.                                                                                                                                     |
| Duplicate party                                                              | Two instances for one company                                                                                                    | Ask the user. Link them with `link_instances` and `relation: "sameAs"`: both stay and reasoning shares their facts. Undo with `unlink_instances`.                                                               |

Delete an article's points before its Data source. Deleting an instance removes every link to it, so once the Data source is gone, a point it doesn't own loses its `mp:inArticle` and can't be found that way. Deleting a Data source answers with `removedCount`, the article's own items that went with it. Shared items stay until you delete them one by one.

A deleted article stays recorded as sent in Mediapulse (`organon_article_send`), so it won't be sent again unless it's placed for a new ticker.

## 4. Stop it happening again

Each fix should leave one of these behind, and the report to the user should say which:

- **An eval case** in `scripts/lib/knowledge-graph.cases.json` (see step 5).
- **A Concepts change**, when the model keeps making the same mistake. Draft it with `save_concept_file` on the prod MCP. Publishing happens in the Organon dashboard, by the user.
- **A ticker profile change**, when a name collides, for example an ambiguous name, so article analysis asks for more context.
- **An article analysis issue**, when placement keeps picking the wrong company. Open it with the `create-github-issue` skill, and call it "the knowledge graph" in the text, never by product name.

## 5. Eval

The eval is done by the agent running this skill, not by a script that sends articles again. A re-read costs a model call, about $0.009 an article. Judging what the nightly runs already stored costs nothing on the graph side.

1. **Pick the tickers.** Only tickers with active subscribers count, the rule delivery uses:

   ```sql
   SELECT t.id, t.symbol, t.name, COUNT(DISTINCT ut.user_id) AS active_users
   FROM mediapulse.user_ticker ut
   JOIN mediapulse.mediapulse_user u ON u.id = ut.user_id
   JOIN mediapulse.ticker t ON t.id = ut.ticker_id
   WHERE ut.enabled AND u.enabled
   GROUP BY t.id, t.symbol, t.name
   ORDER BY t.symbol;
   ```

2. **Pick two sent articles per ticker** from `mediapulse.organon_article_send` whose `ticker_symbols` include the symbol. Take one with figures and one with relations or events, where the ticker has both. Prefer articles not used in an earlier pass.
3. **Read both sides.** The article: title, description and content of the placed row with a body (`data_source` joined through `data_source_ticker_section`, `section IS NOT NULL`). The graph: the step 2 queries, plus each point's about item, relation, other party and figure values.
4. **Judge every item** against the text:
   - `correct`
   - `wrong-company`: the fact is true, but of another party
   - `wrong-value`: an amount, unit, period or date doesn't match the text
   - `not-in-text`: nothing in the article supports it
   - `quote-paraphrased`
   - `ticker-missing`

   Then list the facts a careful reader would expect and the graph doesn't have, as `missed`.

5. **Record the case** in `scripts/lib/knowledge-graph.cases.json`: canonical URL, tickers, the date it was judged, the Concepts version, each item's label and verdict, and the missed facts. Don't put IRIs in it.
6. **Report** per ticker and overall: share of correct items, counts per verdict, and the worst cases with their fixes. Keep the summary in `scripts/lib/knowledge-graph-eval.md` so each pass can be compared with the last.

Run a pass after a Concepts publish, judging the next night's articles, and whenever the user asks. Fix wrong items only as in step 3, with approval.

Re-reading articles is worth the cost only to test a Concepts draft before it's published. Then send only the cases that failed through the `extract` tool, which reads without saving, with the same content header and `sourceClassIri` the agent sends. Say what it will cost first.
