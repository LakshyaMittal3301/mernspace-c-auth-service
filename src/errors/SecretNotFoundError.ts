export class SecretNotFoundError extends Error {
    constructor(secretName: string) {
        super(`Secret Not Found: ${secretName}`);
        this.name = "SecretNotFoundError";
    }
}
