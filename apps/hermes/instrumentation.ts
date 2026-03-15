export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initNodeObservability } = await import("@workspace/observability");
    initNodeObservability("hermes");
  }
}
