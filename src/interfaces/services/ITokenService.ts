import { JwtPayload } from "jsonwebtoken";
import { User } from "../../entity/User";

export default interface ITokenService {
    generateAccessToken(payload: JwtPayload): Promise<string>;
    generateRefreshToken(payload: JwtPayload, user: User): Promise<string>;
}
