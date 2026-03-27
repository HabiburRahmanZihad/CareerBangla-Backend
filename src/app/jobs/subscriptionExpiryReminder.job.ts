import cron from "node-cron";
import { PaymentStatus } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import { prisma } from "../lib/prisma";
import { sendEmail } from "../utils/email";
import { logger } from "../utils/logger";

const REMINDER_INTERVALS_MINUTES = [
    5 * 24 * 60,
    4 * 24 * 60,
    3 * 24 * 60,
    2 * 24 * 60,
    1 * 24 * 60,
    12 * 60,
    60,
    15,
] as const;

const CHECK_WINDOW_MINUTES = 5;

const getTimeLeftText = (minutesLeft: number) => {
    if (minutesLeft >= 24 * 60) {
        const days = Math.round(minutesLeft / (24 * 60));
        return `${days} day${days > 1 ? "s" : ""} left`;
    }
    if (minutesLeft >= 60) {
        const hours = Math.round(minutesLeft / 60);
        return `${hours} hour${hours > 1 ? "s" : ""} left`;
    }
    return `${minutesLeft} minute${minutesLeft > 1 ? "s" : ""} left`;
};

const getRenewUrlByRole = (role: string) => {
    if (role === "RECRUITER") return `${envVars.FRONTEND_URL}/recruiter/dashboard/subscriptions`;
    return `${envVars.FRONTEND_URL}/dashboard/subscriptions`;
};

const processReminderTick = async () => {
    const now = new Date();

    const subscriptions = await prisma.subscription.findMany({
        where: {
            status: PaymentStatus.PAID,
            currentPeriodEnd: {
                gt: now,
            },
            user: {
                role: {
                    in: ["USER", "RECRUITER"],
                },
            },
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                },
            },
            reminderLogs: {
                select: {
                    reminderInterval: true,
                },
            },
        },
    });

    for (const subscription of subscriptions) {
        if (!subscription.currentPeriodEnd) continue;

        const minutesLeft = Math.floor((subscription.currentPeriodEnd.getTime() - now.getTime()) / (60 * 1000));
        if (minutesLeft <= 0) continue;

        const sentIntervals = new Set(subscription.reminderLogs.map((log) => log.reminderInterval));

        const dueIntervals = REMINDER_INTERVALS_MINUTES.filter((interval) => {
            if (sentIntervals.has(String(interval))) return false;
            const diff = Math.abs(minutesLeft - interval);
            return diff <= CHECK_WINDOW_MINUTES;
        });

        for (const interval of dueIntervals) {
            const reminderInterval = String(interval);
            const timeLeftText = getTimeLeftText(interval);

            try {
                await prisma.subscriptionReminderLog.create({
                    data: {
                        subscriptionId: subscription.id,
                        userId: subscription.user.id,
                        reminderInterval,
                        scheduledMinutes: interval,
                    },
                });
            } catch {
                // Unique constraint can happen in race conditions; ignore duplicate sends.
                continue;
            }

            try {
                await sendEmail({
                    to: subscription.user.email,
                    subject: `CareerBangla Reminder: ${timeLeftText} for your subscription`,
                    templateName: "subscriptionExpiryReminder",
                    templateData: {
                        name: subscription.user.name,
                        planName: subscription.isRecruiterSubscription ? "Recruiter Premium" : "Career Boost",
                        timeLeftText,
                        expiryDateText: subscription.currentPeriodEnd.toLocaleString(),
                        renewUrl: getRenewUrlByRole(subscription.user.role),
                    },
                });

                await prisma.notification.create({
                    data: {
                        userId: subscription.user.id,
                        type: "SUBSCRIPTION_EXPIRING_SOON",
                        title: "Subscription Expiry Reminder",
                        message: `Your subscription will expire in ${timeLeftText}. Renew or extend your plan now to avoid interruption.`,
                        metadata: {
                            subscriptionId: subscription.id,
                            reminderInterval,
                            expiresAt: subscription.currentPeriodEnd.toISOString(),
                        },
                    },
                });

                logger.update(`Subscription reminder sent → userId: ${subscription.user.id}, subscriptionId: ${subscription.id}, interval: ${interval}min`);
            } catch (error) {
                logger.error("Failed to send subscription reminder", {
                    userId: subscription.user.id,
                    subscriptionId: subscription.id,
                    interval,
                    error,
                });
            }
        }
    }
};

export const startSubscriptionExpiryReminderJob = () => {
    // Every 5 minutes, enough for 15/60/12h and day-based reminders with tolerance window.
    cron.schedule("*/5 * * * *", async () => {
        try {
            await processReminderTick();
        } catch (error) {
            logger.error("Subscription reminder job tick failed", error);
        }
    });

    logger.create("Subscription expiry reminder job scheduled (every 5 minutes)");
};
