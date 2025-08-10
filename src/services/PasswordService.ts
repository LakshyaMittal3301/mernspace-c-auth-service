import { IPasswordService } from "../interfaces/services/IPasswordService";
import bcrypt from "bcrypt";

export default class PasswordService implements IPasswordService {
    hashPassword(password: string): Promise<string> {
        const saltRounds = 10;
        return bcrypt.hash(password, saltRounds);
    }

    comparePassword(plain: string, digest: string): Promise<boolean> {
        return bcrypt.compare(plain, digest);
    }
}
