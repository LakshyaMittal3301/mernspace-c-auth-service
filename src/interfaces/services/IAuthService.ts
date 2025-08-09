import { User } from "../../entity/User";
import { UserData } from "../../types";

export default interface IAuthService {
    register(registerData: UserData): Promise<{
        user: User;
        tokens: { accessToken: string; refreshToken: string };
    }>;
}
