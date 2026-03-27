import z from "zod";

export const updateAdminZodSchema = z.object({
    admin: z.object({
        name: z.string("Name must be a string").optional(),
        profilePhoto: z.url("Profile photo must be a valid URL").optional(),
        contactNumber: z.string("Contact number must be a string").min(11, "Contact number must be at least 11 characters").max(14, "Contact number must be at most 15 characters").optional(),
    }).optional()
})

export const updateSubscriptionPlanZodSchema = z.object({
    name: z.string("Name must be a string").min(2, "Name is too short").optional(),
    amount: z.number("Amount must be a number").positive("Amount must be greater than 0").optional(),
    description: z.string("Description must be a string").min(5, "Description is too short").optional(),
    features: z.array(z.string("Feature must be a string").min(1, "Feature cannot be empty")).optional(),
    timelinePreset: z.enum(["LIFETIME", "MONTHLY", "THREE_MONTHS", "SIX_MONTHS", "YEARLY", "CUSTOM"]).optional(),
    customDays: z.number("Custom days must be a number").int("Custom days must be an integer").positive("Custom days must be greater than 0").optional(),
    isActive: z.boolean("isActive must be a boolean").optional(),
}).refine((data) => {
    if (data.timelinePreset === "CUSTOM") {
        return typeof data.customDays === "number" && data.customDays > 0;
    }
    return true;
}, {
    message: "customDays is required when timelinePreset is CUSTOM",
    path: ["customDays"],
});