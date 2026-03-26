import PDFDocument from "pdfkit";

export interface ResumeData {
    fullName?: string;
    email?: string;
    professionalTitle?: string;
    contactNumber?: string;
    address?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    professionalSummary?: string;
    technicalSkills?: string[];
    softSkills?: string[];
    toolsAndTechnologies?: string[];
    interests?: string[];
    workExperience?: {
        jobTitle: string;
        companyName: string;
        startDate: string | Date;
        endDate?: string | Date;
        currentlyWorking?: boolean;
        responsibilities?: string[];
    }[];
    education?: {
        degree: string;
        fieldOfStudy: string;
        institutionName: string;
        startDate: string | Date;
        endDate?: string | Date;
        cgpaOrResult?: string;
    }[];
    certifications?: {
        certificationName: string;
        issuingOrganization: string;
        issueDate: string | Date;
    }[];
    projects?: {
        projectName: string;
        description: string;
        technologiesUsed?: string[];
        liveUrl?: string;
        githubUrl?: string;
        highlights?: string[];
    }[];
    languages?: {
        language: string;
        proficiencyLevel: string;
    }[];
    awards?: {
        title: string;
        issuer: string;
        date: string | Date;
    }[];
    references?: {
        name: string;
        designation?: string;
        company?: string;
        email?: string;
        phone?: string;
    }[];
}

const formatDate = (d: string | Date | undefined): string => {
    if (!d) return "Present";
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

/**
 * Generates a PDF that visually matches the frontend ResumeTwoPageLayout preview.
 *
 * Layout order (Page 1):
 *   Header  →  Career Objective  →  Skills  →  Projects (max 3)
 *   →  Work Experience  →  Education  →  Certifications (max 3)
 *   →  Languages  →  Interests
 *
 * Page 2 (when content overflows or extra sections exist):
 *   Work Experience (full)  →  Additional Projects  →  Certifications (all)
 *   →  Awards & Achievements  →  References  →  Interests
 */
export const generateResumePdf = (data: ResumeData): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const margin = 40;
        const doc = new PDFDocument({ size: "A4", margin });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const pageWidth = 595.28 - margin * 2; // A4 usable width
        const primaryColor = "#1a3a52";
        const textColor = "#333333";
        const mutedColor = "#666666";
        const linkColor = "#2563eb"; // blue-600
        const lineColor = "#9ca3af"; // gray-400

        let y = margin;

        // ── Filter valid entries (same as frontend) ──
        const validProjects = (data.projects || []).filter(p => p.projectName);
        const validEducation = (data.education || []).filter(e => e.degree);
        const validLanguages = (data.languages || []).filter(l => l.language);
        const validWorkExp = (data.workExperience || []).filter(w => w.jobTitle);
        const validCertifications = (data.certifications || []).filter(c => c.certificationName);
        const validAwards = (data.awards || []).filter(a => a.title);
        const validReferences = (data.references || []).filter(r => r.name);
        const interests = data.interests || [];
        const technicalSkills = data.technicalSkills || [];
        const softSkills = data.softSkills || [];
        const tools = data.toolsAndTechnologies || [];

        // ── Helpers ──
        const ensureSpace = (needed: number) => {
            if (y + needed > 800) {
                doc.addPage();
                y = margin;
            }
        };

        const sectionHeader = (title: string) => {
            ensureSpace(24);
            doc.fontSize(8.5).font("Helvetica-Bold").fillColor(primaryColor)
                .text(title.toUpperCase(), margin, y, { characterSpacing: 1.5 });
            y = doc.y + 3;
            doc.moveTo(margin, y).lineTo(margin + pageWidth, y)
                .strokeColor(lineColor).lineWidth(0.5).stroke();
            y += 6;
        };

        // ═══════════════════════════════════════════════════════════════
        // PAGE 1
        // ═══════════════════════════════════════════════════════════════

        // ── HEADER ──
        doc.fontSize(24).font("Helvetica-Bold").fillColor(primaryColor)
            .text(data.fullName || "YOUR NAME", margin, y, { width: pageWidth, align: "center", characterSpacing: 1.2 });
        y = doc.y + 2;

        if (data.professionalTitle) {
            doc.fontSize(10).font("Helvetica-Bold").fillColor(mutedColor)
                .text(data.professionalTitle, margin, y, { width: pageWidth, align: "center" });
            y = doc.y + 4;
        }

        // Contact info line (phone, email, address)
        const contactParts: string[] = [];
        if (data.contactNumber) contactParts.push(data.contactNumber);
        if (data.email) contactParts.push(data.email);
        if (data.address) contactParts.push(data.address);
        if (contactParts.length > 0) {
            doc.fontSize(8).font("Helvetica").fillColor(mutedColor)
                .text(contactParts.join("    "), margin, y, { width: pageWidth, align: "center" });
            y = doc.y + 3;
        }

        // Links line (Github, LinkedIn, Portfolio)
        const urlParts: string[] = [];
        if (data.githubUrl) urlParts.push("Github");
        if (data.linkedinUrl) urlParts.push("LinkedIn");
        if (data.portfolioUrl) urlParts.push("Portfolio");
        if (urlParts.length > 0) {
            const linkLineText = urlParts.join("    ");
            const linkLineWidth = doc.fontSize(8).font("Helvetica").widthOfString(linkLineText);
            const linkLineX = margin + (pageWidth - linkLineWidth) / 2;

            let lx = linkLineX;
            const linkItems: { label: string; url: string }[] = [];
            if (data.githubUrl) linkItems.push({ label: "Github", url: data.githubUrl });
            if (data.linkedinUrl) linkItems.push({ label: "LinkedIn", url: data.linkedinUrl });
            if (data.portfolioUrl) linkItems.push({ label: "Portfolio", url: data.portfolioUrl });

            for (let i = 0; i < linkItems.length; i++) {
                const item = linkItems[i];
                const labelWidth = doc.fontSize(8).font("Helvetica").widthOfString(item.label);
                doc.fontSize(8).font("Helvetica").fillColor(linkColor)
                    .text(item.label, lx, y, { link: item.url, underline: false });
                lx += labelWidth;
                if (i < linkItems.length - 1) {
                    const spacerWidth = doc.widthOfString("    ");
                    lx += spacerWidth;
                }
            }
            y = doc.y + 4;
        }

        // Header bottom border
        doc.moveTo(margin, y).lineTo(margin + pageWidth, y)
            .strokeColor(primaryColor).lineWidth(1.5).stroke();
        y += 10;

        // ── CAREER OBJECTIVE ──
        if (data.professionalSummary) {
            sectionHeader("Career Objective");
            doc.fontSize(8.5).font("Helvetica").fillColor(textColor)
                .text(data.professionalSummary, margin, y, { width: pageWidth, lineGap: 2 });
            y = doc.y + 10;
        }

        // ── SKILLS ──
        if (technicalSkills.length > 0 || softSkills.length > 0 || tools.length > 0) {
            sectionHeader("Skills");
            if (technicalSkills.length > 0) {
                doc.fontSize(8.5).font("Helvetica-Bold").fillColor(textColor)
                    .text("Technical: ", margin, y, { continued: true });
                doc.font("Helvetica").fillColor(textColor)
                    .text(technicalSkills.join(", "));
                y = doc.y + 3;
            }
            if (tools.length > 0) {
                doc.fontSize(8.5).font("Helvetica-Bold").fillColor(textColor)
                    .text("Tools & Platforms: ", margin, y, { continued: true });
                doc.font("Helvetica").fillColor(textColor)
                    .text(tools.join(", "));
                y = doc.y + 3;
            }
            if (softSkills.length > 0) {
                doc.fontSize(8.5).font("Helvetica-Bold").fillColor(textColor)
                    .text("Additional Skills: ", margin, y, { continued: true });
                doc.font("Helvetica").fillColor(textColor)
                    .text(softSkills.join(", "));
                y = doc.y + 3;
            }
            y += 7;
        }

        // ── PROJECTS (max 3 on page 1) ──
        const page1Projects = validProjects.slice(0, 3);
        if (page1Projects.length > 0) {
            sectionHeader("Projects");
            for (const proj of page1Projects) {
                ensureSpace(40);
                // Project name + links on same line
                const linkParts: string[] = [];
                if (proj.liveUrl) linkParts.push("LIVE");
                if (proj.githubUrl) linkParts.push("SERVER");
                const linkText = linkParts.join("   ");
                const linkWidth = linkText ? doc.fontSize(7).font("Helvetica").widthOfString(linkText) + 10 : 0;

                doc.fontSize(8.5).font("Helvetica-Bold").fillColor(primaryColor)
                    .text(proj.projectName, margin, y, { width: pageWidth - linkWidth });

                if (linkParts.length > 0) {
                    let lx = margin + pageWidth - linkWidth;
                    if (proj.liveUrl) {
                        doc.fontSize(7).font("Helvetica").fillColor(linkColor)
                            .text("LIVE", lx, y, { link: proj.liveUrl, underline: true });
                        lx += doc.widthOfString("LIVE") + 8;
                    }
                    if (proj.githubUrl) {
                        doc.fontSize(7).font("Helvetica").fillColor(linkColor)
                            .text("SERVER", lx, y, { link: proj.githubUrl, underline: true });
                    }
                }
                y = doc.y + 2;

                if (proj.description) {
                    doc.fontSize(8.5).font("Helvetica").fillColor(textColor)
                        .text(proj.description, margin, y, { width: pageWidth, lineGap: 1 });
                    y = doc.y + 2;
                }
                if (proj.technologiesUsed && proj.technologiesUsed.length > 0) {
                    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(textColor)
                        .text("Technologies: ", margin, y, { continued: true });
                    doc.font("Helvetica").fillColor(mutedColor)
                        .text(proj.technologiesUsed.join(", "));
                    y = doc.y + 2;
                }
                if (proj.highlights && proj.highlights.length > 0) {
                    for (const highlight of proj.highlights.slice(0, 3)) {
                        doc.fontSize(8.5).font("Helvetica").fillColor(textColor)
                            .text(`•  ${highlight}`, margin + 8, y, { width: pageWidth - 8, lineGap: 1 });
                        y = doc.y + 1;
                    }
                }
                y += 6;
            }
        }

        // ── WORK EXPERIENCE ──
        if (validWorkExp.length > 0) {
            sectionHeader("Work Experience");
            for (const exp of validWorkExp) {
                ensureSpace(30);
                // Job title left, date right
                const dateText = `${formatDate(exp.startDate)} - ${exp.currentlyWorking ? "Present" : formatDate(exp.endDate)}`;
                const dateWidth = doc.fontSize(7.5).font("Helvetica").widthOfString(dateText);

                doc.fontSize(8.5).font("Helvetica-Bold").fillColor(textColor)
                    .text(exp.jobTitle, margin, y, { width: pageWidth - dateWidth - 10 });
                doc.fontSize(7.5).font("Helvetica").fillColor(mutedColor)
                    .text(dateText, margin + pageWidth - dateWidth, y, { width: dateWidth, align: "right" });
                y = Math.max(doc.y, y + 12);

                if (exp.companyName) {
                    doc.fontSize(8.5).font("Helvetica-Oblique").fillColor(mutedColor)
                        .text(exp.companyName, margin, y);
                    y = doc.y + 2;
                }
                if (exp.responsibilities && exp.responsibilities.length > 0) {
                    for (const resp of exp.responsibilities.slice(0, 2)) {
                        ensureSpace(14);
                        doc.fontSize(8.5).font("Helvetica").fillColor(textColor)
                            .text(`•  ${resp}`, margin + 6, y, { width: pageWidth - 6, lineGap: 1 });
                        y = doc.y + 1;
                    }
                }
                y += 6;
            }
        }

        // ── EDUCATION ──
        if (validEducation.length > 0) {
            sectionHeader("Education");
            for (const edu of validEducation) {
                ensureSpace(24);
                const degreeText = `${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ""}`;
                const dateText = `${formatDate(edu.startDate)} - ${formatDate(edu.endDate)}`;
                const dateWidth = doc.fontSize(7.5).font("Helvetica").widthOfString(dateText);

                doc.fontSize(8.5).font("Helvetica-Bold").fillColor(textColor)
                    .text(degreeText, margin, y, { width: pageWidth - dateWidth - 10 });
                doc.fontSize(7.5).font("Helvetica").fillColor(mutedColor)
                    .text(dateText, margin + pageWidth - dateWidth, y, { width: dateWidth, align: "right" });
                y = Math.max(doc.y, y + 12);

                if (edu.institutionName) {
                    doc.fontSize(8.5).font("Helvetica").fillColor(mutedColor)
                        .text(edu.institutionName, margin, y);
                    y = doc.y + 2;
                }
                y += 4;
            }
        }

        // ── CERTIFICATIONS (max 3 on page 1) ──
        const page1Certs = validCertifications.slice(0, 3);
        if (page1Certs.length > 0) {
            sectionHeader("Certifications");
            for (const cert of page1Certs) {
                ensureSpace(16);
                const dateText = formatDate(cert.issueDate);
                const dateWidth = doc.fontSize(7.5).font("Helvetica").widthOfString(dateText);
                const nameText = cert.certificationName + (cert.issuingOrganization ? ` - ${cert.issuingOrganization}` : "");

                doc.fontSize(8.5).font("Helvetica-Bold").fillColor(textColor)
                    .text(nameText, margin, y, { width: pageWidth - dateWidth - 10 });
                doc.fontSize(7.5).font("Helvetica").fillColor(mutedColor)
                    .text(dateText, margin + pageWidth - dateWidth, y, { width: dateWidth, align: "right" });
                y = Math.max(doc.y, y + 12) + 2;
            }
            y += 4;
        }

        // ── LANGUAGES ──
        if (validLanguages.length > 0) {
            sectionHeader("Languages");
            for (const lang of validLanguages) {
                doc.fontSize(8.5).font("Helvetica").fillColor(textColor)
                    .text(`•  ${lang.language} (${lang.proficiencyLevel || "N/A"})`, margin + 8, y, { width: pageWidth - 8 });
                y = doc.y + 1;
            }
            y += 7;
        }

        // ── INTERESTS ──
        if (interests.length > 0) {
            sectionHeader("Interests");
            doc.fontSize(8.5).font("Helvetica").fillColor(textColor)
                .text(interests.slice(0, 5).join(", "), margin, y, { width: pageWidth });
            y = doc.y + 10;
        }

        // ═══════════════════════════════════════════════════════════════
        // PAGE 2 — only when needed (matches frontend hasPage2Content)
        // ═══════════════════════════════════════════════════════════════
        const hasPage2Content =
            validProjects.length > 3 ||
            validAwards.length > 0 ||
            validReferences.length > 0;

        if (hasPage2Content) {
            doc.addPage();
            y = margin;

            // ── ADDITIONAL PROJECTS ──
            if (validProjects.length > 3) {
                sectionHeader("Additional Projects");
                for (const proj of validProjects.slice(3)) {
                    ensureSpace(30);
                    const linkParts: string[] = [];
                    if (proj.liveUrl) linkParts.push("LIVE");
                    if (proj.githubUrl) linkParts.push("SERVER");
                    const linkText = linkParts.join("   ");
                    const linkWidth = linkText ? doc.fontSize(7).font("Helvetica").widthOfString(linkText) + 10 : 0;

                    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(primaryColor)
                        .text(proj.projectName, margin, y, { width: pageWidth - linkWidth });

                    if (linkParts.length > 0) {
                        let lx = margin + pageWidth - linkWidth;
                        if (proj.liveUrl) {
                            doc.fontSize(7).font("Helvetica").fillColor(linkColor)
                                .text("LIVE", lx, y, { link: proj.liveUrl, underline: true });
                            lx += doc.widthOfString("LIVE") + 8;
                        }
                        if (proj.githubUrl) {
                            doc.fontSize(7).font("Helvetica").fillColor(linkColor)
                                .text("SERVER", lx, y, { link: proj.githubUrl, underline: true });
                        }
                    }
                    y = doc.y + 2;

                    if (proj.description) {
                        doc.fontSize(8.5).font("Helvetica").fillColor(textColor)
                            .text(proj.description, margin, y, { width: pageWidth });
                        y = doc.y + 2;
                    }
                    if (proj.technologiesUsed && proj.technologiesUsed.length > 0) {
                        doc.fontSize(7.5).font("Helvetica").fillColor(mutedColor)
                            .text(proj.technologiesUsed.join(", "), margin, y);
                        y = doc.y + 2;
                    }
                    y += 6;
                }
            }

            // ── AWARDS & ACHIEVEMENTS ──
            if (validAwards.length > 0) {
                sectionHeader("Awards & Achievements");
                for (const award of validAwards) {
                    ensureSpace(16);
                    const dateText = formatDate(award.date);
                    const dateWidth = doc.fontSize(7.5).font("Helvetica").widthOfString(dateText);

                    const nameText = award.title + (award.issuer ? ` - ${award.issuer}` : "");
                    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(textColor)
                        .text(nameText, margin, y, { width: pageWidth - dateWidth - 10 });
                    doc.fontSize(7.5).font("Helvetica").fillColor(mutedColor)
                        .text(dateText, margin + pageWidth - dateWidth, y, { width: dateWidth, align: "right" });
                    y = Math.max(doc.y, y + 12) + 2;
                }
                y += 4;
            }

            // ── REFERENCES (2-column grid) ──
            if (validReferences.length > 0) {
                sectionHeader("References");
                const colWidth = (pageWidth - 12) / 2;
                for (let i = 0; i < validReferences.length; i += 2) {
                    ensureSpace(40);
                    const startY = y;

                    // Left column
                    const left = validReferences[i];
                    doc.fontSize(8.5).font("Helvetica-Bold").fillColor(textColor)
                        .text(left.name, margin, y);
                    y = doc.y + 1;
                    if (left.designation) {
                        doc.fontSize(7.5).font("Helvetica").fillColor(mutedColor)
                            .text(`${left.designation}${left.company ? ` at ${left.company}` : ""}`, margin, y);
                        y = doc.y + 1;
                    }
                    if (left.email) {
                        doc.fontSize(7.5).font("Helvetica").fillColor(mutedColor)
                            .text(left.email, margin, y);
                        y = doc.y + 1;
                    }
                    if (left.phone) {
                        doc.fontSize(7.5).font("Helvetica").fillColor(mutedColor)
                            .text(left.phone, margin, y);
                        y = doc.y + 1;
                    }
                    const leftEndY = y;

                    // Right column
                    if (i + 1 < validReferences.length) {
                        y = startY;
                        const right = validReferences[i + 1];
                        const rightX = margin + colWidth + 12;
                        doc.fontSize(8.5).font("Helvetica-Bold").fillColor(textColor)
                            .text(right.name, rightX, y, { width: colWidth });
                        y = doc.y + 1;
                        if (right.designation) {
                            doc.fontSize(7.5).font("Helvetica").fillColor(mutedColor)
                                .text(`${right.designation}${right.company ? ` at ${right.company}` : ""}`, rightX, y, { width: colWidth });
                            y = doc.y + 1;
                        }
                        if (right.email) {
                            doc.fontSize(7.5).font("Helvetica").fillColor(mutedColor)
                                .text(right.email, rightX, y, { width: colWidth });
                            y = doc.y + 1;
                        }
                        if (right.phone) {
                            doc.fontSize(7.5).font("Helvetica").fillColor(mutedColor)
                                .text(right.phone, rightX, y, { width: colWidth });
                            y = doc.y + 1;
                        }
                    }
                    y = Math.max(leftEndY, y) + 8;
                }
            }
        }

        doc.end();
    });
};
