import cron from "node-cron";

export function initCronJobs() {
    console.log("Initializing cron jobs in Hermes...");

    // Schedule every day at 11:00 AM Jakarta time (UTC+7), which is 4:00 AM UTC
    // Format: second (optional), minute, hour, day of month, month, day of week
    cron.schedule("0 4 * * *", () => {
        console.log(`${new Date().toISOString()}: Hello World`);
    });

    console.log("Cron job 'Hello World' scheduled for 11:00 AM Jakarta time (4:00 AM UTC) daily");
}
