import { UserData } from "../types";
import { User } from "../entity/User";
import { Repository } from "typeorm";
import { Roles } from "../constants";
import bcrypt from "bcrypt";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";

export default class UserService {
    constructor(private userRepository: Repository<User>) {}

    async create({
        firstName,
        lastName,
        email,
        password,
    }: UserData): Promise<User> {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

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
            password: hashedPassword,
            role: Roles.CUSTOMER,
        });
    }
}
