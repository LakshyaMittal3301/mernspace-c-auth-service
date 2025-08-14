export class AdminCredentialsNotFound extends Error {
    constructor() {
        super(`Admin Credentials Not Found`);
        this.name = "AdminCredentialsNotFound";
    }
}
