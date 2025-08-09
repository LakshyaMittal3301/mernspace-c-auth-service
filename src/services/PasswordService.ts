import { IPasswordService } from "../interfaces/services/IPasswordService";
import bcrypt from "bcrypt";

export default class PasswordService implements IPasswordService {
    async hashPassword(password: string): Promise<string> {
        const saltRounds = 10;
        return await bcrypt.hash(password, saltRounds);
    }
}
