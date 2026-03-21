import status from "http-status";
import { Award, Certification, Education, Language, Prisma, Project, Reference, Resume, WorkExperience } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { getUserProfileCompletion } from "../../utils/profileCompletion";
import { generateResumePdf } from "../../utils/resumePdf";
import { uploadFileToCloudinary } from "../../config/cloudinary.config";

type ResumeUpdatePayload = Partial<Omit<Resume, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> & {
    workExperience?: Partial<WorkExperience>[];
    education?: Partial<Education>[];
    certifications?: Partial<Certification>[];
    projects?: Partial<Project>[];
    languages?: Partial<Language>[];
    awards?: Partial<Award>[];
    references?: Partial<Reference>[];
};

const getMyResume = async (user: IRequestUser) => {
    const resume = await prisma.resume.findUnique({
        where: { userId: user.userId },
        include: {
            user: {
                select: { id: true, name: true, email: true, image: true, isPremium: true }
            },
            workExperience: {
                orderBy: { createdAt: 'desc' }
            },
            education: {
                orderBy: { createdAt: 'desc' }
            },
            certifications: {
                orderBy: { createdAt: 'desc' }
            },
            projects: {
                orderBy: { createdAt: 'desc' }
            },
            languages: {
                orderBy: { createdAt: 'desc' }
            },
            awards: {
                orderBy: { createdAt: 'desc' }
            },
            references: {
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    const profileCompletion = getUserProfileCompletion(resume);

    return {
        ...resume,
        profileCompletion,
    };
}

const updateMyResume = async (user: IRequestUser, payload: ResumeUpdatePayload) => {
    const existingResume = await prisma.resume.findUnique({
        where: { userId: user.userId },
        include: { education: true, user: { select: { isPremium: true } } }
    });

    if (existingResume && !existingResume.user.isPremium) {
        if (getUserProfileCompletion(existingResume) === 100) {
            throw new AppError(status.FORBIDDEN, "Your profile is 100% complete and locked. Upgrade to Premium to continue editing.");
        }
    }

    if (payload.dateOfBirth) {
        payload.dateOfBirth = new Date(String(payload.dateOfBirth));
    }

    const buildPayload = () => {
        const {
            experience,
            ...rest
        } = payload;
        return {
            ...rest,
            ...(experience !== undefined ? { experience: experience as Prisma.InputJsonValue[] } : {}),
        };
    };

    const resumeInclude = {
        user: { select: { id: true, name: true, email: true, image: true } },
        workExperience: { orderBy: { createdAt: 'desc' as const } },
        education: { orderBy: { createdAt: 'desc' as const } },
        certifications: { orderBy: { createdAt: 'desc' as const } },
        projects: { orderBy: { createdAt: 'desc' as const } },
        languages: { orderBy: { createdAt: 'desc' as const } },
        awards: { orderBy: { createdAt: 'desc' as const } },
        references: { orderBy: { createdAt: 'desc' as const } }
    };

    const handleArrays = async (tx: Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">, resumeId: string) => {
        if (payload.workExperience !== undefined) {
            await tx.workExperience.deleteMany({ where: { resumeId } });
            if (Array.isArray(payload.workExperience) && payload.workExperience.length > 0) {
                await tx.workExperience.createMany({
                    data: payload.workExperience.map((item) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { id, resumeId, createdAt, updatedAt, ...rest } = item;
                        return { ...rest, resumeId };
                    }) as Prisma.WorkExperienceCreateManyInput[]
                });
            }
        }
        if (payload.education !== undefined) {
            await tx.education.deleteMany({ where: { resumeId } });
            if (Array.isArray(payload.education) && payload.education.length > 0) {
                await tx.education.createMany({
                    data: payload.education.map((item) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { id, resumeId, createdAt, updatedAt, ...rest } = item;
                        return { ...rest, resumeId };
                    }) as Prisma.EducationCreateManyInput[]
                });
            }
        }
        if (payload.certifications !== undefined) {
            await tx.certification.deleteMany({ where: { resumeId } });
            if (Array.isArray(payload.certifications) && payload.certifications.length > 0) {
                await tx.certification.createMany({
                    data: payload.certifications.map((item) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { id, resumeId, createdAt, updatedAt, ...rest } = item;
                        return { ...rest, resumeId };
                    }) as Prisma.CertificationCreateManyInput[]
                });
            }
        }
        if (payload.projects !== undefined) {
            await tx.project.deleteMany({ where: { resumeId } });
            if (Array.isArray(payload.projects) && payload.projects.length > 0) {
                await tx.project.createMany({
                    data: payload.projects.map((item) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { id, resumeId, createdAt, updatedAt, ...rest } = item;
                        return { ...rest, resumeId };
                    }) as Prisma.ProjectCreateManyInput[]
                });
            }
        }
        if (payload.languages !== undefined) {
            await tx.language.deleteMany({ where: { resumeId } });
            if (Array.isArray(payload.languages) && payload.languages.length > 0) {
                await tx.language.createMany({
                    data: payload.languages.map((item) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { id, resumeId, createdAt, updatedAt, ...rest } = item;
                        return { ...rest, resumeId };
                    }) as Prisma.LanguageCreateManyInput[]
                });
            }
        }
        if (payload.awards !== undefined) {
            await tx.award.deleteMany({ where: { resumeId } });
            if (Array.isArray(payload.awards) && payload.awards.length > 0) {
                await tx.award.createMany({
                    data: payload.awards.map((item) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { id, resumeId, createdAt, updatedAt, ...rest } = item;
                        return { ...rest, resumeId };
                    }) as Prisma.AwardCreateManyInput[]
                });
            }
        }
        if (payload.references !== undefined) {
            await tx.reference.deleteMany({ where: { resumeId } });
            if (Array.isArray(payload.references) && payload.references.length > 0) {
                await tx.reference.createMany({
                    data: payload.references.map((item) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { id, resumeId, createdAt, updatedAt, ...rest } = item;
                        return { ...rest, resumeId };
                    }) as Prisma.ReferenceCreateManyInput[]
                });
            }
        }
    };

    const resume = await prisma.$transaction(async (tx) => {
        let result;

        if (existingResume) {
            result = await tx.resume.update({
                where: { id: existingResume.id },
                data: buildPayload() as Prisma.ResumeUncheckedUpdateInput,
            });
        } else {
            result = await tx.resume.create({
                data: {
                    userId: user.userId,
                    ...buildPayload(),
                } as Prisma.ResumeUncheckedCreateInput,
            });
        }

        await handleArrays(tx, result.id);

        let fullResume = await tx.resume.findUnique({
            where: { id: result.id },
            include: resumeInclude
        });

        const completion = getUserProfileCompletion(fullResume as Parameters<typeof getUserProfileCompletion>[0]);

        if (completion === 100 && !result.profileCompletedAt) {
            fullResume = await tx.resume.update({
                where: { id: result.id },
                data: { profileCompletedAt: new Date() },
                include: resumeInclude,
            });
        }

        return fullResume;
    }, { maxWait: 10000, timeout: 30000 });

    const profileCompletion = getUserProfileCompletion(resume as Parameters<typeof getUserProfileCompletion>[0]);

    return {
        ...resume,
        profileCompletion,
    };
}

const getResumeByUserId = async (userId: string, requestUser: IRequestUser) => {
    // Only recruiters and admins can view other users' resumes
    if (requestUser.role !== "RECRUITER" && requestUser.role !== "ADMIN" && requestUser.role !== "SUPER_ADMIN") {
        throw new AppError(status.FORBIDDEN, "You are not authorized to view this resume");
    }

    // Validate resume exists BEFORE charging coins
    const resume = await prisma.resume.findUnique({
        where: { userId },
        include: {
            user: {
                select: { id: true, name: true, email: true, image: true }
            },
            workExperience: {
                orderBy: { createdAt: 'desc' }
            },
            education: {
                orderBy: { createdAt: 'desc' }
            },
            certifications: {
                orderBy: { createdAt: 'desc' }
            },
            projects: {
                orderBy: { createdAt: 'desc' }
            },
            languages: {
                orderBy: { createdAt: 'desc' }
            },
            awards: {
                orderBy: { createdAt: 'desc' }
            },
            references: {
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    if (!resume) {
        throw new AppError(status.NOT_FOUND, "Resume not found");
    }

    // Removing coin charge logic. Recruiters can view resumes for free under the new model.
    return resume;
}

const getAtsScore = async (user: IRequestUser, jobId?: string) => {
    const resume = await prisma.resume.findUnique({
        where: { userId: user.userId },
        include: {
            workExperience: true,
            education: true,
            certifications: true,
            projects: true,
            languages: true,
            awards: true,
            references: true,
        }
    });

    if (!resume) {
        return null;
    }

    const profileCompletion = getUserProfileCompletion(resume);

    // ── International ATS Scoring (total 100 pts) ─────────────────────────
    // Based on industry-standard ATS evaluation criteria (Workday, Taleo, Greenhouse, iCIMS)
    const categories: { label: string; earned: number; max: number; suggestions: string[] }[] = [];

    // 1. Contact & Identity (10 pts)
    {
        let earned = 0;
        const sug: string[] = [];
        if (resume.fullName && resume.email && resume.contactNumber) earned += 4;
        else sug.push("Add your Full Name, Email, and Contact Number.");
        if (resume.address) earned += 2;
        else sug.push("Add your address so recruiters can assess location fit.");
        if (resume.linkedinUrl || resume.githubUrl) earned += 4;
        else sug.push("Add a LinkedIn or GitHub URL — most ATS systems flag missing online profiles.");
        categories.push({ label: "Contact & Identity", earned, max: 10, suggestions: sug });
    }

    // 2. Professional Summary (15 pts)
    {
        let earned = 0;
        const sug: string[] = [];
        const summary = resume.professionalSummary?.trim() ?? "";
        if (summary.length > 0) earned += 5;
        else sug.push("Write a Professional Summary — it is the first thing ATS systems parse.");
        if (summary.length >= 50) earned += 5;
        else if (summary.length > 0) sug.push("Expand your summary to at least 50 characters for better keyword density.");
        if (summary.length >= 150) earned += 5;
        else if (summary.length >= 50) sug.push("Aim for 150+ characters in your summary for optimal ATS parsing.");
        categories.push({ label: "Professional Summary", earned, max: 15, suggestions: sug });
    }

    // 3. Skills (20 pts)
    {
        let earned = 0;
        const sug: string[] = [];
        const techSkills = resume.technicalSkills ?? [];
        const softSkills = resume.softSkills ?? [];
        const tools = resume.toolsAndTechnologies ?? [];

        if (techSkills.length >= 1) earned += 5;
        else sug.push("Add at least 1 technical skill.");
        if (techSkills.length >= 5) earned += 5;
        else sug.push(`Add more technical skills (you have ${techSkills.length}, aim for 5+).`);

        if (softSkills.length >= 1) earned += 5;
        else sug.push("Add at least 1 soft skill (e.g. Communication, Teamwork).");

        if (tools.length >= 1) earned += 5;
        else sug.push("Add Tools & Technologies (e.g. Git, Docker, VS Code).");

        categories.push({ label: "Skills", earned, max: 20, suggestions: sug });
    }

    // 4. Work Experience (20 pts)
    {
        let earned = 0;
        const sug: string[] = [];
        const exp = resume.workExperience ?? [];

        if (exp.length >= 1) earned += 10;
        else sug.push("Add at least 1 work experience entry.");
        if (exp.length >= 2) earned += 5;
        else if (exp.length === 1) sug.push("Add a second work experience entry if available.");
        const hasResponsibilities = exp.some(e => e.responsibilities && e.responsibilities.length > 0);
        if (hasResponsibilities) earned += 5;
        else if (exp.length > 0) sug.push("Add responsibilities/achievements to your work experience entries.");

        categories.push({ label: "Work Experience", earned, max: 20, suggestions: sug });
    }

    // 5. Education (10 pts)
    {
        let earned = 0;
        const sug: string[] = [];
        if ((resume.education?.length ?? 0) >= 1) earned += 10;
        else sug.push("Add your education background.");
        categories.push({ label: "Education", earned, max: 10, suggestions: sug });
    }

    // 6. Projects (10 pts)
    {
        let earned = 0;
        const sug: string[] = [];
        const projects = resume.projects ?? [];
        if (projects.length >= 1) earned += 5;
        else sug.push("Showcase at least 1 project — ATS uses projects to validate technical skills.");
        const hasDesc = projects.some(p => p.description && p.description.trim().length > 0);
        if (hasDesc) earned += 5;
        else if (projects.length > 0) sug.push("Add descriptions to your projects for better keyword coverage.");
        categories.push({ label: "Projects", earned, max: 10, suggestions: sug });
    }

    // 7. Certifications (8 pts)
    {
        let earned = 0;
        const sug: string[] = [];
        if ((resume.certifications?.length ?? 0) >= 1) earned += 8;
        else sug.push("Add certifications to boost credibility (e.g. AWS, Google, Coursera).");
        categories.push({ label: "Certifications", earned, max: 8, suggestions: sug });
    }

    // 8. Languages (3 pts)
    {
        let earned = 0;
        const sug: string[] = [];
        if ((resume.languages?.length ?? 0) >= 1) earned += 3;
        else sug.push("Add the languages you speak.");
        categories.push({ label: "Languages", earned, max: 3, suggestions: sug });
    }

    // 9. Awards (2 pts)
    {
        let earned = 0;
        const sug: string[] = [];
        if ((resume.awards?.length ?? 0) >= 1) earned += 2;
        else sug.push("Add any awards or recognitions you have received.");
        categories.push({ label: "Awards", earned, max: 2, suggestions: sug });
    }

    // 10. References (2 pts)
    {
        let earned = 0;
        const sug: string[] = [];
        if ((resume.references?.length ?? 0) >= 1) earned += 2;
        else sug.push("Add at least one professional reference.");
        categories.push({ label: "References", earned, max: 2, suggestions: sug });
    }

    const totalEarned = categories.reduce((s, c) => s + c.earned, 0);
    const totalMax = categories.reduce((s, c) => s + c.max, 0); // 100
    const atsScore = Math.round((totalEarned / totalMax) * 100);

    // Flatten suggestions (top suggestions first by impact = most points missing)
    const allSuggestions = categories
        .filter(c => c.earned < c.max)
        .sort((a, b) => (b.max - b.earned) - (a.max - a.earned))
        .flatMap(c => c.suggestions);

    // Job matching (optional)
    let jobMatchScore: number | null = null;
    let matchedSkills: string[] = [];
    let missingSkills: string[] = [];

    if (jobId) {
        const job = await prisma.job.findUnique({ where: { id: jobId, isDeleted: false } });
        if (job && job.skills) {
            const allResumeSkills = [
                ...(resume.technicalSkills ?? []),
                ...(resume.softSkills ?? []),
                ...(resume.toolsAndTechnologies ?? []),
            ];
            const jobSkillsLower = job.skills.map(s => s.toLowerCase());
            const resumeSkillsLower = allResumeSkills.map(s => s.toLowerCase());
            matchedSkills = allResumeSkills.filter(s => jobSkillsLower.includes(s.toLowerCase()));
            missingSkills = job.skills.filter(s => !resumeSkillsLower.includes(s.toLowerCase()));
            jobMatchScore = jobSkillsLower.length > 0
                ? Math.round((matchedSkills.length / jobSkillsLower.length) * 100)
                : 100;
            if (missingSkills.length > 0) {
                allSuggestions.unshift(`Add these job-specific skills: ${missingSkills.join(", ")}`);
            }
        }
    }

    return {
        atsScore,
        profileCompletion,
        suggestions: allSuggestions,
        categories,
        ...(jobId ? { jobMatchScore, matchedSkills, missingSkills } : {}),
    };
}

const searchCandidates = async (user: IRequestUser, query: IQueryParams) => {
    if (user.role !== "RECRUITER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        throw new AppError(status.FORBIDDEN, "Only recruiters and admins can search candidates");
    }

    const { searchTerm, skills, experience, location, education, page = "1", limit = "10" } = query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ResumeWhereInput = {};
    const conditions: Prisma.ResumeWhereInput[] = [];

    // Search by skills (array contains)
    if (skills) {
        const skillList = skills.split(",").map(s => s.trim());
        conditions.push({
            skills: { hasSome: skillList }
        });
    }

    // Search by location (address field)
    if (location) {
        conditions.push({
            address: { contains: location, mode: "insensitive" }
        });
    }

    // Free text search across professional title, summary, and address
    if (searchTerm) {
        conditions.push({
            OR: [
                { professionalTitle: { contains: searchTerm, mode: "insensitive" } },
                { professionalSummary: { contains: searchTerm, mode: "insensitive" } },
                { address: { contains: searchTerm, mode: "insensitive" } },
                { technicalSkills: { hasSome: [searchTerm] } },
                { softSkills: { hasSome: [searchTerm] } },
            ]
        });
    }

    // Search by work experience
    if (experience) {
        conditions.push({
            workExperience: { some: {} }
        });
    }

    // Search by education (relation filter)
    if (education) {
        conditions.push({
            education: { some: {} }
        });
    }

    if (conditions.length > 0) {
        where.AND = conditions;
    }

    const [candidates, total] = await Promise.all([
        prisma.resume.findMany({
            where,
            include: {
                user: {
                    select: { id: true, name: true, image: true }
                }
            },
            skip,
            take: limitNum,
            orderBy: { updatedAt: "desc" },
        }),
        prisma.resume.count({ where }),
    ]);

    return {
        data: candidates,
        meta: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
        }
    };
}

const deleteMyResume = async (user: IRequestUser) => {
    const resume = await prisma.resume.findUnique({
        where: { userId: user.userId },
    });

    if (!resume) {
        throw new AppError(status.NOT_FOUND, "Resume not found");
    }

    await prisma.resume.delete({
        where: { id: resume.id },
    });

    return null;
}

const downloadResumePdf = async (user: IRequestUser, targetUserId?: string) => {
    // Check premium status of the requesting user
    const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { isPremium: true, premiumUntil: true, role: true },
    });

    const hasPremium = dbUser?.isPremium && (!dbUser.premiumUntil || new Date(dbUser.premiumUntil) > new Date());
    if (!hasPremium) {
        throw new AppError(status.FORBIDDEN, "Resume PDF download is a Career Boost feature. Upgrade to access this.");
    }

    // If recruiter is downloading another user's CV, verify they have the role
    const resolvedUserId = targetUserId && (dbUser?.role === "RECRUITER" || dbUser?.role === "ADMIN" || dbUser?.role === "SUPER_ADMIN")
        ? targetUserId
        : user.userId;

    const resume = await prisma.resume.findUnique({
        where: { userId: resolvedUserId },
        include: {
            workExperience: { orderBy: { createdAt: 'desc' } },
            education: { orderBy: { createdAt: 'desc' } },
            certifications: { orderBy: { createdAt: 'desc' } },
            projects: { orderBy: { createdAt: 'desc' } },
            languages: { orderBy: { createdAt: 'desc' } },
            awards: { orderBy: { createdAt: 'desc' } },
            references: { orderBy: { createdAt: 'desc' } },
        }
    });

    if (!resume) {
        throw new AppError(status.NOT_FOUND, "Resume not found. Please create your resume first.");
    }

    return generateResumePdf(resume as unknown as Parameters<typeof generateResumePdf>[0]);
};

const getResumePdfForApplication = async (userId: string) => {
    const resume = await prisma.resume.findUnique({
        where: { userId },
        include: {
            workExperience: { orderBy: { createdAt: 'desc' } },
            education: { orderBy: { createdAt: 'desc' } },
            certifications: { orderBy: { createdAt: 'desc' } },
            projects: { orderBy: { createdAt: 'desc' } },
            languages: { orderBy: { createdAt: 'desc' } },
            awards: { orderBy: { createdAt: 'desc' } },
            references: { orderBy: { createdAt: 'desc' } },
        }
    });

    if (!resume) return null;
    return generateResumePdf(resume as unknown as Parameters<typeof generateResumePdf>[0]);
};

const uploadProfilePhoto = async (user: IRequestUser, fileBuffer: Buffer, fileName: string) => {
    const result = await uploadFileToCloudinary(fileBuffer, fileName);

    const resume = await prisma.resume.upsert({
        where: { userId: user.userId },
        update: { profilePhoto: result.secure_url },
        create: { userId: user.userId, profilePhoto: result.secure_url },
    });

    return { profilePhoto: resume.profilePhoto };
};

export const ResumeService = {
    getMyResume,
    updateMyResume,
    getResumeByUserId,
    getAtsScore,
    searchCandidates,
    deleteMyResume,
    downloadResumePdf,
    getResumePdfForApplication,
    uploadProfilePhoto,
}