# KG-DATA-01: Add Knowledge Graph Prisma Models

## Type

Feature

## Priority

High (blocks all other epics)

## Description

Add 8 new Prisma models to `packages/database/prisma/schema.prisma` for the per-ticker knowledge graph. These tables store the graph structure (entities, aliases, relations), per-ticker graph membership, and article relevance scores.

## Acceptance criteria

- [ ] 8 new models added to `schema.prisma` (see schema below)
- [ ] All fields have `@map` annotations following existing snake_case convention
- [ ] All models have `@@map` table name annotations
- [ ] Indexes added for performance-critical lookups
- [ ] Prisma client generates without errors (`pnpm prisma generate`)
- [ ] No changes to existing models
- [ ] JSDoc comments on each model explaining its purpose

## Schema

### EntityType

```prisma
model EntityType {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  entities Entity[]

  @@map("entity_type")
}
```

### RelationType

```prisma
model RelationType {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  entityRelations EntityRelation[]

  @@map("relation_type")
}
```

### Entity

```prisma
model Entity {
  id            String   @id @default(uuid())
  typeId        String   @map("type_id")
  canonicalName String   @map("canonical_name")
  description   String?
  metadata      Json?
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  type             EntityType       @relation(fields: [typeId], references: [id])
  aliases          EntityAlias[]
  tickerEntities   TickerEntity[]
  articleEntities  ArticleEntity[]
  relationsFrom    EntityRelation[] @relation("RelationFrom")
  relationsTo      EntityRelation[] @relation("RelationTo")

  @@map("entity")
}
```

### EntityAlias

```prisma
model EntityAlias {
  id              String   @id @default(uuid())
  entityId        String   @map("entity_id")
  alias           String
  normalizedAlias String   @map("normalized_alias")
  createdAt       DateTime @default(now()) @map("created_at")

  entity Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@unique([entityId, normalizedAlias])
  @@index([normalizedAlias])
  @@map("entity_alias")
}
```

### TickerEntity

```prisma
enum TickerEntitySource {
  SEED
  EXTRACTED
  MANUAL
}

model TickerEntity {
  id              String             @id @default(uuid())
  tickerId        String             @map("ticker_id")
  entityId        String             @map("entity_id")
  relevanceWeight Float              @default(0.5) @map("relevance_weight")
  source          TickerEntitySource @default(EXTRACTED)
  createdAt       DateTime           @default(now()) @map("created_at")
  updatedAt       DateTime           @updatedAt @map("updated_at")

  ticker Ticker @relation(fields: [tickerId], references: [id], onDelete: Cascade)
  entity Entity @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@unique([tickerId, entityId])
  @@map("ticker_entity")
}
```

### EntityRelation

```prisma
model EntityRelation {
  id             String   @id @default(uuid())
  fromEntityId   String   @map("from_entity_id")
  toEntityId     String   @map("to_entity_id")
  relationTypeId String   @map("relation_type_id")
  weight         Float    @default(1.0)
  lastSeenAt     DateTime @default(now()) @map("last_seen_at")
  createdAt      DateTime @default(now()) @map("created_at")

  fromEntity   Entity       @relation("RelationFrom", fields: [fromEntityId], references: [id], onDelete: Cascade)
  toEntity     Entity       @relation("RelationTo", fields: [toEntityId], references: [id], onDelete: Cascade)
  relationType RelationType @relation(fields: [relationTypeId], references: [id])

  @@unique([fromEntityId, toEntityId, relationTypeId])
  @@map("entity_relation")
}
```

### ArticleEntity

```prisma
enum Sentiment {
  POSITIVE
  NEGATIVE
  NEUTRAL
}

model ArticleEntity {
  id           String    @id @default(uuid())
  dataSourceId String    @map("data_source_id")
  entityId     String    @map("entity_id")
  mentionCount Int       @default(1) @map("mention_count")
  confidence   Float     @default(0.5)
  sentiment    Sentiment?
  createdAt    DateTime  @default(now()) @map("created_at")

  dataSource DataSource @relation(fields: [dataSourceId], references: [id], onDelete: Cascade)
  entity     Entity     @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@unique([dataSourceId, entityId])
  @@map("article_entity")
}
```

### ArticleRelevance

```prisma
model ArticleRelevance {
  id             String   @id @default(uuid())
  dataSourceId   String   @map("data_source_id")
  tickerId       String   @map("ticker_id")
  score          Float
  scoreBreakdown Json     @map("score_breakdown")
  selected       Boolean  @default(false)
  scoredAt       DateTime @default(now()) @map("scored_at")

  dataSource DataSource @relation(fields: [dataSourceId], references: [id], onDelete: Cascade)
  ticker     Ticker     @relation(fields: [tickerId], references: [id], onDelete: Cascade)

  @@unique([dataSourceId, tickerId])
  @@map("article_relevance")
}
```

### Existing model changes (relations only)

Add relation arrays to existing `DataSource` and `Ticker` models:

```prisma
// In DataSource, add:
articleEntities   ArticleEntity[]
articleRelevances ArticleRelevance[]

// In Ticker, add:
tickerEntities    TickerEntity[]
articleRelevances ArticleRelevance[]
```

## Files to modify

- `packages/database/prisma/schema.prisma`

## Notes

- Follow the `@map("snake_case")` and `@@map("table_name")` conventions used by all existing models.
- The `TickerEntitySource` enum is hardcoded (SEED, EXTRACTED, MANUAL) because it describes system behavior, not domain vocabulary. Unlike EntityType/RelationType, there's no reason for admins to modify these.
