import { UserData } from "../types";
import { User } from "../entity/User";
import { Repository } from "typeorm";
import { Roles } from "../constants";

export default class UserService {
    constructor(private userRepository: Repository<User>) {}

    async create({
        firstName,
        lastName,
        email,
        password,
    }: UserData): Promise<User> {
        return await this.userRepository.save({
            firstName,
            lastName,
            email,
            password,
            role: Roles.CUSTOMER,
        });
    }
}
