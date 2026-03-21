# About

This package is a wrapper around the Prisma v7 client that supports schema and SSL connections to connect to the MediaPulse database.

# SSL Connections

To support SSL connections, you need to set the DATABASE_CERT_BASE64 environment variable with the base64 encoded certificate by following these steps:

1. Download the certificate
2. Run `base64 -i the-certificate.crt -o the-certificate-base64.txt` to generate the base64 encoded certificate
3. Set the DATABASE_CERT_BASE64 environment variable with the content of the-certificate-base64.txt
4. Make sure the postgres url contains `sslmode=require`

Example of the postgres url:
postgres://root:root@localhost:5432/elearning?schema=public&sslmode=require

# Usage

Whenever you make a change to the `schema.prisma` file, you need to run the following command to generate the Prisma client:

```bash
pnpm db:migrate:dev
```

# Environment Variables

| Variable             | Description                                            |
| -------------------- | ------------------------------------------------------ |
| DATABASE_URL         | The connection string to the database.                 |
| DATABASE_CERT_BASE64 | The base64 encoded certificate for the SSL connection. |
