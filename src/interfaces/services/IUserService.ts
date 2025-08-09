import { User } from "../../entity/User";
import { UserData } from "../../types";

export default interface IUserService {
    create(data: UserData): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
}
