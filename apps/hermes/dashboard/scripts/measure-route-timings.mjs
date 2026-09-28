import process from "node:process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "base-url": { type: "string", default: "http://localhost:3001" },
    email: { type: "string" },
    password: { type: "string" },
    runs: { type: "string", default: "10" },
    routes: { type: "string" },
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

const baseUrl = values["base-url"];
const runCount = Number(values.runs);
const routes = values.routes ? values.routes.split(",") : defaultRoutes;

if (!values.email || !values.password) {
  console.error(
    "Usage: node scripts/measure-route-timings.mjs --email <admin email> --password <password> [--base-url http://localhost:3001] [--runs 10] [--routes /dashboard/a,/dashboard/b]",
  );
  process.exit(1);
}

const login = async () => {
  const response = await fetch(`${baseUrl}/login/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: values.email, password: values.password }),
  });
  if (!response.ok) {
    throw new Error(`Login failed with HTTP ${response.status}`);
  }
  const setCookieHeaders = response.headers.getSetCookie();
  const cookiePairs = setCookieHeaders.map((header) => header.split(";")[0]);

  return cookiePairs.join("; ");
};

const measureOnce = async (route, cookie, mode) => {
  const headers = { cookie };
  if (mode === "rsc") {
    headers.RSC = "1";
  }
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${route}`, {
    headers,
    redirect: "manual",
  });
  const reader = response.body.getReader();
  let firstChunkAt;
  let byteCount = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    firstChunkAt ??= performance.now();
    byteCount += value.byteLength;
  }
  const finishedAt = performance.now();

  return {
    status: response.status,
    firstByteMilliseconds: (firstChunkAt ?? finishedAt) - startedAt,
    totalMilliseconds: finishedAt - startedAt,
    byteCount,
  };
};

const percentile = (sortedValues, fraction) => {
  const index = Math.min(
    sortedValues.length - 1,
    Math.floor(fraction * sortedValues.length),
  );

  return sortedValues[index];
};

const summarize = (samples, key) => {
  const sortedValues = samples
    .map((sample) => sample[key])
    .sort((a, b) => a - b);

  return {
    median: percentile(sortedValues, 0.5),
    p90: percentile(sortedValues, 0.9),
  };
};

const cookie = await login();
const rows = [];

for (const route of routes) {
  for (const mode of ["document", "rsc"]) {
    await measureOnce(route, cookie, mode);
    const samples = [];
    for (let run = 0; run < runCount; run += 1) {
      samples.push(await measureOnce(route, cookie, mode));
    }
    const firstByte = summarize(samples, "firstByteMilliseconds");
    const total = summarize(samples, "totalMilliseconds");
    const lastSample = samples[samples.length - 1];
    rows.push({
      route,
      mode,
      status: lastSample.status,
      "ttfb median": firstByte.median.toFixed(1),
      "ttfb p90": firstByte.p90.toFixed(1),
      "total median": total.median.toFixed(1),
      "total p90": total.p90.toFixed(1),
      kilobytes: (lastSample.byteCount / 1024).toFixed(1),
    });
  }
}

console.table(rows);
