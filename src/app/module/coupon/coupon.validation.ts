import z from "zod";

export const createCouponZodSchema = z.object({
    code: z.string("Code is required").min(4, "Code must be at least 4 characters").max(20, "Code must be at most 20 characters"),
    coins: z.number("Coins must be a number").int().positive("Coins must be positive"),
    expiresAt: z.string("Expiry date must be a string").optional(),
})

export const createGiftVoucherZodSchema = z.object({
    code: z.string("Code is required").min(4, "Code must be at least 4 characters").max(20, "Code must be at most 20 characters"),
    coins: z.number("Coins must be a number").int().positive("Coins must be positive"),
    recipientEmail: z.email("Recipient email must be a valid email").optional(),
    expiresAt: z.string("Expiry date must be a string").optional(),
})

export const redeemCodeZodSchema = z.object({
    code: z.string("Code is required"),
})
