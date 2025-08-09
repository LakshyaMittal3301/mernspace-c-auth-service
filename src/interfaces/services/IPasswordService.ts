export interface IPasswordService {
    hashPassword(password: string): Promise<string>;
    comparePassword(plain: string, digest: string): Promise<Boolean>;
}
