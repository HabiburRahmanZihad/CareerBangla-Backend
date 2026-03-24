export interface ILoginUserPayload {
    identifier: string;
    password: string;
    logoutAllDevices?: boolean;
}

export interface IRegisterUserPayload {
    name: string;
    email: string;
    phone: string;
    password: string;
    referralCode?: string;
}

export interface IForgetPasswordPayload {
    email: string;
    phone: string;
}

export interface IChangePasswordPayload {
    currentPassword: string;
    newPassword: string;
}

export interface IUpdateProfilePayload {
    name?: string;
    phone?: string;
}
