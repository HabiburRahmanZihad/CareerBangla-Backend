import z from "zod";

export const updateRecruiterZodSchema = z.object({
    recruiter: z.object({
        name: z.string("Name must be a string")
            .min(2, "Name must be at least 2 characters")
            .max(50, "Name must be at most 50 characters")
            .optional(),
        profilePhoto: z.url("Profile photo must be a valid URL").optional(),
        contactNumber: z.string("Contact number must be a string")
            .min(11, "Contact number must be at least 11 characters")
            .max(14, "Contact number must be at most 14 characters")
            .optional(),
        companyName: z.string("Company name must be a string")
            .min(2, "Company name must be at least 2 characters")
            .max(100, "Company name must be at most 100 characters")
            .optional(),
        companyLogo: z.url("Company logo must be a valid URL").optional(),
        companyWebsite: z.url("Company website must be a valid URL").optional(),
        companyAddress: z.string("Company address must be a string").optional(),
        designation: z.string("Designation must be a string").optional(),
        industry: z.string("Industry must be a string").optional(),
        companySize: z.string("Company size must be a string").optional(),
        description: z.string("Description must be a string").optional(),
    }).optional()
})
