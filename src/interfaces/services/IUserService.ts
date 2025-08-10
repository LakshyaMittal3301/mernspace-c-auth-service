import { CreateUserParams } from "../../dtos/user.dto";
import { User } from "../../entity/User";

export interface IUserService {
    createWithHash(data: CreateUserParams): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
    findById(id: number): Promise<User>;
}
