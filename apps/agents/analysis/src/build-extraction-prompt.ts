export const EXTRACTION_CONTENT_LIMIT = 4000;

export type ExtractionArticle = {
  id: string;
  title: string;
  url: string;
  content: string;
};

export type ExtractionEntityType = {
  id: string;
  name: string;
  description: string | null;
};

export type ExtractionRelationType = {
  id: string;
  name: string;
  description: string | null;
};

/**
 * Builds extraction prompts for a batch of articles using configured vocabularies.
 *
 * @param articles - Articles to extract from (single or batch).
 * @param entityTypes - Entity-type vocabulary from API.
 * @param relationTypes - Relation-type vocabulary from API.
 * @returns System and user prompts for OpenAI.
 */
export const buildExtractionPrompt = ({
  articles,
  entityTypes,
  relationTypes,
}: {
  articles: ExtractionArticle[];
  entityTypes: ExtractionEntityType[];
  relationTypes: ExtractionRelationType[];
}): { systemPrompt: string; userPrompt: string } => {
  const entityTypesBlock = entityTypes
    .map((type) => `- ${type.name}: ${type.description ?? "No description"}`)
    .join("\n");
  const relationTypesBlock = relationTypes
    .map((type) => `- ${type.name}: ${type.description ?? "No description"}`)
    .join("\n");
  const articleBlocks = articles
    .map(
      (article) => `Article ID: ${article.id}
Title: ${article.title}
Source: ${article.url}
Content: ${truncateContent(article.content)}`,
    )
    .join("\n\n---\n\n");

  return {
    systemPrompt: `You are a financial news entity extraction system. Given a news article, extract
all named entities and relationships between them.

Entity types (use ONLY these):
${entityTypesBlock}

Relationship types (use ONLY these):
${relationTypesBlock}

For each entity, provide:
- name: the most common/canonical name used in the article
- type: one of the entity types listed above
- aliases: other names, abbreviations, or ticker symbols used in the article
- description: one-sentence description based on context

For each relationship, provide:
- from: name of the source entity (must match an extracted entity name)
- to: name of the target entity (must match an extracted entity name)
- relationType: one of the relationship types listed above

Return JSON: { "articles": [{ "articleId": "id", "entities": [...], "relations": [...] }] }`,
    userPrompt: `Extract entities and relationships from these article(s):

${articleBlocks}`,
  };
};

/**
 * Truncates article content for prompt size control.
 *
 * @param content - Raw article content.
 * @returns Truncated content up to the configured limit.
 */
const truncateContent = (content: string): string => {
  if (content.length <= EXTRACTION_CONTENT_LIMIT) {
    return content;
  }

  return `${content.slice(0, EXTRACTION_CONTENT_LIMIT)}...`;
};
