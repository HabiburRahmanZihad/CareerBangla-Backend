import crypto from "crypto";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";

const generateUniqueReferralCode = async (name?: string | null): Promise<string> => {
    const prefix = name
        ? name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, "").padEnd(2, "X")
        : "USER";

    for (let attempt = 0; attempt < 10; attempt++) {
        const suffix = crypto.randomInt(100000, 999999).toString();
        const code = `${prefix}${suffix}`;

        const existing = await prisma.user.findUnique({
            where: { referralCode: code },
            select: { id: true },
        });

        if (!existing) return code;
    }

    return `REF${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

const getMyReferralStats = async (user: IRequestUser) => {
    logger.read(`Fetching referral stats → userId: ${user.userId}`);
    let dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { referralCode: true, name: true, isPremium: true, premiumUntil: true },
    });

    // Auto-generate referral code for existing users who don't have one
    if (dbUser && !dbUser.referralCode) {
        const referralCode = await generateUniqueReferralCode(dbUser.name);
        dbUser = await prisma.user.update({
            where: { id: user.userId },
            data: { referralCode },
            select: { referralCode: true, name: true, isPremium: true, premiumUntil: true },
        });
    }

    const totalReferrals = await prisma.referralHistory.count({
        where: { referrerId: user.userId },
    });

    const totalPaidReferrals = await prisma.referralHistory.count({
        where: { referrerId: user.userId, hasPaid: true },
    });

    const recentReferrals = await prisma.referralHistory.findMany({
        where: { referrerId: user.userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
            referredUser: {
                select: { name: true, email: true, createdAt: true },
            },
        },
    });

    const rewardsEarned = Math.floor(totalPaidReferrals / 10);
    const progressToNext = totalPaidReferrals % 10;

    return {
        referralCode: dbUser?.referralCode || null,
        totalReferrals,
        totalPaidReferrals,
        rewardsEarned,
        progressToNext,
        recentReferrals: recentReferrals.map((r) => ({
            id: r.id,
            referredUserName: r.referredUser.name,
            referredUserEmail: r.referredUser.email,
            hasPaid: r.hasPaid,
            paidAt: r.paidAt,
            createdAt: r.createdAt,
        })),
    };
};

const searchReferrals = async (user: IRequestUser, search: string) => {
    logger.read(`Searching referrals → userId: ${user.userId}, search: ${search}`);

    const searchQuery = search.trim().toLowerCase();

    const referrals = await prisma.referralHistory.findMany({
        where: {
            referrerId: user.userId,
            OR: [
                {
                    referredUser: {
                        name: {
                            contains: searchQuery,
                            mode: "insensitive",
                        },
                    },
                },
                {
                    referredUser: {
                        email: {
                            contains: searchQuery,
                            mode: "insensitive",
                        },
                    },
                },
            ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
            referredUser: {
                select: { name: true, email: true, createdAt: true },
            },
        },
    });

    return {
        results: referrals.map((r) => ({
            id: r.id,
            referredUserName: r.referredUser.name,
            referredUserEmail: r.referredUser.email,
            hasPaid: r.hasPaid,
            paidAt: r.paidAt,
            createdAt: r.createdAt,
        })),
        count: referrals.length,
    };
};

export const ReferralService = {
    getMyReferralStats,
    searchReferrals,
};
