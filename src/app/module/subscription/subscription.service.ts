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
import { sendEmail } from "../../utils/email";
import { generateInvoicePdf } from "../../utils/invoice";
import { logger } from "../../utils/logger";

const stripe = new Stripe(envVars.STRIPE.SECRET_KEY, { apiVersion: "2026-01-28.clover" });

// Subscription Plans
interface SubscriptionPlanConfig {
    name: string;
    planKey: string;
    amount: number;
    description: string;
    durationDays: number | null; // null for lifetime
    features: string[];
}

const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlanConfig> = {
    BOOST_LIFETIME: {
        name: "Career Boost (Lifetime)",
        planKey: "BOOST_LIFETIME",
        amount: 4999,
        description: "Lifetime access to all Career Boost features. One-time payment, no recurring charges.",
        durationDays: null,
        features: [
            "Download Custom ATS PDF",
            "Unlimited Profile Editing",
            "Priority Application Review",
            "Career Boost Badge on Profile",
            "Lifetime Access",
        ],
    },
};

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

const getPlanConfig = (planKey: string): SubscriptionPlanConfig => {
    const plan = SUBSCRIPTION_PLANS[planKey];
    if (!plan) {
        throw new AppError(status.BAD_REQUEST, `Invalid subscription plan: ${planKey}`);
    }
    return plan;
};

const initiatePayment = async (user: IRequestUser, payload: { planKey?: string; couponCode?: string; referralCode?: string; gateway?: "STRIPE" | "SSLCOMMERZ" }) => {
    const gateway = payload.gateway || "SSLCOMMERZ";
    const planKey = payload.planKey || "BOOST_LIFETIME";
    logger.create(`Payment initiation → userId: ${user.userId}, plan: ${planKey}, gateway: ${gateway}`);

    // Get plan configuration
    const plan = getPlanConfig(planKey);

    // Check if user already has lifetime Career Boost
    const existingUser = await prisma.user.findUnique({ where: { id: user.userId } });
    if (existingUser?.isPremium && !existingUser.premiumUntil) {
        throw new AppError(status.BAD_REQUEST, "You already have lifetime Career Boost access.");
    }

    let finalAmount = plan.amount;
    let appliedCouponId: string | undefined;
    let discountAmount = 0;

    // Coupon validation and discount calculation
    if (payload.couponCode) {
        const coupon = await prisma.coupon.findUnique({ where: { code: payload.couponCode.toUpperCase() } });
        if (coupon && coupon.status === "ACTIVE" && (!coupon.expiresAt || new Date(coupon.expiresAt) > new Date()) && coupon.usageCount < coupon.maxUsage) {
            appliedCouponId = coupon.id;
            discountAmount = calculateDiscount(plan.amount, coupon);
            finalAmount = plan.amount - discountAmount;
            if (finalAmount < 1) finalAmount = 1;
        } else {
            throw new AppError(status.BAD_REQUEST, "Invalid or expired coupon code.");
        }
    }

    const transactionId = `TXN-${uuidv4().substring(0, 8)}-${Date.now()}`;

    let referralId: string | undefined;
    if (payload.referralCode) {
        referralId = payload.referralCode;
    }

    // Create subscription record
    await prisma.subscription.create({
        data: {
            userId: user.userId,
            plan: SubscriptionPlan.PREMIUM,
            amount: finalAmount,
            transactionId,
            status: PaymentStatus.UNPAID,
            couponId: appliedCouponId,
            referralId,
            paymentGatewayData: {
                gateway,
                planKey,
                originalAmount: plan.amount,
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
                            name: plan.name,
                            description: `${plan.description}${discountAmount > 0 ? ` (Discount: ৳${discountAmount})` : ""}`,
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
            product_name: 'CareerBangla Career Boost (Lifetime)',
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
    // 1. Mark subscription paid (lifetime - no period end)
    await tx.subscription.update({
        where: { id: subscription.id },
        data: {
            status: PaymentStatus.PAID,
            paymentGatewayData: gatewayData,
            currentPeriodStart: new Date(),
            currentPeriodEnd: null,
            ...extraUpdateData,
        }
    });

    // 2. Upgrade user to Lifetime Career Boost (premiumUntil = null means lifetime)
    await tx.user.update({
        where: { id: subscription.userId },
        data: { isPremium: true, premiumUntil: null }
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

            // Reward: every 10 paid referrals = 30 days free Career Boost
            const totalPaid = await tx.referralHistory.count({
                where: { referrerId: referrer.id, hasPaid: true },
            });
            if (totalPaid > 0 && totalPaid % 10 === 0) {
                const referrerData = await tx.user.findUnique({
                    where: { id: referrer.id },
                    select: { premiumUntil: true, isPremium: true },
                });

                // If referrer already has lifetime Career Boost, track reward but don't change access
                if (referrerData?.isPremium && !referrerData.premiumUntil) {
                    await tx.notification.create({
                        data: {
                            userId: referrer.id,
                            type: "GENERAL",
                            title: "Referral Milestone Reached!",
                            message: `Congratulations! You've reached ${totalPaid} successful referrals. Since you already have lifetime Career Boost, this milestone has been recorded. Thank you for spreading the word!`,
                        },
                    });
                } else {
                    // Give 30 days Career Boost (stack on existing if any)
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
                            message: `Congratulations! You've reached ${totalPaid} successful referrals. 30 days of free Career Boost has been added to your account!`,
                        },
                    });
                }
            }
        }
    }

    // 5. Notification for user
    await tx.notification.create({
        data: {
            userId: subscription.userId,
            type: "GENERAL",
            title: `Career Boost Activated${gatewayLabel ? ` via ${gatewayLabel}` : ""}`,
            message: `Your lifetime Career Boost subscription has been activated. Enjoy all Career Boost features forever!`,
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
                title: "New Career Boost Purchase",
                message: `${subscription.user.name} (${subscription.user.email}) purchased Lifetime Career Boost for ৳${subscription.amount} via ${gatewayLabel || "Payment Gateway"}.`,
                metadata: {
                    subscriptionId: subscription.id,
                    userId: subscription.userId,
                    plan: "CAREER_BOOST",
                    amount: subscription.amount,
                    transactionId: subscription.transactionId,
                },
            },
        });
    }
};

// Send invoice email (fire and forget, non-blocking)
const sendInvoiceEmail = async (subscriptionId: string) => {
    try {
        const subscription = await prisma.subscription.findUnique({
            where: { id: subscriptionId },
            include: { user: true },
        });
        if (!subscription || subscription.status !== PaymentStatus.PAID) return;

        const gatewayInfo = subscription.paymentGatewayData as Record<string, unknown> | null;

        const invoiceData = {
            invoiceNumber: subscription.transactionId || subscription.id,
            date: subscription.updatedAt || new Date(),
            customerName: subscription.user.name,
            customerEmail: subscription.user.email,
            planName: "Career Boost (Lifetime)",
            originalAmount: (gatewayInfo?.originalAmount as number) || subscription.amount,
            discountAmount: (gatewayInfo?.discountAmount as number) || 0,
            finalAmount: subscription.amount,
            couponCode: (gatewayInfo?.couponCode as string) || null,
            periodStart: subscription.currentPeriodStart || new Date(),
        };

        const pdfBuffer = await generateInvoicePdf(invoiceData);

        await sendEmail({
            to: subscription.user.email,
            subject: "CareerBangla Invoice - Career Boost Subscription",
            templateName: "invoice",
            templateData: {
                name: subscription.user.name,
                plan: "Career Boost (Lifetime)",
                amount: invoiceData.finalAmount,
                originalAmount: invoiceData.originalAmount,
                discount: invoiceData.discountAmount,
                couponCode: invoiceData.couponCode,
                transactionId: invoiceData.invoiceNumber,
                periodStart: invoiceData.periodStart instanceof Date ? invoiceData.periodStart.toDateString() : new Date(invoiceData.periodStart).toDateString(),
                periodEnd: "Lifetime",
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
    logger.update(`SSLCommerz IPN received → tran_id: ${payload.tran_id}, status: ${payload.status}`);
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
    logger.update(`Subscription cancel requested → userId: ${user.userId}, subscriptionId: ${subscriptionId}`);
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

    throw new AppError(status.BAD_REQUEST, "Lifetime Career Boost subscriptions cannot be cancelled.");
}

const getSubscriptionPlans = async () => {
    logger.read("Fetching subscription plans");
    return {
        plans: [
            {
                name: SUBSCRIPTION_PLANS.BOOST_LIFETIME.name,
                planKey: SUBSCRIPTION_PLANS.BOOST_LIFETIME.planKey,
                amount: SUBSCRIPTION_PLANS.BOOST_LIFETIME.amount,
                description: SUBSCRIPTION_PLANS.BOOST_LIFETIME.description,
                features: SUBSCRIPTION_PLANS.BOOST_LIFETIME.features,
                lifetime: true,
            },
        ],
    };
}

const getMySubscriptions = async (user: IRequestUser) => {
    logger.read(`Fetching user subscriptions → userId: ${user.userId}`);
    const subscriptions = await prisma.subscription.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
    })
    return subscriptions;
}

const getInvoice = async (user: IRequestUser, subscriptionId: string) => {
    logger.read(`Fetching invoice → userId: ${user.userId}, subscriptionId: ${subscriptionId}`);
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

    const gatewayInfo = subscription.paymentGatewayData as Record<string, unknown> | null;

    const invoiceData = {
        invoiceNumber: subscription.transactionId || subscription.id,
        date: subscription.updatedAt || new Date(),
        customerName: subscription.user.name,
        customerEmail: subscription.user.email,
        planName: "Career Boost (Lifetime)",
        originalAmount: (gatewayInfo?.originalAmount as number) || subscription.amount,
        discountAmount: (gatewayInfo?.discountAmount as number) || 0,
        finalAmount: subscription.amount,
        couponCode: (gatewayInfo?.couponCode as string) || null,
        periodStart: subscription.currentPeriodStart || new Date(),
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
    logger.update("Stripe webhook received");
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
