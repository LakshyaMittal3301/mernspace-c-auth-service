import { PublicUserDto } from "../dtos/user.dto";
import { User } from "../entity/User";

export const toPublicUserDto = (u: User): PublicUserDto => {
    return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        createdAt: u.createdAt,
    };
};
