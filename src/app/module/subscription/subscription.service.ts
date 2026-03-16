import Stripe from "stripe";
import status from "http-status";
import { SubscriptionPlan, PaymentStatus } from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import { stripe } from "../../config/stripe.config";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { v4 as uuidv4 } from "uuid";

const SUBSCRIPTION_PLANS = {
    STARTER: { coins: 100, amount: 300, plan: SubscriptionPlan.STARTER },
    PROFESSIONAL: { coins: 200, amount: 600, plan: SubscriptionPlan.PROFESSIONAL },
    ENTERPRISE: { coins: 300, amount: 900, plan: SubscriptionPlan.ENTERPRISE },
};

const purchaseSubscription = async (user: IRequestUser, planName: string) => {
    const planKey = planName.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
    const planDetails = SUBSCRIPTION_PLANS[planKey];

    if (!planDetails) {
        throw new AppError(status.BAD_REQUEST, "Invalid subscription plan. Choose STARTER, PROFESSIONAL, or ENTERPRISE.");
    }

    const transactionId = uuidv4();

    // Create subscription record
    const subscription = await prisma.subscription.create({
        data: {
            userId: user.userId,
            plan: planDetails.plan,
            coins: planDetails.coins,
            amount: planDetails.amount,
            transactionId,
            status: PaymentStatus.UNPAID,
        }
    })

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
            {
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `CareerBangla ${planName} Plan`,
                        description: `${planDetails.coins} coins for your CareerBangla wallet`,
                    },
                    unit_amount: planDetails.amount * 100, // Convert to cents
                },
                quantity: 1,
            }
        ],
        metadata: {
            subscriptionId: subscription.id,
            userId: user.userId,
            coins: planDetails.coins.toString(),
        },
        success_url: `${envVars.FRONTEND_URL}/dashboard/wallet?payment=success`,
        cancel_url: `${envVars.FRONTEND_URL}/dashboard/wallet?payment=cancelled`,
    })

    return {
        subscription,
        paymentUrl: session.url,
    }
}

const handleStripeWebhookEvent = async (event: Stripe.Event) => {
    const existingSubscription = await prisma.subscription.findFirst({
        where: { stripeEventId: event.id }
    })

    if (existingSubscription) {
        return { message: `Event ${event.id} already processed. Skipping` }
    }

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;

            const subscriptionId = session.metadata?.subscriptionId;
            const userId = session.metadata?.userId;
            const coins = parseInt(session.metadata?.coins || "0");

            if (!subscriptionId || !userId) {
                return { message: "Missing metadata" };
            }

            await prisma.$transaction(async (tx) => {
                // Update subscription status
                await tx.subscription.update({
                    where: { id: subscriptionId },
                    data: {
                        status: PaymentStatus.PAID,
                        paymentGatewayData: session as unknown as Prisma.InputJsonValue,
                        stripeEventId: event.id,
                    }
                })

                // Credit coins to wallet
                const wallet = await tx.wallet.findUnique({
                    where: { userId }
                })

                if (wallet) {
                    await tx.wallet.update({
                        where: { id: wallet.id },
                        data: { balance: { increment: coins } }
                    })

                    await tx.coinTransaction.create({
                        data: {
                            walletId: wallet.id,
                            amount: coins,
                            type: "CREDIT",
                            purpose: "SUBSCRIPTION_PURCHASE",
                            details: `Subscription purchase: ${coins} coins`,
                        }
                    })
                } else {
                    await tx.wallet.create({
                        data: {
                            userId,
                            balance: coins,
                            transactions: {
                                create: {
                                    amount: coins,
                                    type: "CREDIT",
                                    purpose: "SUBSCRIPTION_PURCHASE",
                                    details: `Subscription purchase: ${coins} coins`,
                                }
                            }
                        }
                    })
                }

                // Create notification
                await tx.notification.create({
                    data: {
                        userId,
                        type: "COIN_CREDITED",
                        title: "Subscription Activated",
                        message: `Your subscription has been activated. ${coins} coins have been added to your wallet.`,
                        metadata: { subscriptionId, coins },
                    }
                })
            })

            break;
        }

        case "checkout.session.expired":
        case "payment_intent.payment_failed":
            break;

        default:
            break;
    }

    return { message: `Webhook Event ${event.id} processed successfully` }
}

const cancelSubscription = async (user: IRequestUser, subscriptionId: string) => {
    const subscription = await prisma.subscription.findFirst({
        where: { id: subscriptionId, userId: user.userId }
    })

    if (!subscription) {
        throw new AppError(status.NOT_FOUND, "Subscription not found");
    }

    if (subscription.status !== PaymentStatus.PAID) {
        throw new AppError(status.BAD_REQUEST, "Only paid subscriptions can be cancelled.");
    }

    const updated = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: PaymentStatus.FAILED },
    })

    await prisma.notification.create({
        data: {
            userId: user.userId,
            type: "GENERAL",
            title: "Subscription Cancelled",
            message: `Your ${subscription.plan} subscription has been cancelled.`,
            metadata: { subscriptionId },
        }
    })

    return updated;
}

const getSubscriptionPlans = async () => {
    return {
        plans: [
            { name: "Free", coins: 50, amount: 0, description: "Welcome bonus for new users" },
            { name: "Starter", coins: 100, amount: 300, description: "100 coins for $3.00" },
            { name: "Professional", coins: 200, amount: 600, description: "200 coins for $6.00" },
            { name: "Enterprise", coins: 300, amount: 900, description: "300 coins for $9.00" },
        ],
        coinCosts: {
            user: {
                applyJob: 10,
                viewRecruiterEmail: 15,
            },
            recruiter: {
                postJob: 15,
                viewCandidate: 10,
            }
        }
    }
}

const getMySubscriptions = async (user: IRequestUser) => {
    const subscriptions = await prisma.subscription.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
    })
    return subscriptions;
}

// Need to import Prisma for InputJsonValue type
import { Prisma } from "../../../generated/prisma/client";

export const SubscriptionService = {
    purchaseSubscription,
    handleStripeWebhookEvent,
    cancelSubscription,
    getSubscriptionPlans,
    getMySubscriptions,
}
