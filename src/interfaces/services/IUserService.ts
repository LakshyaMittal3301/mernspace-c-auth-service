import { User } from "../../entity/User";

export type CreateUserWithHashDto = {
    firstName: string;
    lastName: string;
    email: string;
    hashedPassword: string;
};

export interface IUserService {
    createWithHash(data: CreateUserWithHashDto): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
}
