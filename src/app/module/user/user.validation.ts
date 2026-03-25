import z from "zod";

export const createRecruiterZodSchema = z.object({
    password: z.string("Password is required").min(6, "Password must be at least 6 characters").max(20, "Password must be at most 20 characters"),
    recruiter: z.object({
        name: z.string("Name is required").min(2, "Name must be at least 2 characters").max(50, "Name must be at most 50 characters"),
        email: z.email("Invalid email address"),
        contactNumber: z.string("Contact number is required").min(11, "Contact number must be at least 11 characters").max(14, "Contact number must be at most 14 characters").optional(),
        companyName: z.string("Company name is required").min(2, "Company name must be at least 2 characters").max(100, "Company name must be at most 100 characters"),
        companyLogo: z.url("Company logo must be a valid URL").optional(),
        companyWebsite: z.url("Company website must be a valid URL").optional(),
        companyAddress: z.string("Company address must be a string").optional(),
        designation: z.string("Designation must be a string").optional(),
        industry: z.string("Industry must be a string").optional(),
        companySize: z.string("Company size must be a string").optional(),
        description: z.string("Description must be a string").optional(),
    }),
})

export const createAdminZodSchema = z.object({
    password: z.string("Password is required").min(6, "Password must be at least 6 characters").max(20, "Password must be at most 20 characters"),
    admin: z.object({
        name: z.string("Name is required and must be string").min(5, "Name must be at least 5 characters").max(30, "Name must be at most 30 characters"),
        email: z.email("Invalid email address"),
        contactNumber: z.string("Contact number is required").min(11, "Contact number must be at least 11 characters").max(14, "Contact number must be at most 14 characters").optional(),
        profilePhoto: z.url("Profile photo must be a valid URL").optional(),
    }),
    role: z.enum(["ADMIN"], "Only ADMIN role can be assigned. Use Super Admin account for security.")
})
