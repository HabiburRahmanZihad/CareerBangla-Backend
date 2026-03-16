export interface ICreateRecruiterPayload {
    password: string;
    recruiter: {
        name: string;
        email: string;
        profilePhoto?: string;
        contactNumber?: string;
        companyName: string;
        companyLogo?: string;
        companyWebsite?: string;
        companyAddress?: string;
        designation?: string;
        industry?: string;
        companySize?: string;
        description?: string;
    }
}

export interface ICreateAdminPayload {
    password: string;
    admin: {
        name: string;
        email: string;
        profilePhoto?: string;
        contactNumber?: string;
    }
    role: "ADMIN" | "SUPER_ADMIN";
}
