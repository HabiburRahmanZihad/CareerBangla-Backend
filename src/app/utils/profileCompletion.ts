import { Award, Certification, Education, Language, Project, Recruiter, Reference, Resume, WorkExperience } from "../../generated/prisma/client";

type ResumeWithRelations = Resume & {
    workExperience?: WorkExperience[];
    education?: Education[];
    certifications?: Certification[];
    projects?: Project[];
    languages?: Language[];
    awards?: Award[];
    references?: Reference[];
};

/**
 * Calculate user profile completion percentage based on resume fields.
 * Returns a number between 0 and 100.
 * Based on 11 main sections: Personal Info, Summary, Skills, Experience, Education,
 * Certifications, Projects, Languages, Awards, Interests, and References.
 */
export const getUserProfileCompletion = (resume: ResumeWithRelations | null): number => {
    if (!resume) return 0;

    // Extract and normalize array fields - they're already arrays in the new schema
    const technicalSkills = resume.technicalSkills || [];
    const softSkills = resume.softSkills || [];
    const toolsAndTechs = resume.toolsAndTechnologies || [];
    const interests = resume.interests || [];

    // Define weighted sections for profile completion
    const fields = [
        // Personal Info Section (20%) - Basic contact details
        {
            value: resume.fullName && resume.email && resume.contactNumber,
            weight: 5,
            label: "Personal Details"
        },
        {
            value: resume.professionalTitle,
            weight: 3,
            label: "Professional Title"
        },
        {
            value: resume.linkedinUrl || resume.githubUrl || resume.websiteUrl,
            weight: 4,
            label: "URLs/Portfolio"
        },
        {
            value: resume.dateOfBirth && resume.gender && resume.address,
            weight: 3,
            label: "Additional Personal Info"
        },
        {
            value: resume.nationality,
            weight: 2,
            label: "Nationality"
        },

        // Professional Summary Section (12%)
        {
            value: resume.professionalSummary && resume.professionalSummary.length > 50,
            weight: 12,
            label: "Professional Summary"
        },

        // Skills Section (18%) - Technical, Soft & Tools
        {
            value: technicalSkills.length > 0,
            weight: 6,
            label: "Technical Skills"
        },
        {
            value: softSkills.length > 0,
            weight: 6,
            label: "Soft Skills"
        },
        {
            value: toolsAndTechs.length > 0,
            weight: 6,
            label: "Tools & Technologies"
        },

        // Work Experience Section (15%)
        {
            value: (resume.workExperience?.length ?? 0) > 0,
            weight: 15,
            label: "Work Experience"
        },

        // Education Section (12%)
        {
            value: (resume.education?.length ?? 0) > 0,
            weight: 12,
            label: "Education"
        },

        // Certifications Section (8%)
        {
            value: (resume.certifications?.length ?? 0) > 0,
            weight: 8,
            label: "Certifications"
        },

        // Projects Section (8%)
        {
            value: (resume.projects?.length ?? 0) > 0,
            weight: 8,
            label: "Projects"
        },

        // Languages Section (3%)
        {
            value: (resume.languages?.length ?? 0) > 0,
            weight: 3,
            label: "Languages"
        },

        // Awards Section (2%)
        {
            value: (resume.awards?.length ?? 0) > 0,
            weight: 2,
            label: "Awards"
        },

        // Interests Section (1%)
        {
            value: interests.length > 0,
            weight: 1,
            label: "Interests"
        },

        // References Section (1%) - Optional
        {
            value: (resume.references?.length ?? 0) > 0,
            weight: 1,
            label: "References"
        },
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
