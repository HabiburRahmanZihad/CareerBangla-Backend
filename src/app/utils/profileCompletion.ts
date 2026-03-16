import { Resume, Recruiter } from "../../generated/prisma/client";

/**
 * Calculate user profile completion percentage based on resume fields.
 * Returns a number between 0 and 100.
 */
export const getUserProfileCompletion = (resume: Resume | null): number => {
    if (!resume) return 0;

    const fields = [
        { value: resume.title, weight: 10 },
        { value: resume.summary, weight: 10 },
        { value: resume.skills && resume.skills.length > 0, weight: 15 },
        { value: resume.experience && (resume.experience as unknown[]).length > 0, weight: 15 },
        { value: resume.education && (resume.education as unknown[]).length > 0, weight: 15 },
        { value: resume.contactNumber, weight: 10 },
        { value: resume.address, weight: 10 },
        { value: resume.gender, weight: 5 },
        { value: resume.dateOfBirth, weight: 5 },
        { value: resume.linkedinUrl || resume.portfolioUrl, weight: 5 },
    ];

    const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
    const earnedWeight = fields.reduce((sum, f) => sum + (f.value ? f.weight : 0), 0);

    return Math.round((earnedWeight / totalWeight) * 100);
};

/**
 * Calculate recruiter profile completion percentage.
 * Returns a number between 0 and 100.
 */
export const getRecruiterProfileCompletion = (recruiter: Recruiter | null): number => {
    if (!recruiter) return 0;

    const fields = [
        { value: recruiter.name, weight: 15 },
        { value: recruiter.email, weight: 10 },
        { value: recruiter.contactNumber, weight: 10 },
        { value: recruiter.companyName, weight: 15 },
        { value: recruiter.designation, weight: 10 },
        { value: recruiter.industry, weight: 10 },
        { value: recruiter.companyWebsite, weight: 10 },
        { value: recruiter.companyAddress, weight: 5 },
        { value: recruiter.description, weight: 10 },
        { value: recruiter.companySize, weight: 5 },
    ];

    const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
    const earnedWeight = fields.reduce((sum, f) => sum + (f.value ? f.weight : 0), 0);

    return Math.round((earnedWeight / totalWeight) * 100);
};
