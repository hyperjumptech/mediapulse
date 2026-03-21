# About

Prisma package for Mediapulse domain models (tickers, search queries, data sources, newsletters, and knowledge graph entities).

## Environment Variables

| Variable                  | Description                                        |
| ------------------------- | -------------------------------------------------- |
| `MEDIAPULSE_DATABASE_URL` | Optional direct URL for Mediapulse domain tables.  |
| `DATABASE_URL`            | Fallback URL when Mediapulse-specific URL is unset |
| `DATABASE_CERT_BASE64`    | Base64 CA cert for SSL connections                 |
