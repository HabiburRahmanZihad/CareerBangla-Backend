import { Role } from "../../generated/prisma/enums";

export interface IRequestUser{
    userId : string;
    name? : string;
    role : Role;
    email : string;
}