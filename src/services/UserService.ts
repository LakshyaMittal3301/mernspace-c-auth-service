import { User } from "../entity/User";
import { Repository } from "typeorm";
import { Roles } from "../constants";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";
import { IUserService } from "../interfaces/services/IUserService";
import { CreateUserParams } from "../dtos/user.dto";

export default class UserService implements IUserService {
    constructor(private userRepository: Repository<User>) {}

    async createWithHash({ firstName, lastName, email, hashedPassword, role }: CreateUserParams): Promise<User> {
        const existingUser = await this.userRepository.findOne({ where: { email: email } });
        if (existingUser) throw new UserAlreadyExistsError(email);

        return await this.userRepository.save({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            role: role ?? Roles.CUSTOMER,
        });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepository.findOne({ where: { email } });
    }

    async findById(id: number): Promise<User | null> {
        return this.userRepository.findOne({
            where: { id },
            select: ["id", "firstName", "lastName", "email", "createdAt", "role", "tenantId"],
        });
    }
}
