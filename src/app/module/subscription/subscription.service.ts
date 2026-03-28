import status from "http-status";
import SSLCommerzPayment from "sslcommerz-lts";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "../../../generated/prisma/client";
import { PaymentStatus, Role, SubscriptionPlan } from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../utils/email";
import { generateInvoicePdf } from "../../utils/invoice";
import { logger } from "../../utils/logger";

// Subscription Plans
interface SubscriptionPlanConfig {
    name: string;
    planKey: string;
    amount: number;
    description: string;
    durationDays: number | null; // null for lifetime
    features: string[];
    recruiterOnly?: boolean;
    isActive?: boolean;
}

interface IUpdateSubscriptionPlanConfigPayload {
    name?: string;
    amount?: number;
    description?: string;
    features?: string[];
    timelinePreset?: "LIFETIME" | "MONTHLY" | "THREE_MONTHS" | "SIX_MONTHS" | "YEARLY" | "CUSTOM";
    customDays?: number;
    isActive?: boolean;
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
    RECRUITER_MONTHLY: {
        name: "Recruiter Premium (Monthly)",
        planKey: "RECRUITER_MONTHLY",
        amount: 2999,
        description: "Monthly access to all recruiter premium features. Renews every 30 days.",
        durationDays: 30,
        features: [
            "Post unlimited jobs",
            "View full applicant profiles and contact info",
            "Download applicant CVs",
            "Schedule interviews",
            "Priority support",
        ],
    },
    RECRUITER_6_MONTHS: {
        name: "Recruiter Premium (3 Months)",
        planKey: "RECRUITER_6_MONTHS",
        amount: 7999,
        description: "3 months of recruiter premium features. Save compared to monthly.",
        durationDays: 90,
        features: [
            "Post unlimited jobs",
            "View full applicant profiles and contact info",
            "Download applicant CVs",
            "Schedule interviews",
            "Priority support",
            "Multi-month savings",
        ],
    },
    RECRUITER_YEARLY: {
        name: "Recruiter Premium (Yearly)",
        planKey: "RECRUITER_YEARLY",
        amount: 29999,
        description: "Full year of recruiter premium features. Save 33% compared to monthly.",
        durationDays: 365,
        features: [
            "Post unlimited jobs",
            "View full applicant profiles and contact info",
            "Download applicant CVs",
            "Schedule interviews",
            "Priority support",
            "Save 33% vs monthly",
            "Annual billing discount",
        ],
    },
};

const PLAN_KEY_BY_ENUM: Partial<Record<SubscriptionPlan, string>> = {
    [SubscriptionPlan.PREMIUM]: "BOOST_LIFETIME",
    [SubscriptionPlan.RECRUITER_MONTHLY]: "RECRUITER_MONTHLY",
    [SubscriptionPlan.RECRUITER_6_MONTHS]: "RECRUITER_6_MONTHS",
    [SubscriptionPlan.RECRUITER_YEARLY]: "RECRUITER_YEARLY",
};

const TIMELINE_PRESET_TO_DAYS: Record<"LIFETIME" | "MONTHLY" | "THREE_MONTHS" | "SIX_MONTHS" | "YEARLY", number | null> = {
    LIFETIME: null,
    MONTHLY: 30,
    THREE_MONTHS: 90,
    SIX_MONTHS: 180,
    YEARLY: 365,
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

const parseFeatures = (features: unknown, fallback: string[]): string[] => {
    if (Array.isArray(features)) {
        return features
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return fallback;
};

const ensurePlanSetting = async (planKey: string) => {
    const defaultPlan = SUBSCRIPTION_PLANS[planKey];
    if (!defaultPlan) {
        throw new AppError(status.BAD_REQUEST, `Invalid subscription plan: ${planKey}`);
    }

    const setting = await prisma.subscriptionPlanSetting.upsert({
        where: { planKey },
        create: {
            planKey,
            name: defaultPlan.name,
            amount: defaultPlan.amount,
            description: defaultPlan.description,
            durationDays: defaultPlan.durationDays,
            features: defaultPlan.features as unknown as Prisma.InputJsonValue,
            recruiterOnly: planKey.startsWith("RECRUITER_"),
            isActive: true,
        },
        update: {},
    });

    return setting;
};

const mapSettingToPlanConfig = (
    setting: {
        planKey: string;
        name: string;
        amount: number;
        description: string;
        durationDays: number | null;
        features: unknown;
        recruiterOnly: boolean;
        isActive: boolean;
    },
    fallback: SubscriptionPlanConfig,
): SubscriptionPlanConfig => {
    return {
        planKey: setting.planKey,
        name: setting.name,
        amount: setting.amount,
        description: setting.description,
        durationDays: setting.durationDays,
        features: parseFeatures(setting.features, fallback.features),
        recruiterOnly: setting.recruiterOnly,
        isActive: setting.isActive,
    };
};

const getPlanConfig = async (planKey: string): Promise<SubscriptionPlanConfig> => {
    const defaultPlan = SUBSCRIPTION_PLANS[planKey];
    if (!defaultPlan) {
        throw new AppError(status.BAD_REQUEST, `Invalid subscription plan: ${planKey}`);
    }

    const setting = await ensurePlanSetting(planKey);
    return mapSettingToPlanConfig(setting, defaultPlan);
};

const getPlanConfigFromSubscription = async (subscription: {
    plan: SubscriptionPlan;
    paymentGatewayData: Prisma.JsonValue;
}): Promise<SubscriptionPlanConfig> => {
    const gatewayData = subscription.paymentGatewayData as Record<string, unknown> | null;
    const keyFromGateway = typeof gatewayData?.planKey === "string" ? gatewayData.planKey : undefined;
    const keyFromEnum = PLAN_KEY_BY_ENUM[subscription.plan];
    const resolvedKey = keyFromGateway || keyFromEnum || "BOOST_LIFETIME";
    return getPlanConfig(resolvedKey);
};

interface ICustomerInfo {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    postcode?: string;
}

const initiatePayment = async (user: IRequestUser, payload: { planKey?: string; couponCode?: string; referralCode?: string; customerInfo?: ICustomerInfo }) => {
    const gateway = "SSLCOMMERZ" as const;
    const planKey = payload.planKey || "BOOST_LIFETIME";
    logger.create(`Payment initiation → userId: ${user.userId}, plan: ${planKey}, gateway: ${gateway}`);

    // Prevent ADMIN and SUPER_ADMIN from purchasing subscriptions
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
        throw new AppError(
            status.FORBIDDEN,
            "Admin users cannot purchase premium subscriptions"
        );
    }

    // Get plan configuration
    const plan = await getPlanConfig(planKey);

    // Determine if this is a recruiter subscription
    const isRecruiterSubscription = planKey.startsWith("RECRUITER_");

    // Get plan enum value
    const planEnum = ({
        BOOST_LIFETIME: SubscriptionPlan.PREMIUM,
        RECRUITER_MONTHLY: SubscriptionPlan.RECRUITER_MONTHLY,
        RECRUITER_6_MONTHS: SubscriptionPlan.RECRUITER_6_MONTHS,
        RECRUITER_YEARLY: SubscriptionPlan.RECRUITER_YEARLY,
    }[planKey] || SubscriptionPlan.PREMIUM) as SubscriptionPlan;

    // Check if user already has lifetime Career Boost
    if (planKey === "BOOST_LIFETIME") {
        const existingUser = await prisma.user.findUnique({ where: { id: user.userId } });
        if (existingUser?.isPremium && !existingUser.premiumUntil) {
            throw new AppError(status.BAD_REQUEST, "You already have lifetime Career Boost access.");
        }
    }

    // For recruiter subscriptions, check if recruiter profile exists
    if (isRecruiterSubscription) {
        const recruiter = await prisma.recruiter.findUnique({
            where: { userId: user.userId }
        });
        if (!recruiter) {
            throw new AppError(status.BAD_REQUEST, "Recruiter profile not found. Please complete recruiter registration first.");
        }
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

    // Calculate subscription period dates
    const currentPeriodStart = new Date();
    const currentPeriodEnd = plan.durationDays
        ? new Date(currentPeriodStart.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)
        : null;

    // Create subscription record
    await prisma.subscription.create({
        data: {
            userId: user.userId,
            plan: planEnum,
            isRecruiterSubscription,
            currentPeriodStart: planKey === "BOOST_LIFETIME" ? null : currentPeriodStart,
            currentPeriodEnd,
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
                customerInfo: payload.customerInfo
                    ? {
                        name: payload.customerInfo.name || null,
                        phone: payload.customerInfo.phone || null,
                        address: payload.customerInfo.address || null,
                        city: payload.customerInfo.city || null,
                        postcode: payload.customerInfo.postcode || null,
                    }
                    : null,
            } as unknown as Prisma.InputJsonValue,
        }
    });

    const isLive = envVars.SSLCOMMERZ.IS_LIVE;
    const sslcz = new SSLCommerzPayment(envVars.SSLCOMMERZ.STORE_ID, envVars.SSLCOMMERZ.STORE_PASSWORD, isLive);

    const cusName = payload.customerInfo?.name || (user as IRequestUser & { name?: string }).name || 'CareerBangla User';
    const cusPhone = payload.customerInfo?.phone || '01711111111';
    const cusAddress = payload.customerInfo?.address || 'Dhaka';
    const cusCity = payload.customerInfo?.city || 'Dhaka';
    const cusPostcode = payload.customerInfo?.postcode || '1000';

    const sslczData = {
        total_amount: finalAmount,
        currency: 'BDT',
        tran_id: transactionId,
        success_url: `${envVars.BACKEND_URL}/api/v1/subscriptions/ipn`,
        fail_url: `${envVars.BACKEND_URL}/api/v1/subscriptions/ipn`,
        cancel_url: `${envVars.BACKEND_URL}/api/v1/subscriptions/ipn`,
        ipn_url: `${envVars.BACKEND_URL}/api/v1/subscriptions/ipn`,
        shipping_method: 'No',
        product_name: plan.name,
        product_category: 'Subscription',
        product_profile: 'non-physical-goods',
        cus_name: cusName,
        cus_email: user.email,
        cus_add1: cusAddress,
        cus_add2: cusAddress,
        cus_city: cusCity,
        cus_state: cusCity,
        cus_postcode: cusPostcode,
        cus_country: 'Bangladesh',
        cus_phone: cusPhone,
        cus_fax: cusPhone,
        ship_name: cusName,
        ship_add1: cusAddress,
        ship_add2: cusAddress,
        ship_city: cusCity,
        ship_state: cusCity,
        ship_postcode: parseInt(cusPostcode) || 1000,
        ship_country: 'Bangladesh',
    };

    const apiResponse = await sslcz.init(sslczData);
    if (apiResponse?.GatewayPageURL) {
        return { paymentUrl: apiResponse.GatewayPageURL };
    } else {
        throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to initiate SSLCommerz payment.");
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
        isRecruiterSubscription: boolean;
        user: { id: string; name: string; email: string; referredBy: string | null; premiumUntil: Date | null; isPremium: boolean };
        paymentGatewayData: Prisma.JsonValue;
    },
    gatewayData: Prisma.InputJsonValue,
    gatewayLabel: string,
    extraUpdateData: Record<string, unknown> = {},
) => {
    const planConfig = await getPlanConfigFromSubscription(subscription);
    const isLifetimePlan = planConfig.durationDays === null;

    const now = new Date();
    const baseDate = subscription.user.premiumUntil && new Date(subscription.user.premiumUntil) > now
        ? new Date(subscription.user.premiumUntil)
        : now;
    const currentPeriodStart = isLifetimePlan ? now : baseDate;
    const currentPeriodEnd = isLifetimePlan
        ? null
        : new Date(baseDate.getTime() + (planConfig.durationDays || 0) * 24 * 60 * 60 * 1000);

    // 1. Mark subscription paid
    await tx.subscription.update({
        where: { id: subscription.id },
        data: {
            status: PaymentStatus.PAID,
            paymentGatewayData: gatewayData,
            currentPeriodStart,
            currentPeriodEnd,
            ...extraUpdateData,
        }
    });

    // 2. Upgrade user premium state
    await tx.user.update({
        where: { id: subscription.userId },
        data: {
            isPremium: true,
            premiumUntil: isLifetimePlan ? null : currentPeriodEnd,
        }
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

            // Notify referrer about successful referral
            await tx.notification.create({
                data: {
                    userId: referrer.id,
                    type: "GENERAL",
                    title: "Successful Referral!",
                    message: `Great news! ${subscription.user.name} signed up using your referral code and just purchased Career Boost. Keep sharing to earn rewards!`,
                },
            });

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
            title: `${planConfig.name} Activated${gatewayLabel ? ` via ${gatewayLabel}` : ""}`,
            message: isLifetimePlan
                ? `Your ${planConfig.name} has been activated. Enjoy premium features forever!`
                : `Your ${planConfig.name} has been activated until ${currentPeriodEnd?.toDateString()}.`,
            metadata: { subscriptionId: subscription.id },
        }
    });

    // 6. Admin notifications (batch insert)
    const admins = await tx.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        select: { id: true },
    });
    if (admins.length > 0) {
        await tx.notification.createMany({
            data: admins.map((admin: { id: string }) => ({
                userId: admin.id,
                type: "GENERAL" as const,
                title: "New Subscription Purchase",
                message: `${subscription.user.name} (${subscription.user.email}) purchased ${planConfig.name} for ৳${subscription.amount} via ${gatewayLabel || "Payment Gateway"}.`,
                metadata: {
                    subscriptionId: subscription.id,
                    userId: subscription.userId,
                    plan: planConfig.planKey,
                    amount: subscription.amount,
                    transactionId: subscription.transactionId,
                },
            })),
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

        const planConfig = await getPlanConfigFromSubscription(subscription as unknown as { plan: SubscriptionPlan; paymentGatewayData: Prisma.JsonValue });

        const invoiceData = {
            invoiceNumber: subscription.transactionId || subscription.id,
            date: subscription.updatedAt || new Date(),
            customerName: subscription.user.name,
            customerEmail: subscription.user.email,
            planName: planConfig.name,
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
                plan: planConfig.name,
                amount: invoiceData.finalAmount,
                originalAmount: invoiceData.originalAmount,
                discount: invoiceData.discountAmount,
                couponCode: invoiceData.couponCode,
                transactionId: invoiceData.invoiceNumber,
                periodStart: invoiceData.periodStart instanceof Date ? invoiceData.periodStart.toDateString() : new Date(invoiceData.periodStart).toDateString(),
                periodEnd: subscription.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toDateString()
                    : "Lifetime",
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
        logger.error("Invoice email failed", err);
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

            sendInvoiceEmail(subscription.id).catch((err) => logger.error("Invoice email failed", err));

            return { redirectUrl: `${envVars.FRONTEND_URL}/dashboard/subscriptions?payment=success` };
        }
    } else if (paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
        await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: PaymentStatus.FAILED }
        });

        // Notify user about failed/cancelled payment
        await prisma.notification.create({
            data: {
                userId: subscription.userId,
                type: "GENERAL",
                title: paymentStatus === "CANCELLED" ? "Payment Cancelled" : "Payment Failed",
                message: paymentStatus === "CANCELLED"
                    ? "Your Career Boost payment was cancelled. You can try again anytime from the subscriptions page."
                    : "Your Career Boost payment failed. Please try again or use a different payment method.",
                metadata: { subscriptionId: subscription.id, transactionId: subscription.transactionId },
            }
        });

        return { redirectUrl: `${envVars.FRONTEND_URL}/dashboard/subscriptions?payment=${paymentStatus.toLowerCase()}` };
    }

    return { redirectUrl: `${envVars.FRONTEND_URL}/dashboard/subscriptions?payment=unknown` };
}

const cancelSubscription = async (user: IRequestUser, subscriptionId: string) => {
    // Prevent ADMIN and SUPER_ADMIN from managing subscriptions
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
        throw new AppError(
            status.FORBIDDEN,
            "Admin users cannot manage subscriptions"
        );
    }
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
    const planKeys = Object.keys(SUBSCRIPTION_PLANS);

    await Promise.all(planKeys.map((planKey) => ensurePlanSetting(planKey)));

    const settings = await prisma.subscriptionPlanSetting.findMany({
        where: { planKey: { in: planKeys } },
        orderBy: { createdAt: "asc" },
    });

    const settingsMap = new Map(settings.map((setting) => [setting.planKey, setting]));

    return {
        plans: planKeys.map((planKey) => {
            const fallback = SUBSCRIPTION_PLANS[planKey];
            const setting = settingsMap.get(planKey);

            const merged = setting
                ? mapSettingToPlanConfig(setting, fallback)
                : {
                    ...fallback,
                    recruiterOnly: planKey.startsWith("RECRUITER_"),
                    isActive: true,
                };

            return {
                name: merged.name,
                planKey: merged.planKey,
                amount: merged.amount,
                description: merged.description,
                features: merged.features,
                lifetime: merged.durationDays === null,
                durationDays: merged.durationDays,
                recruiterOnly: merged.recruiterOnly,
                isActive: merged.isActive,
            };
        }),
    };
}

const updateSubscriptionPlanConfig = async (planKey: string, payload: IUpdateSubscriptionPlanConfigPayload) => {
    logger.update(`Subscription plan update requested → planKey: ${planKey}`);

    const defaultPlan = SUBSCRIPTION_PLANS[planKey];
    if (!defaultPlan) {
        throw new AppError(status.BAD_REQUEST, `Invalid subscription plan: ${planKey}`);
    }

    let resolvedDurationDays: number | null | undefined;
    if (payload.timelinePreset) {
        if (payload.timelinePreset === "CUSTOM") {
            if (!payload.customDays || payload.customDays < 1) {
                throw new AppError(status.BAD_REQUEST, "customDays must be greater than 0 for CUSTOM timeline");
            }
            resolvedDurationDays = payload.customDays;
        } else {
            resolvedDurationDays = TIMELINE_PRESET_TO_DAYS[payload.timelinePreset];
        }
    } else if (payload.customDays !== undefined) {
        if (payload.customDays < 1) {
            throw new AppError(status.BAD_REQUEST, "customDays must be greater than 0");
        }
        resolvedDurationDays = payload.customDays;
    }

    const current = await ensurePlanSetting(planKey);

    const updated = await prisma.subscriptionPlanSetting.update({
        where: { planKey },
        data: {
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
            ...(payload.description !== undefined ? { description: payload.description } : {}),
            ...(payload.features !== undefined ? { features: payload.features as unknown as Prisma.InputJsonValue } : {}),
            ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
            ...(resolvedDurationDays !== undefined ? { durationDays: resolvedDurationDays } : {}),
        },
    });

    const merged = mapSettingToPlanConfig(updated, defaultPlan);
    logger.update(`Subscription plan updated → planKey: ${planKey}`);

    return {
        name: merged.name,
        planKey: merged.planKey,
        amount: merged.amount,
        description: merged.description,
        features: merged.features,
        lifetime: merged.durationDays === null,
        durationDays: merged.durationDays,
        recruiterOnly: merged.recruiterOnly,
        isActive: merged.isActive,
        previousDurationDays: current.durationDays,
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

    const planConfig = await getPlanConfigFromSubscription(subscription as unknown as { plan: SubscriptionPlan; paymentGatewayData: Prisma.JsonValue });

    const invoiceData = {
        invoiceNumber: subscription.transactionId || subscription.id,
        date: subscription.updatedAt || new Date(),
        customerName: subscription.user.name,
        customerEmail: subscription.user.email,
        planName: planConfig.name,
        originalAmount: (gatewayInfo?.originalAmount as number) || subscription.amount,
        discountAmount: (gatewayInfo?.discountAmount as number) || 0,
        finalAmount: subscription.amount,
        couponCode: (gatewayInfo?.couponCode as string) || null,
        periodStart: subscription.currentPeriodStart || new Date(),
    };

    return generateInvoicePdf(invoiceData);
};

export const SubscriptionService = {
    initiatePayment,
    handleIpn,
    cancelSubscription,
    getSubscriptionPlans,
    updateSubscriptionPlanConfig,
    getMySubscriptions,
    getInvoice,
}
