import z from "zod";

const couponTypeEnum = z.enum(["FREE_DAYS", "LIFETIME_FREE", "PERCENT_DISCOUNT", "AMOUNT_DISCOUNT", "RECRUITER_DAYS", "RECRUITER_MONTHS", "REFERRAL"]);
const couponTargetRoleEnum = z.enum(["USER", "RECRUITER", "BOTH"]);

export const createCouponZodSchema = z.object({
    code: z.string().min(4, "Code must be at least 4 characters").max(20, "Code must be at most 20 characters"),
    type: couponTypeEnum,
    targetRole: couponTargetRoleEnum.optional(),
    description: z.string().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    discountAmount: z.number().min(0).optional(),
    isLifetime: z.boolean().optional(),
    freeDays: z.number().int().positive().optional(),
    freeMonths: z.number().int().positive().optional(),
    commissionAmount: z.number().min(0).optional(),
    linkedRecruiterId: z.string().optional(),
    maxUsage: z.number().int().positive().optional(),
    expiresAt: z.string().optional(),
});

export const validateCouponZodSchema = z.object({
    code: z.string().min(1, "Code is required"),
});

export const applyCouponZodSchema = z.object({
    code: z.string().min(1, "Code is required"),
});
