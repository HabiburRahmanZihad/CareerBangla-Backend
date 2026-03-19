import { prisma } from "../../lib/prisma";

const getReferralTracking = async (page: number = 1, limit: number = 20) => {
    const skip = (page - 1) * limit;

    const data = await prisma.referralHistory.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
            referrer: {
                select: { id: true, name: true, email: true, referralCode: true, isPremium: true }
            },
            referredUser: {
                select: { id: true, name: true, email: true, isPremium: true }
            }
        }
    });

    const total = await prisma.referralHistory.count();

    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        },
        data
    }
}

const getCouponUsageTracking = async (page: number = 1, limit: number = 20) => {
    const skip = (page - 1) * limit;

    // A simple query to show coupons that have usage > 0, or just all coupons' usage.
    const data = await prisma.coupon.findMany({
        where: {
            usageCount: { gt: 0 }
        },
        skip,
        take: limit,
        orderBy: { usedAt: 'desc' },
    });

    const total = await prisma.coupon.count({
        where: { usageCount: { gt: 0 } }
    });

    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        },
        data
    }
}

export const TrackingService = {
    getReferralTracking,
    getCouponUsageTracking
};
