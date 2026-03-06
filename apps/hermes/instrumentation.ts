/* eslint-disable strict-env/no-process-env, turbo/no-undeclared-env-vars -- Next.js sets NEXT_RUNTIME and NEXT_PHASE in instrumentation */

/**
 * Next.js instrumentation hook. Edge-safe: Node-only logic runs in instrumentation-node.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { runNodeInstrumentation } = await import("./instrumentation-node");
  await runNodeInstrumentation();
}
