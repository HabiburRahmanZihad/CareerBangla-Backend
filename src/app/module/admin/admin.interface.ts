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
    country?: string;
    isPremium?: boolean;
    premiumUntil?: string;
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

export type SubscriptionTimelinePreset = "LIFETIME" | "MONTHLY" | "THREE_MONTHS" | "SIX_MONTHS" | "YEARLY" | "CUSTOM";

export interface IUpdateSubscriptionPlanPayload {
    name?: string;
    amount?: number;
    description?: string;
    features?: string[];
    timelinePreset?: SubscriptionTimelinePreset;
    customDays?: number;
    isActive?: boolean;
}
