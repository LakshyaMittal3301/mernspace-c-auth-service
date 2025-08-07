import { UserData } from "../types";
import { User } from "../entity/User";
import { Repository } from "typeorm";

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
        });
    }
}
