export default interface IPasswordService {
    hashPassword(password: string): Promise<string>;
}
