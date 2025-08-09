import { User } from "../entity/User";
import { Repository } from "typeorm";
import { Roles } from "../constants";
import { UserAlreadyExistsError } from "../errors/UserAlreadyExistsError";
import { CreateUserWithHashDto, IUserService } from "../interfaces/services/IUserService";

export default class UserService implements IUserService {
    constructor(private userRepository: Repository<User>) {}

    async createWithHash({ firstName, lastName, email, hashedPassword }: CreateUserWithHashDto): Promise<User> {
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

    findByEmail(email: string): Promise<User | null> {
        return this.userRepository.findOne({ where: { email } });
    }

    async findById(id: number): Promise<User> {
        const user = await this.userRepository.findOne({
            where: {
                id,
            },
        });

        if (user === null) {
            throw new Error("User with id does not exist");
        }
        return user;
    }
}
