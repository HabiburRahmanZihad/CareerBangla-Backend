import { Server } from "http";
import app from "./app";
import { envVars } from "./app/config/env";
import { logEnvironmentConfig } from "./app/config/environment";
import { startSubscriptionExpiryReminderJob } from "./app/jobs/subscriptionExpiryReminder.job";
import { seedNormalAdmin, seedSuperAdmin } from "./app/utils/seed";

let server: Server;

const gracefulShutdown = (signal: string, exitCode: number) => {
    console.log(`⚠️  ${signal} received. Shutting down gracefully...`);

    if (server) {
        server.close(() => {
            console.log("✅ Server closed gracefully.");
            process.exit(exitCode);
        });
    } else {
        process.exit(exitCode);
    }

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
        console.error("❌ Forced shutdown after timeout");
        process.exit(1);
    }, 30000);
};

const bootstrap = async () => {
    try {
        logEnvironmentConfig();

        await seedSuperAdmin();
        await seedNormalAdmin();
        startSubscriptionExpiryReminderJob();
        server = app.listen(envVars.PORT, () => {
            console.log(`✅ Server is running on http://localhost:${envVars.PORT}`);
            console.log(`🔗 Environment: ${envVars.NODE_ENV.toUpperCase()}`);
            console.log(`📊 API URL: http://localhost:${envVars.PORT}/api/v1`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM", 0));
process.on("SIGINT", () => gracefulShutdown("SIGINT", 0));

process.on('uncaughtException', (error) => {
    console.error("💥 Uncaught Exception Detected:", error);
    gracefulShutdown("uncaughtException", 1);
})

process.on("unhandledRejection", (error) => {
    console.error("💥 Unhandled Rejection Detected:", error);
    gracefulShutdown("unhandledRejection", 1);
})

bootstrap();
