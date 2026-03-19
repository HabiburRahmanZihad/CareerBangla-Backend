import z from "zod";

export const createCouponZodSchema = z.object({
    code: z.string("Code is required").min(4, "Code must be at least 4 characters").max(20, "Code must be at most 20 characters"),
    discountPercent: z.number("Discount percent must be a number").min(0).max(100).optional(),
    discountAmount: z.number("Discount amount must be a number").min(0).optional(),
    maxUsage: z.number("Max usage must be a number").int().positive("Max usage must be positive").optional(),
    expiresAt: z.string("Expiry date must be a string").optional(),
}).refine(data => data.discountPercent !== undefined || data.discountAmount !== undefined, {
    message: "Either discountPercent or discountAmount must be provided",
});

export const validateCouponZodSchema = z.object({
    code: z.string("Code is required"),
});
