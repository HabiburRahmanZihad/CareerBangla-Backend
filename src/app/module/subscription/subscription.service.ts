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
import { generateInvoicePdf } from "../../utils/invoice";
import { sendEmail } from "../../utils/email";

const stripe = new Stripe(envVars.STRIPE.SECRET_KEY, { apiVersion: "2026-01-28.clover" });

const SUBSCRIPTION_PLANS = {
    MONTHLY: { durationDays: 30, amount: 500, plan: SubscriptionPlan.MONTHLY, description: "ATS-friendly CV, unlimited updates for 30 days" },
    QUARTERLY: { durationDays: 90, amount: 1300, plan: SubscriptionPlan.QUARTERLY, description: "ATS-friendly CV, unlimited updates for 90 days" },
    BIANNUAL: { durationDays: 180, amount: 2500, plan: SubscriptionPlan.BIANNUAL, description: "ATS-friendly CV, unlimited updates for 180 days" },
    YEARLY: { durationDays: 365, amount: 4500, plan: SubscriptionPlan.YEARLY, description: "ATS-friendly CV, unlimited updates for 365 days" },
};

const PLAN_FEATURES = [
    "Download Custom ATS PDF",
    "Unlimited Profile Editing",
    "Priority Application Review",
    "Premium Badge on Profile",
];

// Helper to calculate discount
const calculateDiscount = (amount: number, coupon: { discountPercent?: number | null; discountAmount?: number | null }) => {
    if (coupon.discountPercent) {
        return Math.round(amount * (coupon.discountPercent / 100));
    }
    if (coupon.discountAmount) {
        return Math.min(coupon.discountAmount, amount);
    }
    return 0;
};

const initiatePayment = async (user: IRequestUser, payload: { planName: string; couponCode?: string; referralCode?: string; gateway?: "STRIPE" | "SSLCOMMERZ" }) => {
    const planKey = payload.planName.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
    const planDetails = SUBSCRIPTION_PLANS[planKey];
    const gateway = payload.gateway || "SSLCOMMERZ";

    if (!planDetails) {
        throw new AppError(status.BAD_REQUEST, "Invalid subscription plan.");
    }

    let finalAmount = planDetails.amount;
    let appliedCouponId: string | undefined;
    let discountAmount = 0;

    // Coupon validation and discount calculation
    if (payload.couponCode) {
        const coupon = await prisma.coupon.findUnique({ where: { code: payload.couponCode.toUpperCase() } });
        if (coupon && coupon.status === "ACTIVE" && (!coupon.expiresAt || new Date(coupon.expiresAt) > new Date()) && coupon.usageCount < coupon.maxUsage) {
            appliedCouponId = coupon.id;
            discountAmount = calculateDiscount(planDetails.amount, coupon);
            finalAmount = planDetails.amount - discountAmount;
            if (finalAmount < 1) finalAmount = 1; // Minimum charge
        } else {
            throw new AppError(status.BAD_REQUEST, "Invalid or expired coupon code.");
        }
    }

    const transactionId = `TXN-${uuidv4().substring(0, 8)}-${Date.now()}`;

    // Store referralId if referral code provided (for tracking)
    let referralId: string | undefined;
    if (payload.referralCode) {
        referralId = payload.referralCode;
    }

    // Create subscription record
    await prisma.subscription.create({
        data: {
            userId: user.userId,
            plan: planDetails.plan,
            amount: finalAmount,
            transactionId,
            status: PaymentStatus.UNPAID,
            couponId: appliedCouponId,
            referralId,
            paymentGatewayData: {
                gateway,
                originalAmount: planDetails.amount,
                discountAmount,
                couponCode: payload.couponCode || null,
                referralCode: payload.referralCode || null,
            } as unknown as Prisma.InputJsonValue,
        }
    });

    if (gateway === "STRIPE") {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: user.email,
            client_reference_id: transactionId,
            line_items: [
                {
                    price_data: {
                        currency: "bdt",
                        unit_amount: finalAmount * 100,
                        product_data: {
                            name: `CareerBangla ${payload.planName} Premium`,
                            description: `Premium Subscription for ${planDetails.durationDays} days.${discountAmount > 0 ? ` (Discount: ৳${discountAmount})` : ""}`,
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
            product_name: `CareerBangla ${payload.planName} Premium`,
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
            ship_name: (user as IRequestUser & { name?: string }).name || 'CareerBangla User',
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

// Shared post-payment processing logic
const processSuccessfulPayment = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    subscription: {
        id: string;
        plan: SubscriptionPlan;
        amount: number;
        transactionId: string | null;
        couponId: string | null;
        userId: string;
        user: { id: string; name: string; email: string; referredBy: string | null; premiumUntil: Date | null; isPremium: boolean };
        paymentGatewayData: Prisma.JsonValue;
    },
    gatewayData: Prisma.InputJsonValue,
    gatewayLabel: string,
    extraUpdateData: Record<string, unknown> = {},
) => {
    const planDetails = Object.values(SUBSCRIPTION_PLANS).find(p => p.plan === subscription.plan);
    const durationDays = planDetails?.durationDays || 30;

    const currentPremiumUntil = subscription.user.premiumUntil && subscription.user.premiumUntil > new Date()
        ? subscription.user.premiumUntil
        : new Date();
    const newPremiumUntil = new Date(currentPremiumUntil);
    newPremiumUntil.setDate(newPremiumUntil.getDate() + durationDays);

    // 1. Mark subscription paid
    await tx.subscription.update({
        where: { id: subscription.id },
        data: {
            status: PaymentStatus.PAID,
            paymentGatewayData: gatewayData,
            currentPeriodStart: new Date(),
            currentPeriodEnd: newPremiumUntil,
            ...extraUpdateData,
        }
    });

    // 2. Upgrade user to Premium
    await tx.user.update({
        where: { id: subscription.userId },
        data: { isPremium: true, premiumUntil: newPremiumUntil }
    });

    // 3. Mark coupon used
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

            // Reward: every 10 paid referrals = 30 days free premium
            const totalPaid = await tx.referralHistory.count({
                where: { referrerId: referrer.id, hasPaid: true },
            });
            if (totalPaid > 0 && totalPaid % 10 === 0) {
                const referrerData = await tx.user.findUnique({
                    where: { id: referrer.id },
                    select: { premiumUntil: true },
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

    // 5. Notification for user
    await tx.notification.create({
        data: {
            userId: subscription.userId,
            type: "GENERAL",
            title: `Premium Activated${gatewayLabel ? ` via ${gatewayLabel}` : ""}`,
            message: `Your ${subscription.plan} subscription has been activated until ${newPremiumUntil.toDateString()}. Enjoy all premium features!`,
            metadata: { subscriptionId: subscription.id },
        }
    });

    // 6. Admin notification
    const admins = await tx.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        select: { id: true },
    });
    for (const admin of admins) {
        await tx.notification.create({
            data: {
                userId: admin.id,
                type: "GENERAL",
                title: "New Subscription Purchase",
                message: `${subscription.user.name} (${subscription.user.email}) purchased ${subscription.plan} plan for ৳${subscription.amount} via ${gatewayLabel || "Payment Gateway"}.`,
                metadata: {
                    subscriptionId: subscription.id,
                    userId: subscription.userId,
                    plan: subscription.plan,
                    amount: subscription.amount,
                    transactionId: subscription.transactionId,
                },
            },
        });
    }

    return { newPremiumUntil, durationDays };
};

// Send invoice email (fire and forget, non-blocking)
const sendInvoiceEmail = async (subscriptionId: string) => {
    try {
        const subscription = await prisma.subscription.findUnique({
            where: { id: subscriptionId },
            include: { user: true },
        });
        if (!subscription || subscription.status !== PaymentStatus.PAID) return;

        const planDetails = Object.values(SUBSCRIPTION_PLANS).find(p => p.plan === subscription.plan);
        const gatewayInfo = subscription.paymentGatewayData as Record<string, unknown> | null;

        const invoiceData = {
            invoiceNumber: subscription.transactionId || subscription.id,
            date: subscription.updatedAt || new Date(),
            customerName: subscription.user.name,
            customerEmail: subscription.user.email,
            planName: subscription.plan,
            durationDays: planDetails?.durationDays || 30,
            originalAmount: (gatewayInfo?.originalAmount as number) || subscription.amount,
            discountAmount: (gatewayInfo?.discountAmount as number) || 0,
            finalAmount: subscription.amount,
            couponCode: (gatewayInfo?.couponCode as string) || null,
            periodStart: subscription.currentPeriodStart || new Date(),
            periodEnd: subscription.currentPeriodEnd || new Date(),
        };

        const pdfBuffer = await generateInvoicePdf(invoiceData);

        await sendEmail({
            to: subscription.user.email,
            subject: `CareerBangla Invoice - ${subscription.plan} Subscription`,
            templateName: "invoice",
            templateData: {
                name: subscription.user.name,
                plan: subscription.plan,
                amount: invoiceData.finalAmount,
                originalAmount: invoiceData.originalAmount,
                discount: invoiceData.discountAmount,
                couponCode: invoiceData.couponCode,
                transactionId: invoiceData.invoiceNumber,
                periodStart: invoiceData.periodStart instanceof Date ? invoiceData.periodStart.toDateString() : new Date(invoiceData.periodStart).toDateString(),
                periodEnd: invoiceData.periodEnd instanceof Date ? invoiceData.periodEnd.toDateString() : new Date(invoiceData.periodEnd).toDateString(),
            },
            attachments: [
                {
                    filename: `CareerBangla-Invoice-${invoiceData.invoiceNumber}.pdf`,
                    content: pdfBuffer,
                    contentType: "application/pdf",
                },
            ],
        });
    } catch (err) {
        console.error("[Invoice Email Error]", err);
    }
};

interface ISSLCommerzIpnPayload {
    tran_id?: string;
    status?: string;
    val_id?: string;
    amount?: string;
    bank_tran_id?: string;
    card_type?: string;
}

const handleIpn = async (payload: ISSLCommerzIpnPayload) => {
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

        const validationResponse = await sslcz.validate({ val_id });
        if (validationResponse?.status === "VALID" || validationResponse?.status === "VALIDATED") {
            await prisma.$transaction(async (tx) => {
                await processSuccessfulPayment(
                    tx,
                    subscription,
                    payload as unknown as Prisma.InputJsonValue,
                    "SSLCommerz",
                    { val_id, bank_tran_id, card_type },
                );
            });

            // Send invoice email (non-blocking)
            sendInvoiceEmail(subscription.id).catch(console.error);

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
        plans: Object.entries(SUBSCRIPTION_PLANS).map(([key, val]) => ({
            name: key.charAt(0) + key.slice(1).toLowerCase(),
            planKey: key,
            amount: val.amount,
            durationDays: val.durationDays,
            description: val.description,
            features: PLAN_FEATURES,
            popular: key === "QUARTERLY",
        })),
    };
}

const getMySubscriptions = async (user: IRequestUser) => {
    const subscriptions = await prisma.subscription.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
    })
    return subscriptions;
}

const getInvoice = async (user: IRequestUser, subscriptionId: string) => {
    const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { user: true },
    });

    if (!subscription) {
        throw new AppError(status.NOT_FOUND, "Subscription not found.");
    }

    if (subscription.userId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "Access denied.");
    }

    if (subscription.status !== PaymentStatus.PAID) {
        throw new AppError(status.BAD_REQUEST, "Invoice is only available for paid subscriptions.");
    }

    const planDetails = Object.values(SUBSCRIPTION_PLANS).find(p => p.plan === subscription.plan);
    const gatewayInfo = subscription.paymentGatewayData as Record<string, unknown> | null;

    const invoiceData = {
        invoiceNumber: subscription.transactionId || subscription.id,
        date: subscription.updatedAt || new Date(),
        customerName: subscription.user.name,
        customerEmail: subscription.user.email,
        planName: subscription.plan,
        durationDays: planDetails?.durationDays || 30,
        originalAmount: (gatewayInfo?.originalAmount as number) || subscription.amount,
        discountAmount: (gatewayInfo?.discountAmount as number) || 0,
        finalAmount: subscription.amount,
        couponCode: (gatewayInfo?.couponCode as string) || null,
        periodStart: subscription.currentPeriodStart || new Date(),
        periodEnd: subscription.currentPeriodEnd || new Date(),
    };

    return generateInvoicePdf(invoiceData);
};

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
                await prisma.$transaction(async (tx) => {
                    await processSuccessfulPayment(
                        tx,
                        subscription,
                        session as unknown as Prisma.InputJsonValue,
                        "Stripe",
                    );
                });

                // Send invoice email (non-blocking)
                sendInvoiceEmail(subscription.id).catch(console.error);
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
    getInvoice,
    handleStripeWebhook,
}
