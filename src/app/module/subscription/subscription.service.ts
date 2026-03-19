import status from "http-status";
import { SubscriptionPlan, PaymentStatus } from "../../../generated/prisma/enums";
import { Prisma } from "../../../generated/prisma/client";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { v4 as uuidv4 } from "uuid";
// @ts-ignore
import SSLCommerzPayment from "sslcommerz-lts";
import { prisma } from "../../lib/prisma";

const SUBSCRIPTION_PLANS = {
    MONTHLY: { durationDays: 30, amount: 500, plan: SubscriptionPlan.MONTHLY },
    QUARTERLY: { durationDays: 90, amount: 1300, plan: SubscriptionPlan.QUARTERLY },
    BIANNUAL: { durationDays: 180, amount: 2500, plan: SubscriptionPlan.BIANNUAL },
    YEARLY: { durationDays: 365, amount: 4500, plan: SubscriptionPlan.YEARLY },
};

const initiatePayment = async (user: IRequestUser, payload: { planName: string; couponCode?: string; referralCode?: string }) => {
    const planKey = payload.planName.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
    const planDetails = SUBSCRIPTION_PLANS[planKey];

    if (!planDetails) {
        throw new AppError(status.BAD_REQUEST, "Invalid subscription plan.");
    }

    let finalAmount = planDetails.amount;
    let appliedCouponId: string | undefined;

    // Optional coupon logic calculation
    if (payload.couponCode) {
        const coupon = await prisma.coupon.findUnique({ where: { code: payload.couponCode.toUpperCase() } });
        if (coupon && coupon.status === "ACTIVE" && (!coupon.expiresAt || new Date(coupon.expiresAt) > new Date())) {
            if (coupon.discountPercent) {
                finalAmount = finalAmount - (finalAmount * (coupon.discountPercent / 100));
            } else if (coupon.discountAmount) {
                finalAmount = finalAmount - coupon.discountAmount;
            }
            if (finalAmount < 0) finalAmount = 0;
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
        cus_name: (user as any).name || 'CareerBangla User',
        cus_email: user.email,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: (user as any).name || 'CareerBangla User',
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

const handleIpn = async (payload: any) => {
    // SSLCommerz sends POST data to IPN
    const { tran_id, status: paymentStatus, val_id, amount, bank_tran_id, card_type } = payload;

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

                // 4. Handle Referral Bonus (Refer 10 Paid Users = 1 Month Free)
                if (subscription.user.referredBy) {
                    const referrerCode = subscription.user.referredBy;
                    const referrer = await tx.user.findUnique({ where: { referralCode: referrerCode } });

                    if (referrer) {
                        // Create referral history entry
                        await tx.referralHistory.create({
                            data: {
                                referrerId: referrer.id,
                                referredUserId: subscription.userId,
                                hasPaid: true,
                                paidAt: new Date(),
                            }
                        });

                        // Check total successful referrals
                        const totalReferrals = await tx.referralHistory.count({
                            where: { referrerId: referrer.id, hasPaid: true }
                        });

                        if (totalReferrals > 0 && totalReferrals % 10 === 0) {
                            // Give referrer 1 month free premium
                            const refPremiumUntil = referrer.premiumUntil && referrer.premiumUntil > new Date()
                                ? referrer.premiumUntil : new Date();
                            const newRefPremiumUntil = new Date(refPremiumUntil);
                            newRefPremiumUntil.setDate(newRefPremiumUntil.getDate() + 30);

                            await tx.user.update({
                                where: { id: referrer.id },
                                data: {
                                    isPremium: true,
                                    premiumUntil: newRefPremiumUntil,
                                }
                            });

                            await tx.notification.create({
                                data: {
                                    userId: referrer.id,
                                    type: "GENERAL",
                                    title: "Referral Bonus Unlocked!",
                                    message: "You've successfully referred 10 paid users! You have been granted 1 month of free Premium.",
                                }
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
    // In a pure duration-based model with SSLCommerz, cancelling usually just means 
    // stopping auto-renewal. Since we don't have tokenized recurring yet, we can just return.
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

export const SubscriptionService = {
    initiatePayment,
    handleIpn,
    cancelSubscription,
    getSubscriptionPlans,
    getMySubscriptions,
}
