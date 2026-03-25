import { Role, UserStatus } from "../../../generated/prisma/enums";

export interface IUpdateAdminPayload {
    admin?: {
        name?: string;
        profilePhoto?: string;
        contactNumber?: string;
    }
}

export interface IChangeUserStatusPayload {
    userId: string;
    userStatus: UserStatus;
}

export interface IChangeUserRolePayload {
    userId: string;
    role: Role;
}

export interface IUpdateUserPayload {
    name?: string;
    email?: string;
    image?: string;
    phone?: string;
    isPremium?: boolean;
}

export interface IUpdateRecruiterDataPayload {
    name?: string;
    email?: string;
    profilePhoto?: string;
    contactNumber?: string;
    companyName?: string;
    companyLogo?: string;
    companyWebsite?: string;
    companyAddress?: string;
    designation?: string;
    industry?: string;
    companySize?: string;
    description?: string;
}
