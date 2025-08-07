import request from "supertest";
import app from "../../src/app";
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { truncateTables } from "../utils";
import { User } from "../../src/entity/User";

describe("POST /auth/register", () => {
    let connection: DataSource;

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
    });

    beforeEach(async () => {
        await truncateTables(connection);
    });

    afterAll(async () => {
        await connection.destroy();
    });

    const registerRoute = "/auth/register";

    const userData = {
        firstName: "Lakshya",
        lastName: "Mittal",
        email: "lakshyamittalaka@gmail.com",
        password: "secret",
    };

    describe("All fields are present", () => {
        it("should return status code 201", async () => {
            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            expect(response.statusCode).toBe(201);
        });

        it("should return status code 201", async () => {
            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            expect(response.headers["content-type"]).toEqual(
                expect.stringContaining("json"),
            );
        });

        it("should persist the user in the database", async () => {
            await request(app).post(registerRoute).send(userData);

            const userRepository = connection.getRepository(User);
            const users = await userRepository.find();

            expect(users).toHaveLength(1);
            expect(users[0].firstName).toBe(userData.firstName);
            expect(users[0].lastName).toBe(userData.lastName);
            expect(users[0].email).toBe(userData.email);
        });
    });
    describe("happy path", () => {});
});
