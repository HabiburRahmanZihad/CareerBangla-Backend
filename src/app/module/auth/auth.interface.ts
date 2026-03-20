export interface ILoginUserPayload {
    identifier: string;
    password: string;
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
