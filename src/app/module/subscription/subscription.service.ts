import status from "http-status";
import SSLCommerzPayment from "sslcommerz-lts";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "../../../generated/prisma/client";
import { PaymentStatus, SubscriptionPlan } from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";

const stripe = new Stripe(envVars.STRIPE.SECRET_KEY, { apiVersion: "2026-01-28.clover" });

const SUBSCRIPTION_PLANS = {
    MONTHLY: { durationDays: 30, amount: 500, plan: SubscriptionPlan.MONTHLY },
    QUARTERLY: { durationDays: 90, amount: 1300, plan: SubscriptionPlan.QUARTERLY },
    BIANNUAL: { durationDays: 180, amount: 2500, plan: SubscriptionPlan.BIANNUAL },
    YEARLY: { durationDays: 365, amount: 4500, plan: SubscriptionPlan.YEARLY },
};

const initiatePayment = async (user: IRequestUser, payload: { planName: string; couponCode?: string; referralCode?: string; gateway?: "STRIPE" | "SSLCOMMERZ" }) => {
    const planKey = payload.planName.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
    const planDetails = SUBSCRIPTION_PLANS[planKey];
    const gateway = payload.gateway || "SSLCOMMERZ"; // Default to SSLCOMMERZ if not provided

    if (!planDetails) {
        throw new AppError(status.BAD_REQUEST, "Invalid subscription plan.");
    }

    const finalAmount = planDetails.amount;
    let appliedCouponId: string | undefined;

    // Optional coupon logic: Strictly tracking only, no financial discounts applied
    if (payload.couponCode) {
        const coupon = await prisma.coupon.findUnique({ where: { code: payload.couponCode.toUpperCase() } });
        if (coupon && coupon.status === "ACTIVE" && (!coupon.expiresAt || new Date(coupon.expiresAt) > new Date())) {
            // Note: discount logic is intentionally removed per user requirements. Final amount remains unchanged.
            appliedCouponId = coupon.id;
        } else {
            throw new AppError(status.BAD_REQUEST, "Invalid or expired coupon code.");
        }
    }

    const transactionId = `TXN-${uuidv4().substring(0, 8)}-${Date.now()}`;

    // Create subscription record
    await prisma.subscription.create({
        data: {
            userId: user.userId,
            plan: planDetails.plan,
            amount: finalAmount,
            transactionId,
            status: PaymentStatus.UNPAID,
            couponId: appliedCouponId,
        }
    });

    if (gateway === "STRIPE") {
        // Init Stripe Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: user.email,
            client_reference_id: transactionId,
            line_items: [
                {
                    price_data: {
                        currency: "bdt", // Or usd, depending on account
                        unit_amount: finalAmount * 100, // Stripe expects minimum unit (e.g., cents/paisa)
                        product_data: {
                            name: `CareerBangla ${payload.planName} Premium`,
                            description: `Premium Subscription for ${planDetails.durationDays} days.`,
                        },
                    },
                    quantity: 1,
                },
            ],
            success_url: `${envVars.FRONTEND_URL}/dashboard/subscriptions?payment=success`,
            cancel_url: `${envVars.FRONTEND_URL}/dashboard/subscriptions?payment=cancelled`,
        });

        return { paymentUrl: session.url };
    } else {
        const isLive = envVars.SSLCOMMERZ.IS_LIVE;
        const sslcz = new SSLCommerzPayment(envVars.SSLCOMMERZ.STORE_ID, envVars.SSLCOMMERZ.STORE_PASSWORD, isLive);

        const sslczData = {
            total_amount: finalAmount,
            currency: 'BDT',
            tran_id: transactionId,
            success_url: `${envVars.BACKEND_URL}/api/v1/subscriptions/ipn`,
            fail_url: `${envVars.BACKEND_URL}/api/v1/subscriptions/ipn`,
            cancel_url: `${envVars.BACKEND_URL}/api/v1/subscriptions/ipn`,
            ipn_url: `${envVars.BACKEND_URL}/api/v1/subscriptions/ipn`,
            shipping_method: 'No',
            product_name: `CareerBangla ${payload.planName} Premium`, // cspell:disable-line
            product_category: 'Subscription',
            product_profile: 'non-physical-goods',
            cus_name: (user as IRequestUser & { name?: string }).name || 'CareerBangla User',
            cus_email: user.email,
            cus_add1: 'Dhaka',
            cus_add2: 'Dhaka',
            cus_city: 'Dhaka',
            cus_state: 'Dhaka',
            cus_postcode: '1000',
            cus_country: 'Bangladesh',
            cus_phone: '01711111111',
            cus_fax: '01711111111',
            ship_name: (user as IRequestUser & { name?: string }).name || 'CareerBangla User', // cspell:disable-line
            ship_add1: 'Dhaka',
            ship_add2: 'Dhaka',
            ship_city: 'Dhaka',
            ship_state: 'Dhaka',
            ship_postcode: 1000,
            ship_country: 'Bangladesh',
        };

        const apiResponse = await sslcz.init(sslczData);
        if (apiResponse?.GatewayPageURL) {
            return { paymentUrl: apiResponse.GatewayPageURL };
        } else {
            throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to initiate SSLCommerz payment.");
        }
    }
}

interface ISSLCommerzIpnPayload {
    tran_id?: string;
    status?: string;
    val_id?: string;
    amount?: string;
    bank_tran_id?: string;
    card_type?: string;
}

const handleIpn = async (payload: ISSLCommerzIpnPayload) => {
    // SSLCommerz sends POST data to IPN
    const { tran_id, status: paymentStatus, val_id, bank_tran_id, card_type } = payload;

    if (!tran_id) {
        return { message: "Invalid IPN data" };
    }

    const subscription = await prisma.subscription.findUnique({
        where: { transactionId: tran_id },
        include: { user: true }
    });

    if (!subscription) {
        return { message: "Subscription not found" };
    }

    if (subscription.status === PaymentStatus.PAID) {
        return { message: "Already processed" };
    }

    if (paymentStatus === "VALID" || paymentStatus === "VALIDATED") {
        const isLive = envVars.SSLCOMMERZ.IS_LIVE;
        const sslcz = new SSLCommerzPayment(envVars.SSLCOMMERZ.STORE_ID, envVars.SSLCOMMERZ.STORE_PASSWORD, isLive);

        // Validate the transaction strictly
        const validationResponse = await sslcz.validate({ val_id });
        if (validationResponse?.status === "VALID" || validationResponse?.status === "VALIDATED") {
            const planDetails = Object.values(SUBSCRIPTION_PLANS).find(p => p.plan === subscription.plan);
            const durationDays = planDetails?.durationDays || 30;

            const currentPremiumUntil = subscription.user.premiumUntil && subscription.user.premiumUntil > new Date()
                ? subscription.user.premiumUntil
                : new Date();

            const newPremiumUntil = new Date(currentPremiumUntil);
            newPremiumUntil.setDate(newPremiumUntil.getDate() + durationDays);

            await prisma.$transaction(async (tx) => {
                // 1. Mark subscription paid
                await tx.subscription.update({
                    where: { id: subscription.id },
                    data: {
                        status: PaymentStatus.PAID,
                        val_id,
                        bank_tran_id,
                        card_type,
                        currentPeriodStart: new Date(),
                        currentPeriodEnd: newPremiumUntil,
                        paymentGatewayData: payload as unknown as Prisma.InputJsonValue,
                    }
                });

                // 2. Upgrade user to Premium
                await tx.user.update({
                    where: { id: subscription.userId },
                    data: {
                        isPremium: true,
                        premiumUntil: newPremiumUntil,
                    }
                });

                // 3. Mark coupon used if applied
                if (subscription.couponId) {
                    const coupon = await tx.coupon.findUnique({ where: { id: subscription.couponId } });
                    if (coupon) {
                        const newUsageCount = coupon.usageCount + 1;
                        await tx.coupon.update({
                            where: { id: coupon.id },
                            data: {
                                usageCount: newUsageCount,
                                status: newUsageCount >= coupon.maxUsage ? "USED" : "ACTIVE",
                                usedBy: subscription.userId,
                                usedAt: new Date(),
                            }
                        });
                    }
                }

                // 4. Handle Referral Tracking + Reward
                if (subscription.user.referredBy) {
                    const referrerCode = subscription.user.referredBy;
                    const referrer = await tx.user.findUnique({ where: { referralCode: referrerCode } });

                    if (referrer) {
                        // Mark existing entry as paid, or create a new one
                        const existingRef = await tx.referralHistory.findFirst({
                            where: { referrerId: referrer.id, referredUserId: subscription.userId }
                        });

                        if (existingRef && !existingRef.hasPaid) {
                            await tx.referralHistory.update({
                                where: { id: existingRef.id },
                                data: { hasPaid: true, paidAt: new Date() },
                            });
                        } else if (!existingRef) {
                            await tx.referralHistory.create({
                                data: {
                                    referrerId: referrer.id,
                                    referredUserId: subscription.userId,
                                    hasPaid: true,
                                    paidAt: new Date(),
                                }
                            });
                        }

                        // Reward: check if referrer just crossed a multiple of 10
                        const totalPaid = await tx.referralHistory.count({
                            where: { referrerId: referrer.id, hasPaid: true },
                        });

                        if (totalPaid > 0 && totalPaid % 10 === 0) {
                            const referrerData = await tx.user.findUnique({
                                where: { id: referrer.id },
                                select: { isPremium: true, premiumUntil: true },
                            });
                            const baseDate = referrerData?.premiumUntil && new Date(referrerData.premiumUntil) > new Date()
                                ? new Date(referrerData.premiumUntil)
                                : new Date();
                            const rewardUntil = new Date(baseDate);
                            rewardUntil.setDate(rewardUntil.getDate() + 30);

                            await tx.user.update({
                                where: { id: referrer.id },
                                data: { isPremium: true, premiumUntil: rewardUntil },
                            });
                            await tx.notification.create({
                                data: {
                                    userId: referrer.id,
                                    type: "GENERAL",
                                    title: "Referral Reward Earned!",
                                    message: `Congratulations! You've reached ${totalPaid} successful referrals. 30 days of free Premium has been added to your account!`,
                                },
                            });
                        }
                    }
                }

                await tx.notification.create({
                    data: {
                        userId: subscription.userId,
                        type: "GENERAL",
                        title: "Premium Activated",
                        message: `Your ${subscription.plan} subscription has been activated until ${newPremiumUntil.toDateString()}. Enjoy all premium features!`,
                        metadata: { subscriptionId: subscription.id },
                    }
                });
            });

            return { redirectUrl: `${envVars.FRONTEND_URL}/dashboard/subscriptions?payment=success` };
        }
    } else if (paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
        await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: PaymentStatus.FAILED }
        });
        return { redirectUrl: `${envVars.FRONTEND_URL}/dashboard/subscriptions?payment=${paymentStatus.toLowerCase()}` };
    }

    return { redirectUrl: `${envVars.FRONTEND_URL}/dashboard/subscriptions?payment=unknown` };
}


const cancelSubscription = async (user: IRequestUser, subscriptionId: string) => {
    // stopping auto-renewal. Since we don't have tokenized recurring yet, we can just return.
    if (subscriptionId) {
        const subscription = await prisma.subscription.findUnique({
            where: { id: subscriptionId, userId: user.userId }
        });

        if (!subscription) {
            throw new AppError(status.NOT_FOUND, "Subscription not found.");
        }

        if (subscription.status !== PaymentStatus.PAID) {
            throw new AppError(status.BAD_REQUEST, "Only active subscriptions can be cancelled.");
        }
    }

    throw new AppError(status.BAD_REQUEST, "Direct cancellation is not supported. Subscriptions expire automatically.");
}

const getSubscriptionPlans = async () => {
    return {
        plans: [
            { name: "Free", amount: 0, description: "Basic resume profile, limited updates" },
            { name: "Monthly", amount: 500, description: "ATS-friendly CV, unlimited updates for 30 days" },
            { name: "Quarterly", amount: 1300, description: "ATS-friendly CV, unlimited updates for 90 days" },
            { name: "Biannual", amount: 2500, description: "ATS-friendly CV, unlimited updates for 180 days" },
            { name: "Yearly", amount: 4500, description: "ATS-friendly CV, unlimited updates for 365 days" },
        ]
    }
}

const getMySubscriptions = async (user: IRequestUser) => {
    const subscriptions = await prisma.subscription.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
    })
    return subscriptions;
}

export interface StripeWebhookRequest {
    body: Buffer;
    headers: Record<string, string>;
}

interface StripeCheckoutSession {
    client_reference_id: string;
    id: string;
}

const handleStripeWebhook = async (req: StripeWebhookRequest) => {
    const payload = req.body;
    const sig = req.headers["stripe-signature"] as string;

    let event;

    try {
        event = stripe.webhooks.constructEvent(payload, sig, envVars.STRIPE.WEBHOOK_SECRET);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new AppError(status.BAD_REQUEST, `Webhook Error: ${errorMessage}`);
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as StripeCheckoutSession;
        const transactionId = session.client_reference_id;

        if (transactionId) {
            const subscription = await prisma.subscription.findUnique({
                where: { transactionId },
                include: { user: true }
            });

            if (subscription && subscription.status !== PaymentStatus.PAID) {
                const planDetails = Object.values(SUBSCRIPTION_PLANS).find(p => p.plan === subscription.plan);
                const durationDays = planDetails?.durationDays || 30;

                const currentPremiumUntil = subscription.user.premiumUntil && subscription.user.premiumUntil > new Date()
                    ? subscription.user.premiumUntil
                    : new Date();

                const newPremiumUntil = new Date(currentPremiumUntil);
                newPremiumUntil.setDate(newPremiumUntil.getDate() + durationDays);

                await prisma.$transaction(async (tx) => {
                    await tx.subscription.update({
                        where: { id: subscription.id },
                        data: {
                            status: PaymentStatus.PAID,
                            paymentGatewayData: session as unknown as Prisma.InputJsonValue,
                            currentPeriodStart: new Date(),
                            currentPeriodEnd: newPremiumUntil,
                        }
                    });

                    await tx.user.update({
                        where: { id: subscription.userId },
                        data: {
                            isPremium: true,
                            premiumUntil: newPremiumUntil,
                        }
                    });

                    // Track Coupon Usage
                    if (subscription.couponId) {
                        const coupon = await tx.coupon.findUnique({ where: { id: subscription.couponId } });
                        if (coupon) {
                            const newUsageCount = coupon.usageCount + 1;
                            await tx.coupon.update({
                                where: { id: coupon.id },
                                data: {
                                    usageCount: newUsageCount,
                                    status: newUsageCount >= coupon.maxUsage ? "USED" : "ACTIVE",
                                    usedBy: subscription.userId,
                                    usedAt: new Date(),
                                }
                            });
                        }
                    }

                    // Track Referral Usage + Reward
                    if (subscription.user.referredBy) {
                        const referrerCode = subscription.user.referredBy;
                        const referrer = await tx.user.findUnique({ where: { referralCode: referrerCode } });

                        if (referrer) {
                            const existingRef = await tx.referralHistory.findFirst({
                                where: { referrerId: referrer.id, referredUserId: subscription.userId }
                            });

                            if (existingRef && !existingRef.hasPaid) {
                                await tx.referralHistory.update({
                                    where: { id: existingRef.id },
                                    data: { hasPaid: true, paidAt: new Date() },
                                });
                            } else if (!existingRef) {
                                await tx.referralHistory.create({
                                    data: {
                                        referrerId: referrer.id,
                                        referredUserId: subscription.userId,
                                        hasPaid: true,
                                        paidAt: new Date(),
                                    }
                                });
                            }

                            // Reward: check if referrer just crossed a multiple of 10
                            const totalPaid = await tx.referralHistory.count({
                                where: { referrerId: referrer.id, hasPaid: true },
                            });

                            if (totalPaid > 0 && totalPaid % 10 === 0) {
                                const referrerData = await tx.user.findUnique({
                                    where: { id: referrer.id },
                                    select: { isPremium: true, premiumUntil: true },
                                });
                                const baseDate = referrerData?.premiumUntil && new Date(referrerData.premiumUntil) > new Date()
                                    ? new Date(referrerData.premiumUntil)
                                    : new Date();
                                const rewardUntil = new Date(baseDate);
                                rewardUntil.setDate(rewardUntil.getDate() + 30);

                                await tx.user.update({
                                    where: { id: referrer.id },
                                    data: { isPremium: true, premiumUntil: rewardUntil },
                                });
                                await tx.notification.create({
                                    data: {
                                        userId: referrer.id,
                                        type: "GENERAL",
                                        title: "Referral Reward Earned!",
                                        message: `Congratulations! You've reached ${totalPaid} successful referrals. 30 days of free Premium has been added to your account!`,
                                    },
                                });
                            }
                        }
                    }

                    await tx.notification.create({
                        data: {
                            userId: subscription.userId,
                            type: "GENERAL",
                            title: "Premium Activated via Stripe",
                            message: `Your ${subscription.plan} subscription has been activated until ${newPremiumUntil.toDateString()}. Enjoy all premium features!`,
                            metadata: { subscriptionId: subscription.id },
                        }
                    });
                });
            }
        }
    }

    return { received: true };
}

export const SubscriptionService = {
    initiatePayment,
    handleIpn,
    cancelSubscription,
    getSubscriptionPlans,
    getMySubscriptions,
    handleStripeWebhook,
}
