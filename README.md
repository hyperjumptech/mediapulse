# MediaPulse

## Quick start

**Prerequisites:** Node.js 22+, pnpm 10.4+, Docker. Use pnpm for install/scripts.

```bash
docker-compose up -d
./dev-setup-local.sh
pnpm dev
```

Then open **http://localhost:3001**.

The setup script is interactive: it will prompt for admin email/password and bootstrap env, DB migrations, admin user, and API keys.

## More information

Full setup options, services and ports, third-party API keys, troubleshooting, and running individual apps are in the **dev-docs**. From the repo root:

```bash
pnpm docs:dev
```

Then open the docs and go to **Getting started**.
