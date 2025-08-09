import { UserData } from "../types";
import { User } from "../entity/User";
import { Repository } from "typeorm";
import { Roles } from "../constants";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";
import IUserService from "../interfaces/services/IUserService";

export default class UserService implements IUserService {
    constructor(private userRepository: Repository<User>) {}

    async create({
        firstName,
        lastName,
        email,
        password,
    }: UserData): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { email: email },
        });

        if (user) {
            throw new UserAlreadyExistsError(email);
        }

        return await this.userRepository.save({
            firstName,
            lastName,
            email,
            password: password,
            role: Roles.CUSTOMER,
        });
    }

    async findByEmail(email: string): Promise<User | null> {
        return await this.userRepository.findOne({ where: { email } });
    }
}
