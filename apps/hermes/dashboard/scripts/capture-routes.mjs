import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { chromium } from "playwright";

import { loginToDashboard } from "./dashboard-session.mjs";

const { values } = parseArgs({
  options: {
    "base-url": { type: "string", default: "http://localhost:3001" },
    email: { type: "string" },
    password: { type: "string" },
    routes: { type: "string" },
    out: { type: "string" },
    viewports: { type: "string", default: "375x812,1440x900" },
    themes: { type: "string", default: "light,dark" },
    "time-zone": { type: "string", default: "Asia/Jakarta" },
    "full-page": { type: "boolean", default: false },
    "fail-on-errors": { type: "boolean", default: false },
    channel: { type: "string" },
  },
});

const defaultRoutes = [
  "/dashboard",
  "/dashboard/pipelines",
  "/dashboard/schedules",
  "/dashboard/http-triggers",
  "/dashboard/agents",
  "/dashboard/agent-configs",
  "/dashboard/agent-contracts",
  "/dashboard/variables",
  "/dashboard/domain-integrations",
  "/dashboard/api-keys",
  "/dashboard/admins",
];

if (!values.email || !values.password) {
  console.error(
    "Usage: pnpm --filter @hermes/dashboard visual:capture --email <admin email> --password <password> [--routes /dashboard,/dashboard/agents] [--viewports 375x812,1440x900] [--themes light,dark] [--time-zone Asia/Jakarta] [--out <dir>] [--full-page] [--fail-on-errors] [--channel chrome]",
  );
  process.exit(1);
}

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

const readBranchSlug = () => {
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
    }).trim();

    return branch.replaceAll("/", "-");
  } catch {
    return "local";
  }
};

const parseViewport = (text) => {
  const [width, height] = text.split("x").map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid viewport "${text}", expected WIDTHxHEIGHT`);
  }

  return { width, height, label: `${width}` };
};

const toFileSlug = (route) =>
  route
    .replace(/^\//, "")
    .replaceAll(/[/?=&]+/g, "_")
    .replaceAll(/[^a-zA-Z0-9_-]/g, "") || "root";

const baseUrl = values["base-url"];
const routes = values.routes ? values.routes.split(",") : defaultRoutes;
const viewports = values.viewports.split(",").map(parseViewport);
const themes = values.themes.split(",");
const timeZone = values["time-zone"];
const outDir =
  values.out ?? path.join(repoRoot, "artifacts/ui-evidence", readBranchSlug());

await mkdir(outDir, { recursive: true });

const { cookies } = await loginToDashboard({
  baseUrl,
  email: values.email,
  password: values.password,
});

const launchBrowser = async () => {
  try {
    return await chromium.launch(
      values.channel ? { channel: values.channel } : {},
    );
  } catch (error) {
    console.error(
      "Could not start Chromium. Run `pnpm --filter @hermes/dashboard exec playwright install chromium` once, or pass --channel chrome.",
    );
    throw error;
  }
};

const browser = await launchBrowser();
const report = [];

for (const theme of themes) {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      colorScheme: theme === "dark" ? "dark" : "light",
      timezoneId: timeZone,
    });
    await context.addInitScript((selectedTheme) => {
      globalThis.localStorage.setItem("theme", selectedTheme);
    }, theme);
    await context.addCookies([
      ...cookies.map((cookie) => ({ ...cookie, url: baseUrl })),
      {
        name: "hermes_tz",
        value: encodeURIComponent(timeZone),
        url: baseUrl,
      },
    ]);
    const page = await context.newPage();

    for (const route of routes) {
      const problems = [];
      const recordConsole = (message) => {
        if (message.type() === "error") {
          problems.push(message.text().split("\n")[0]);
        }
      };
      const recordPageError = (error) => {
        problems.push(error.message.split("\n")[0]);
      };
      page.on("console", recordConsole);
      page.on("pageerror", recordPageError);
      const response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(500);
      const horizontalOverflow = await page.evaluate(() => {
        const root = globalThis.document.documentElement;

        return root.scrollWidth > root.clientWidth;
      });
      const fileName = `${toFileSlug(route)}-${viewport.label}-${theme}.png`;
      await page.screenshot({
        path: path.join(outDir, fileName),
        fullPage: values["full-page"],
      });
      page.off("console", recordConsole);
      page.off("pageerror", recordPageError);
      report.push({
        route,
        viewport: viewport.label,
        theme,
        status: response?.status() ?? null,
        horizontalOverflow,
        problems,
        fileName,
      });
      const flags = [
        horizontalOverflow ? "overflow" : null,
        problems.length > 0 ? `${problems.length} error(s)` : null,
      ].filter(Boolean);
      console.log(
        `${fileName}${flags.length > 0 ? `  [${flags.join(", ")}]` : ""}`,
      );
    }

    await context.close();
  }
}

await browser.close();
await writeFile(
  path.join(outDir, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(`Wrote ${report.length} screenshots and report.json to ${outDir}`);

const hasErrors = report.some((entry) => entry.problems.length > 0);
if (values["fail-on-errors"] && hasErrors) {
  process.exit(1);
}
