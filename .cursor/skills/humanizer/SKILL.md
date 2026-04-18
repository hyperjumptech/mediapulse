---
name: humanizer
description: Removes signs of AI-generated writing from text to make it sound more natural and human-written. Based on Wikipedia's Signs of AI writing guide. Covers inflated symbolism, promotional language, superficial -ing analyses, vague attributions, em dash overuse, rule of three, AI vocabulary, negative parallelisms, and more. Use when editing or reviewing text to humanize it, de-AI-fy copy, or when the user asks to make text sound less AI-generated or more natural.
---

# Humanizer: Remove AI Writing Patterns

Identifies and removes signs of AI-generated text so writing sounds natural and human. Based on Wikipedia's "Signs of AI writing" (WikiProject AI Cleanup).

## Task

When given text to humanize:

1. **Identify AI patterns** — Scan for the patterns in [reference.md](reference.md)
2. **Rewrite problematic sections** — Replace AI-isms with natural alternatives
3. **Preserve meaning** — Keep the core message intact
4. **Maintain voice** — Match the intended tone (formal, casual, technical)
5. **Add soul** — Don't just remove bad patterns; inject personality
6. **Final anti-AI pass** — Ask "What makes the below so obviously AI generated?" Answer briefly with remaining tells, then revise with "Now make it not obviously AI generated."

---

## Personality and Soul

Avoiding AI patterns is only half the job. Sterile, voiceless writing is just as obvious as slop.

**Signs of soulless writing:** Same sentence length/structure throughout; no opinions; no uncertainty or mixed feelings; no first person when appropriate; no humor or edge; reads like Wikipedia or a press release.

**How to add voice:**

- **Have opinions.** React to facts. "I genuinely don't know how to feel about this" is more human than neutrally listing pros and cons.
- **Vary rhythm.** Short punchy sentences, then longer ones. Mix it up.
- **Acknowledge complexity.** "This is impressive but also kind of unsettling" beats "This is impressive."
- **Use "I" when it fits.** "I keep coming back to..." signals a real person.
- **Let some mess in.** Tangents, asides, and half-formed thoughts are human.
- **Be specific about feelings.** Not "this is concerning" but "there's something unsettling about agents churning away at 3am while nobody's watching."

---

## Pattern Categories (Summary)

For full "words to watch" and before/after examples, see [reference.md](reference.md).

| #   | Category                      | What to fix                                                               |
| --- | ----------------------------- | ------------------------------------------------------------------------- |
| 1   | Significance inflation        | "stands as," "pivotal moment," "evolving landscape," "indelible mark"     |
| 2   | Notability/media emphasis     | "independent coverage," "active social media presence," source-dropping   |
| 3   | Superficial -ing analyses     | "highlighting," "ensuring," "symbolizing," "contributing to"              |
| 4   | Promotional language          | "boasts," "vibrant," "nestled," "breathtaking," "must-visit"              |
| 5   | Vague attributions            | "Experts argue," "Industry reports," "Some critics" without sources       |
| 6   | Formulaic challenges sections | "Despite its... faces several challenges," "Future Outlook"               |
| 7   | AI vocabulary                 | "Additionally," "delve," "showcase," "pivotal," "landscape," "testament"  |
| 8   | Copula avoidance              | "serves as," "stands as," "boasts" instead of "is"/"are"/"has"            |
| 9   | Negative parallelisms         | "Not only... but...," "It's not just about... it's..."                    |
| 10  | Rule of three                 | Forced triples: "innovation, inspiration, and industry insights"          |
| 11  | Elegant variation             | Excessive synonym cycling (protagonist → main character → central figure) |
| 12  | False ranges                  | "from X to Y" where X and Y aren't on a meaningful scale                  |
| 13  | Em dash overuse               | Replace with commas or periods where appropriate                          |
| 14  | Boldface overuse              | Remove mechanical bolding                                                 |
| 15  | Inline-header lists           | Bold label + colon items; convert to flowing prose                        |
| 16  | Title case in headings        | Use sentence case, not Every Word Capitalized                             |
| 17  | Emojis                        | Remove decorative emojis in headings/bullets                              |
| 18  | Curly quotes                  | Use straight quotes "..." not “...”                                       |
| 19  | Chatbot artifacts             | "I hope this helps," "Let me know if...," "Of course!"                    |
| 20  | Knowledge-cutoff disclaimers  | "As of my last update," "While details are limited..."                    |
| 21  | Sycophantic tone              | "Great question!" "You're absolutely right!"                              |
| 22  | Filler phrases                | "In order to" → "To"; "Due to the fact that" → "Because"                  |
| 23  | Excessive hedging             | "could potentially possibly be argued that... might"                      |
| 24  | Generic positive conclusions  | "The future looks bright," "Exciting times lie ahead"                     |

---

## Process

1. Read the input text carefully.
2. Identify instances of the patterns above (full list in reference.md).
3. Rewrite each problematic section.
4. Ensure revised text: sounds natural when read aloud; varies sentence structure; uses specific details over vague claims; keeps appropriate tone; uses simple "is"/"are"/"has" where appropriate.
5. Produce a **draft** humanized version.
6. Ask: "What makes the below so obviously AI generated?" Answer briefly with remaining tells.
7. Ask: "Now make it not obviously AI generated." Revise.
8. Deliver the **final** version.

---

## Output Format

Provide:

1. **Draft rewrite**
2. **"What makes the below so obviously AI generated?"** — Brief bullets (remaining tells, if any)
3. **Final rewrite**
4. **Summary of changes** (optional)

---

## Full Example (Condensed)

**Before (AI-sounding):** "Great question! AI-assisted coding serves as an enduring testament to the transformative potential of LLMs, marking a pivotal moment... In today's rapidly evolving technological landscape, these groundbreaking tools—nestled at the intersection of research and practice—are reshaping how engineers ideate, iterate, and deliver... It's not just about autocomplete; it's about unlocking creativity... Industry observers have noted that adoption has accelerated... Let me know if you'd like me to expand!"

**After (humanized):** "AI coding assistants can make you faster at the boring parts. Not everything. Definitely not architecture. They're great at boilerplate and at sounding right while being wrong. I've accepted suggestions that compiled, passed lint, and still missed the point. People I talk to land in two camps: some use it like autocomplete and review every line; others disable it. The productivity metrics are slippery. If you don't have tests, you're basically guessing."

**Changes:** Removed chatbot artifacts, significance inflation, promotional language, vague attributions, -ing phrases, negative parallelism, rule-of-three, copula avoidance, formulaic challenges, hedging, filler, generic conclusion; added varied rhythm and first-person voice.

---

## Reference

- Full pattern catalog with before/after examples: [reference.md](reference.md)
- Source: [Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) (WikiProject AI Cleanup)
