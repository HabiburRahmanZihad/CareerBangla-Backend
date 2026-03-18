import { Server } from "http";
import app from "./app";
import { envVars } from "./app/config/env";
import { logEnvironmentConfig } from "./app/config/environment";
import { seedSuperAdmin } from "./app/utils/seed";

let server: Server;
const bootstrap = async () => {
    try {
        logEnvironmentConfig();

        await seedSuperAdmin();
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

// SIGTERM signal handler
process.on("SIGTERM", () => {
    console.log("⚠️  SIGTERM signal received. Shutting down server gracefully...");

    if (server) {
        server.close(() => {
            console.log("✅ Server closed gracefully.");
            process.exit(0);
        });
    } else {
        process.exit(0);
    }

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
        console.error("❌ Forced shutdown after timeout");
        process.exit(1);
    }, 30000); // 30 seconds
})

// SIGINT signal handler
process.on("SIGINT", () => {
    console.log("⚠️  SIGINT signal received. Shutting down server gracefully...");

    if (server) {
        server.close(() => {
            console.log("✅ Server closed gracefully.");
            process.exit(0);
        });
    } else {
        process.exit(0);
    }

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
        console.error("❌ Forced shutdown after timeout");
        process.exit(1);
    }, 30000);
});

//uncaught exception handler
process.on('uncaughtException', (error) => {
    console.error("💥 Uncaught Exception Detected. Shutting down server...");
    console.error(error);

    if (server) {
        server.close(() => {
            process.exit(1);
        })
    } else {
        process.exit(1);
    }
})

process.on("unhandledRejection", (error) => {
    console.error("💥 Unhandled Rejection Detected. Shutting down server...");
    console.error(error);

    if (server) {
        server.close(() => {
            process.exit(1);
        })
    } else {
        process.exit(1);
    }
})

bootstrap();