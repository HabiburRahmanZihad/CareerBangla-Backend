import { z } from "zod";

const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

export const registerUserZodSchema = z.object({
    name: z.string().min(1, "Name is required").min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required").min(8, "Password must be at least 8 characters long"),
    referralCode: z.string().optional(),
});

export const loginUserZodSchema = z.object({
    identifier: z
        .string()
        .min(1, "Email or phone number is required")
        .refine(
            (v) =>
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || BD_PHONE_REGEX.test(v),
            "Enter a valid email address or 11-digit BD phone number"
        ),
    password: z.string().min(1, "Password is required"),
    logoutAllDevices: z.boolean().optional(),
});

export const changePasswordZodSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string()
        .min(1, "New password is required")
        .min(8, "New password must be at least 8 characters long")
        .refine((value) => !/\s/.test(value), "Password cannot contain spaces"),
});

export const forgotPasswordZodSchema = z.object({
    email: z.string().email("Invalid email address"),
    phone: z
        .string()
        .min(1, "Phone number is required")
        .regex(BD_PHONE_REGEX, "Enter a valid 11-digit phone number starting with 01 (e.g. 01818652760)"),
});

export const resetPasswordZodSchema = z.object({
    email: z.string().email("Invalid email address"),
    otp: z.string()
        .min(1, "OTP is required")
        .length(6, "OTP must be exactly 6 digits")
        .regex(/^\d{6}$/, "OTP must contain only digits"),
    newPassword: z.string()
        .min(1, "New password is required")
        .min(8, "New password must be at least 8 characters long")
        .refine((value) => !/\s/.test(value), "Password cannot contain spaces"),
});

export const verifyEmailZodSchema = z.object({
    email: z.string().email("Invalid email address"),
    otp: z.string()
        .min(1, "OTP is required")
        .length(6, "OTP must be exactly 6 digits")
        .regex(/^\d{6}$/, "OTP must contain only digits"),
});

export const updateProfileZodSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    phone: z
        .string()
        .regex(BD_PHONE_REGEX, "Enter a valid 11-digit phone number starting with 01")
        .optional(),
});

export type IRegisterUserPayload = z.infer<typeof registerUserZodSchema>;
export type ILoginUserPayload = z.infer<typeof loginUserZodSchema>;
export type IChangePasswordPayload = z.infer<typeof changePasswordZodSchema>;
export type IForgotPasswordPayload = z.infer<typeof forgotPasswordZodSchema>;
export type IResetPasswordPayload = z.infer<typeof resetPasswordZodSchema>;
export type IVerifyEmailPayload = z.infer<typeof verifyEmailZodSchema>;
export type IUpdateProfilePayload = z.infer<typeof updateProfileZodSchema>;
