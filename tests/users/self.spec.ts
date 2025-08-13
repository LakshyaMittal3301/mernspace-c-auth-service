import request from "supertest";
import app from "../../src/app";
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import { clearAllTablesExceptMigrations, createUser } from "../utils";

describe("GET /auth/self", () => {
    const selfRoute = "/auth/self";
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        await connection.runMigrations();
        jwks = createJWKSMock("http://localhost:5501");
    });

    beforeEach(async () => {
        stopJwksMock = jwks.start();
        await clearAllTablesExceptMigrations(connection);
    });

    afterEach(async () => {
        stopJwksMock();
    });

    afterAll(async () => {
        await connection.destroy();
    });

    describe("All fields are present", () => {
        const userData = {
            firstName: "lakshya",
            lastName: "mittal",
            email: "lakshya@gmail.com",
            password: "lakshya@123",
        };

        it("should return 200 status code", async () => {
            const newUser = await createUser(connection, userData);

            const accessToken = jwks.token({
                sub: String(newUser.id),
                role: newUser.role,
            });

            // Add Token to cookies

            const response = await request(app)
                .get(selfRoute)
                .set("Cookie", [`accessToken=${accessToken}`])
                .send();
            expect(response.statusCode).toBe(200);
        });

        it("should return the user data", async () => {
            // Insert a User
            const newUser = await createUser(connection, userData);

            // Generate Token
            const accessToken = jwks.token({
                sub: String(newUser.id),
                role: newUser.role,
            });

            // Add Token to cookies

            const response = await request(app)
                .get(selfRoute)
                .set("Cookie", [`accessToken=${accessToken}`])
                .send();

            // Check if user id matches with registered user
            expect(response.body).toHaveProperty("id");
            expect(response.body.id).toBe(newUser.id);
        });

        it("should not return the password in the user data", async () => {
            const newUser = await createUser(connection, userData);

            // Generate Token
            const accessToken = jwks.token({
                sub: String(newUser.id),
                role: newUser.role,
            });

            // Add Token to cookies

            const response = await request(app)
                .get(selfRoute)
                .set("Cookie", [`accessToken=${accessToken}`])
                .send();

            // Check if user id matches with registered user
            expect(response.body).not.toHaveProperty("password");
        });

        it("should return 401 status code when token is not present", async () => {
            const response = await request(app).get(selfRoute).send();

            expect(response.statusCode).toBe(401);
        });
    });
});
