import { AdminViewUserDto, PublicUserDto } from "../dtos/user.dto";
import { User } from "../entity/User";

export const buildPublicUserDto = (u: User): PublicUserDto => {
    return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        createdAt: u.createdAt,
        role: u.role,
    };
};

export const buildAdminViewUserDto = (u: User): AdminViewUserDto => {
    return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        createdAt: u.createdAt,
        role: u.role,
        tenantId: u.tenantId,
    };
};
