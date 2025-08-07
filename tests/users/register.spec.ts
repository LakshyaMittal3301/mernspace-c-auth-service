import request from "supertest";
import app from "../../src/app";
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { User } from "../../src/entity/User";
import { Roles } from "../../src/constants";

describe("POST /auth/register", () => {
    const registerRoute = "/auth/register";

    let connection: DataSource;

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
    });

    beforeEach(async () => {
        await connection.dropDatabase();
        await connection.synchronize();
    });

    afterAll(async () => {
        await connection.destroy();
    });

    describe("All fields are present", () => {
        const userData = {
            firstName: "Lakshya",
            lastName: "Mittal",
            email: "lakshyamittalaka@gmail.com",
            password: "secret",
        };

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

        it("should return the id of the created user", async () => {
            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            expect(response.body).toHaveProperty("id");
            const repository = AppDataSource.getRepository(User);
            const users = await repository.find();
            expect(response.body.id).toBe(users[0].id);
        });

        it("should assign a customer role", async () => {
            await request(app).post(registerRoute).send(userData);

            const userRepository = connection.getRepository(User);
            const users = await userRepository.find();

            expect(users[0]).toHaveProperty("role");
            expect(users[0].role).toBe(Roles.CUSTOMER);
        });
    });
    describe("happy path", () => {});
});
