export class UserAlreadyExistsError extends Error {
    constructor(email: string) {
        super(`A user with email ${email} already exists`);
        this.name = "UserAlreadyExistsError";
        this.email = email;
    }

    public email: string;
}
