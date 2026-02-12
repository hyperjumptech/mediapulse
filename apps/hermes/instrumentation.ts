export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        // We only want to run this in the Node.js runtime, not in edge
        // And also ensure it doesn't run during build time if possibly avoidable
        if (process.env.NEXT_PHASE !== "phase-production-build") {
            const { initCronJobs } = await import("./app/cron-jobs");
            initCronJobs();
        }
    }
}
