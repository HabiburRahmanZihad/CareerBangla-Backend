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

export const generateResumePdf = (data: ResumeData): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 45 });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const pageWidth = 595.28 - 90; // A4 width minus margins
        const primaryColor = "#1e3a5f";
        const textColor = "#333333";
        const mutedColor = "#666666";

        let y = 45;

        // ── HEADER ──
        doc.fontSize(22).font("Helvetica-Bold").fillColor(primaryColor)
            .text(data.fullName || "Your Name", 45, y, { width: pageWidth, align: "center" });
        y += 28;

        if (data.professionalTitle) {
            doc.fontSize(11).font("Helvetica").fillColor(mutedColor)
                .text(data.professionalTitle, 45, y, { width: pageWidth, align: "center" });
            y += 16;
        }

        // Contact line
        const contactParts: string[] = [];
        if (data.email) contactParts.push(data.email);
        if (data.contactNumber) contactParts.push(data.contactNumber);
        if (data.address) contactParts.push(data.address);
        if (contactParts.length > 0) {
            doc.fontSize(9).font("Helvetica").fillColor(mutedColor)
                .text(contactParts.join("  |  "), 45, y, { width: pageWidth, align: "center" });
            y += 14;
        }

        // URLs line
        const urlParts: string[] = [];
        if (data.linkedinUrl) urlParts.push(`LinkedIn: ${data.linkedinUrl}`);
        if (data.githubUrl) urlParts.push(`GitHub: ${data.githubUrl}`);
        if (data.portfolioUrl) urlParts.push(`Portfolio: ${data.portfolioUrl}`);
        if (urlParts.length > 0) {
            doc.fontSize(8).font("Helvetica").fillColor(mutedColor)
                .text(urlParts.join("  |  "), 45, y, { width: pageWidth, align: "center" });
            y += 12;
        }

        // Separator
        y += 4;
        doc.moveTo(45, y).lineTo(45 + pageWidth, y).strokeColor(primaryColor).lineWidth(1.5).stroke();
        y += 10;

        // ── Helper: Section Header ──
        const sectionHeader = (title: string) => {
            if (y > 720) { doc.addPage(); y = 45; }
            doc.fontSize(12).font("Helvetica-Bold").fillColor(primaryColor).text(title.toUpperCase(), 45, y);
            y += 16;
            doc.moveTo(45, y).lineTo(45 + pageWidth, y).strokeColor("#cccccc").lineWidth(0.5).stroke();
            y += 8;
        };

        // ── PROFESSIONAL SUMMARY ──
        if (data.professionalSummary) {
            sectionHeader("Professional Summary");
            doc.fontSize(9.5).font("Helvetica").fillColor(textColor)
                .text(data.professionalSummary, 45, y, { width: pageWidth, lineGap: 2 });
            y = doc.y + 14;
        }

        // ── SKILLS ──
        const allSkills = [
            ...(data.technicalSkills || []),
            ...(data.softSkills || []),
            ...(data.toolsAndTechnologies || []),
        ];
        if (allSkills.length > 0) {
            sectionHeader("Skills");
            if (data.technicalSkills && data.technicalSkills.length > 0) {
                doc.fontSize(9.5).font("Helvetica-Bold").fillColor(textColor).text("Technical: ", 45, y, { continued: true });
                doc.font("Helvetica").text(data.technicalSkills.join(", "));
                y = doc.y + 4;
            }
            if (data.softSkills && data.softSkills.length > 0) {
                doc.fontSize(9.5).font("Helvetica-Bold").fillColor(textColor).text("Soft Skills: ", 45, y, { continued: true });
                doc.font("Helvetica").text(data.softSkills.join(", "));
                y = doc.y + 4;
            }
            if (data.toolsAndTechnologies && data.toolsAndTechnologies.length > 0) {
                doc.fontSize(9.5).font("Helvetica-Bold").fillColor(textColor).text("Tools: ", 45, y, { continued: true });
                doc.font("Helvetica").text(data.toolsAndTechnologies.join(", "));
                y = doc.y + 4;
            }
            y += 10;
        }

        // ── WORK EXPERIENCE ──
        if (data.workExperience && data.workExperience.length > 0) {
            sectionHeader("Work Experience");
            for (const exp of data.workExperience) {
                if (y > 700) { doc.addPage(); y = 45; }
                doc.fontSize(10).font("Helvetica-Bold").fillColor(textColor)
                    .text(exp.jobTitle, 45, y, { width: pageWidth * 0.65, continued: false });
                doc.fontSize(9).font("Helvetica").fillColor(mutedColor)
                    .text(`${formatDate(exp.startDate)} - ${exp.currentlyWorking ? "Present" : formatDate(exp.endDate)}`, 45 + pageWidth * 0.65, y, { width: pageWidth * 0.35, align: "right" });
                y = Math.max(doc.y, y + 14);
                doc.fontSize(9.5).font("Helvetica-Oblique").fillColor(mutedColor)
                    .text(exp.companyName, 45, y);
                y = doc.y + 4;
                if (exp.responsibilities && exp.responsibilities.length > 0) {
                    for (const resp of exp.responsibilities) {
                        if (y > 740) { doc.addPage(); y = 45; }
                        doc.fontSize(9).font("Helvetica").fillColor(textColor)
                            .text(`•  ${resp}`, 55, y, { width: pageWidth - 15, lineGap: 1 });
                        y = doc.y + 3;
                    }
                }
                y += 8;
            }
        }

        // ── EDUCATION ──
        if (data.education && data.education.length > 0) {
            sectionHeader("Education");
            for (const edu of data.education) {
                if (y > 720) { doc.addPage(); y = 45; }
                doc.fontSize(10).font("Helvetica-Bold").fillColor(textColor)
                    .text(`${edu.degree} in ${edu.fieldOfStudy}`, 45, y, { width: pageWidth * 0.65 });
                doc.fontSize(9).font("Helvetica").fillColor(mutedColor)
                    .text(`${formatDate(edu.startDate)} - ${formatDate(edu.endDate)}`, 45 + pageWidth * 0.65, y, { width: pageWidth * 0.35, align: "right" });
                y = Math.max(doc.y, y + 14);
                doc.fontSize(9.5).font("Helvetica").fillColor(mutedColor)
                    .text(edu.institutionName, 45, y);
                y = doc.y + 2;
                if (edu.cgpaOrResult) {
                    doc.fontSize(9).font("Helvetica").fillColor(textColor)
                        .text(`Result: ${edu.cgpaOrResult}`, 45, y);
                    y = doc.y + 2;
                }
                y += 8;
            }
        }

        // ── PROJECTS ──
        if (data.projects && data.projects.length > 0) {
            sectionHeader("Projects");
            for (const proj of data.projects) {
                if (y > 720) { doc.addPage(); y = 45; }
                doc.fontSize(10).font("Helvetica-Bold").fillColor(textColor)
                    .text(proj.projectName, 45, y);
                y = doc.y + 2;
                doc.fontSize(9).font("Helvetica").fillColor(textColor)
                    .text(proj.description, 55, y, { width: pageWidth - 15, lineGap: 1 });
                y = doc.y + 3;
                if (proj.technologiesUsed && proj.technologiesUsed.length > 0) {
                    doc.fontSize(8.5).font("Helvetica-Oblique").fillColor(mutedColor)
                        .text(`Tech: ${proj.technologiesUsed.join(", ")}`, 55, y);
                    y = doc.y + 2;
                }
                if (proj.liveUrl) {
                    doc.fontSize(8).font("Helvetica").fillColor(mutedColor)
                        .text(`Live: ${proj.liveUrl}`, 55, y);
                    y = doc.y + 2;
                }
                y += 8;
            }
        }

        // ── CERTIFICATIONS ──
        if (data.certifications && data.certifications.length > 0) {
            sectionHeader("Certifications");
            for (const cert of data.certifications) {
                if (y > 740) { doc.addPage(); y = 45; }
                doc.fontSize(9.5).font("Helvetica-Bold").fillColor(textColor)
                    .text(cert.certificationName, 45, y, { width: pageWidth * 0.65, continued: false });
                doc.fontSize(9).font("Helvetica").fillColor(mutedColor)
                    .text(formatDate(cert.issueDate), 45 + pageWidth * 0.65, y, { width: pageWidth * 0.35, align: "right" });
                y = Math.max(doc.y, y + 13);
                doc.fontSize(9).font("Helvetica").fillColor(mutedColor)
                    .text(cert.issuingOrganization, 55, y);
                y = doc.y + 6;
            }
        }

        // ── LANGUAGES ──
        if (data.languages && data.languages.length > 0) {
            sectionHeader("Languages");
            const langText = data.languages.map(l => `${l.language} (${l.proficiencyLevel})`).join("  |  ");
            doc.fontSize(9.5).font("Helvetica").fillColor(textColor).text(langText, 45, y);
            y = doc.y + 12;
        }

        // ── AWARDS ──
        if (data.awards && data.awards.length > 0) {
            sectionHeader("Awards");
            for (const award of data.awards) {
                if (y > 740) { doc.addPage(); y = 45; }
                doc.fontSize(9.5).font("Helvetica-Bold").fillColor(textColor)
                    .text(award.title, 45, y, { width: pageWidth * 0.65, continued: false });
                doc.fontSize(9).font("Helvetica").fillColor(mutedColor)
                    .text(formatDate(award.date), 45 + pageWidth * 0.65, y, { width: pageWidth * 0.35, align: "right" });
                y = Math.max(doc.y, y + 13);
                doc.fontSize(9).font("Helvetica").fillColor(mutedColor).text(award.issuer, 55, y);
                y = doc.y + 6;
            }
        }

        // ── REFERENCES ──
        if (data.references && data.references.length > 0) {
            sectionHeader("References");
            for (const ref of data.references) {
                if (y > 740) { doc.addPage(); y = 45; }
                doc.fontSize(9.5).font("Helvetica-Bold").fillColor(textColor).text(ref.name, 45, y);
                y = doc.y + 2;
                const refDetails: string[] = [];
                if (ref.designation) refDetails.push(ref.designation);
                if (ref.company) refDetails.push(ref.company);
                if (refDetails.length) {
                    doc.fontSize(9).font("Helvetica").fillColor(mutedColor).text(refDetails.join(" at "), 55, y);
                    y = doc.y + 2;
                }
                const contactDetails: string[] = [];
                if (ref.email) contactDetails.push(ref.email);
                if (ref.phone) contactDetails.push(ref.phone);
                if (contactDetails.length) {
                    doc.fontSize(8.5).font("Helvetica").fillColor(mutedColor).text(contactDetails.join("  |  "), 55, y);
                    y = doc.y + 2;
                }
                y += 6;
            }
        }

        // Footer
        const footerY = 790;
        doc.fontSize(7).font("Helvetica").fillColor("#aaaaaa")
            .text("Generated by CareerBangla", 45, footerY, { width: pageWidth, align: "center" });

        doc.end();
    });
};
