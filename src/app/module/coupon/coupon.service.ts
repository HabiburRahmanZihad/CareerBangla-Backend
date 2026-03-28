import status from "http-status";
import { CouponStatus, CouponTargetRole, CouponType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { cacheManager } from "../../lib/cache/cache.manager";
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";

interface ICreateCouponPayload {
    code: string;
    type: CouponType;
    targetRole?: CouponTargetRole;
    description?: string;
    discountPercent?: number;
    discountAmount?: number;
    isLifetime?: boolean;
    freeDays?: number;
    freeMonths?: number;
    commissionAmount?: number;
    linkedRecruiterId?: string;
    maxUsage?: number;
    expiresAt?: string;
}

const createCoupon = async (payload: ICreateCouponPayload) => {
    logger.create(`Coupon creation → code: ${payload.code}, type: ${payload.type}`);

    const existing = await prisma.coupon.findUnique({ where: { code: payload.code.toUpperCase() } });
    if (existing) throw new AppError(status.CONFLICT, "Coupon code already exists");

    switch (payload.type) {
        case CouponType.FREE_DAYS:
        case CouponType.RECRUITER_DAYS:
            if (!payload.freeDays || payload.freeDays <= 0)
                throw new AppError(status.BAD_REQUEST, "freeDays is required and must be positive for this coupon type");
            break;
        case CouponType.RECRUITER_MONTHS:
            if (!payload.freeMonths || payload.freeMonths <= 0)
                throw new AppError(status.BAD_REQUEST, "freeMonths is required and must be positive for this coupon type");
            break;
        case CouponType.PERCENT_DISCOUNT:
            if (!payload.discountPercent || payload.discountPercent <= 0)
                throw new AppError(status.BAD_REQUEST, "discountPercent is required for this coupon type");
            break;
        case CouponType.AMOUNT_DISCOUNT:
            if (!payload.discountAmount || payload.discountAmount <= 0)
                throw new AppError(status.BAD_REQUEST, "discountAmount is required for this coupon type");
            break;
        case CouponType.REFERRAL:
            if (!payload.discountAmount || payload.discountAmount <= 0)
                throw new AppError(status.BAD_REQUEST, "discountAmount (user discount) is required for referral coupons");
            if (!payload.commissionAmount || payload.commissionAmount <= 0)
                throw new AppError(status.BAD_REQUEST, "commissionAmount (recruiter commission) is required for referral coupons");
            break;
        case CouponType.LIFETIME_FREE:
            break;
    }

    if (payload.linkedRecruiterId) {
        const recruiter = await prisma.recruiter.findUnique({ where: { id: payload.linkedRecruiterId } });
        if (!recruiter) throw new AppError(status.NOT_FOUND, "Linked recruiter not found");
    }

    const coupon = await prisma.coupon.create({
        data: {
            code: payload.code.toUpperCase(),
            type: payload.type,
            targetRole: payload.targetRole ?? CouponTargetRole.USER,
            description: payload.description,
            discountPercent: payload.discountPercent,
            discountAmount: payload.discountAmount,
            isLifetime: payload.isLifetime ?? false,
            freeDays: payload.freeDays,
            freeMonths: payload.freeMonths,
            commissionAmount: payload.commissionAmount,
            linkedRecruiterId: payload.linkedRecruiterId,
            maxUsage: payload.maxUsage ?? 1,
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        },
        include: { usages: { select: { id: true, userId: true, usedAt: true } } },
    });

    logger.create(`Coupon created → id: ${coupon.id}`);
    return coupon;
};

const getAllCoupons = async () => {
    logger.read("Fetching all coupons");
    return prisma.coupon.findMany({
        orderBy: { createdAt: "desc" },
        include: { usages: { select: { id: true, userId: true, usedAt: true } } },
    });
};

const getCouponById = async (id: string) => {
    const coupon = await prisma.coupon.findUnique({
        where: { id },
        include: { usages: { select: { id: true, userId: true, usedAt: true } } },
    });
    if (!coupon) throw new AppError(status.NOT_FOUND, "Coupon not found");
    return coupon;
};

const validateCoupon = async (user: IRequestUser, code: string) => {
    logger.read(`Validating coupon → code: ${code}`);

    const coupon = await prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
        include: { usages: { select: { userId: true } } },
    });

    if (!coupon) throw new AppError(status.NOT_FOUND, "Coupon not found");
    if (coupon.status !== CouponStatus.ACTIVE) throw new AppError(status.BAD_REQUEST, "Coupon is no longer active");
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        await prisma.coupon.update({ where: { id: coupon.id }, data: { status: CouponStatus.EXPIRED } });
        throw new AppError(status.BAD_REQUEST, "Coupon has expired");
    }
    if (coupon.usageCount >= coupon.maxUsage)
        throw new AppError(status.BAD_REQUEST, "Coupon usage limit has been reached");
    if (coupon.usages.some(u => u.userId === user.userId))
        throw new AppError(status.BAD_REQUEST, "You have already used this coupon");
    if (coupon.targetRole !== CouponTargetRole.BOTH) {
        if (coupon.targetRole === CouponTargetRole.USER && user.role !== "USER")
            throw new AppError(status.BAD_REQUEST, "This coupon is only for regular users");
        if (coupon.targetRole === CouponTargetRole.RECRUITER && user.role !== "RECRUITER")
            throw new AppError(status.BAD_REQUEST, "This coupon is only for recruiters");
    }

    return {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        targetRole: coupon.targetRole,
        description: coupon.description,
        discountPercent: coupon.discountPercent,
        discountAmount: coupon.discountAmount,
        isLifetime: coupon.isLifetime,
        freeDays: coupon.freeDays,
        freeMonths: coupon.freeMonths,
        commissionAmount: coupon.commissionAmount,
    };
};

const applyCoupon = async (user: IRequestUser, code: string) => {
    logger.update(`Applying coupon → code: ${code}, userId: ${user.userId}`);

    const coupon = await prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
        include: { usages: { select: { userId: true } } },
    });

    if (!coupon) throw new AppError(status.NOT_FOUND, "Coupon not found");
    if (coupon.status !== CouponStatus.ACTIVE) throw new AppError(status.BAD_REQUEST, "Coupon is no longer active");
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        await prisma.coupon.update({ where: { id: coupon.id }, data: { status: CouponStatus.EXPIRED } });
        throw new AppError(status.BAD_REQUEST, "Coupon has expired");
    }
    if (coupon.usageCount >= coupon.maxUsage)
        throw new AppError(status.BAD_REQUEST, "Coupon usage limit has been reached");
    if (coupon.usages.some(u => u.userId === user.userId))
        throw new AppError(status.BAD_REQUEST, "You have already used this coupon");
    if (coupon.targetRole !== CouponTargetRole.BOTH) {
        if (coupon.targetRole === CouponTargetRole.USER && user.role !== "USER")
            throw new AppError(status.BAD_REQUEST, "This coupon is only for regular users");
        if (coupon.targetRole === CouponTargetRole.RECRUITER && user.role !== "RECRUITER")
            throw new AppError(status.BAD_REQUEST, "This coupon is only for recruiters");
    }

    const addDays = (base: Date | null, days: number) =>
        new Date((base ? Math.max(base.getTime(), Date.now()) : Date.now()) + days * 86_400_000);

    const result = await prisma.$transaction(async (tx) => {
        await tx.couponUsage.create({ data: { couponId: coupon.id, userId: user.userId } });

        const newCount = coupon.usageCount + 1;
        await tx.coupon.update({
            where: { id: coupon.id },
            data: {
                usageCount: newCount,
                status: newCount >= coupon.maxUsage ? CouponStatus.USED : CouponStatus.ACTIVE,
            },
        });

        switch (coupon.type) {
            case CouponType.FREE_DAYS: {
                const days = coupon.freeDays!;
                const cur = await tx.user.findUnique({ where: { id: user.userId }, select: { premiumUntil: true } });
                await tx.user.update({ where: { id: user.userId }, data: { isPremium: true, premiumUntil: addDays(cur?.premiumUntil ?? null, days) } });
                return { message: `You received ${days} days of free premium!`, type: coupon.type };
            }
            case CouponType.LIFETIME_FREE: {
                await tx.user.update({ where: { id: user.userId }, data: { isPremium: true, premiumUntil: null } });
                return { message: "You now have lifetime premium access!", type: coupon.type };
            }
            case CouponType.RECRUITER_DAYS: {
                const days = coupon.freeDays!;
                const cur = await tx.user.findUnique({ where: { id: user.userId }, select: { premiumUntil: true } });
                await tx.user.update({ where: { id: user.userId }, data: { isPremium: true, premiumUntil: addDays(cur?.premiumUntil ?? null, days) } });
                return { message: `${days} free days added to your recruiter account!`, type: coupon.type };
            }
            case CouponType.RECRUITER_MONTHS: {
                const months = coupon.freeMonths!;
                const cur = await tx.user.findUnique({ where: { id: user.userId }, select: { premiumUntil: true } });
                await tx.user.update({ where: { id: user.userId }, data: { isPremium: true, premiumUntil: addDays(cur?.premiumUntil ?? null, months * 30) } });
                return { message: `${months} free months added to your recruiter account!`, type: coupon.type };
            }
            case CouponType.PERCENT_DISCOUNT:
                return { message: `${coupon.discountPercent}% discount applied!`, type: coupon.type, discountPercent: coupon.discountPercent };
            case CouponType.AMOUNT_DISCOUNT:
                return { message: `${coupon.discountAmount} BDT discount applied!`, type: coupon.type, discountAmount: coupon.discountAmount };
            case CouponType.REFERRAL:
                return {
                    message: `Coupon applied! You save ${coupon.discountAmount} BDT.`,
                    type: coupon.type,
                    discountAmount: coupon.discountAmount,
                    commissionAmount: coupon.commissionAmount,
                    linkedRecruiterId: coupon.linkedRecruiterId,
                };
            default:
                return { message: "Coupon applied successfully", type: coupon.type };
        }
    });

    // Invalidate user cache so isPremium/premiumUntil changes are reflected immediately
    cacheManager.user.delete(user.userId);

    await prisma.notification.create({
        data: { userId: user.userId, type: "GENERAL", title: "Coupon Applied", message: result.message },
    }).catch(() => {});

    logger.update(`Coupon applied → code: ${code}`);
    return result;
};

const deleteCoupon = async (id: string) => {
    logger.delete(`Coupon delete → id: ${id}`);
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new AppError(status.NOT_FOUND, "Coupon not found");
    await prisma.coupon.delete({ where: { id } });
    logger.delete(`Coupon deleted → id: ${id}`);
    return { id };
};

export const CouponService = {
    createCoupon,
    getAllCoupons,
    getCouponById,
    validateCoupon,
    applyCoupon,
    deleteCoupon,
};
