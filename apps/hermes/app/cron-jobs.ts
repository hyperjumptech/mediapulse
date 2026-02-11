import cron from "node-cron";

export function initCronJobs() {
    console.log("Initializing cron jobs in Hermes...");

    // Schedule every day at 11:00 AM
    // Format: second (optional), minute, hour, day of month, month, day of week
    cron.schedule("0 11 * * *", () => {
        console.log("Hello World");
    });

    console.log("Cron job 'Hello World' scheduled for 11:00 AM daily");
}
