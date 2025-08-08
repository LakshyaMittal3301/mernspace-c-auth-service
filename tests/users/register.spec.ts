import request from "supertest";
import app from "../../src/app";
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { User } from "../../src/entity/User";
import { Roles } from "../../src/constants";
import { isJWT } from "../utils";
import { RefreshToken } from "../../src/entity/RefreshToken";

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
            password: "strongPassword@123",
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

        it("should store the hashed password in the database", async () => {
            await request(app).post(registerRoute).send(userData);

            const userRepository = connection.getRepository(User);
            const users = await userRepository.find();

            expect(users[0].password).not.toBe(userData.password);
            expect(users[0].password).toHaveLength(60);
            expect(users[0].password).toMatch(/^\$2b\$\d+\$/);
        });

        it("should return 400 status code if email already exists", async () => {
            const userRepository = connection.getRepository(User);
            await userRepository.save({ ...userData, role: Roles.CUSTOMER });

            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            expect(response.statusCode).toBe(400);

            const numberOfUsers = await userRepository.count();
            expect(numberOfUsers).toBe(1);
        });

        it("should return access token and refresh token inside the cookies", async () => {
            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            let accessToken = "";
            let refreshToken = "";

            const cookies = response.get("Set-Cookie") || [];

            cookies.forEach((cookie) => {
                if (cookie.startsWith("accessToken=")) {
                    accessToken = cookie.split(";")[0].split("=")[1];
                }

                if (cookie.startsWith("refreshToken=")) {
                    refreshToken = cookie.split(";")[0].split("=")[1];
                }
            });

            expect(accessToken).not.toHaveLength(0);
            expect(refreshToken).not.toHaveLength(0);

            expect(isJWT(accessToken)).toBeTruthy();
            expect(isJWT(refreshToken)).toBeTruthy();
        });

        it("should store a refresh token for the user", async () => {
            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            expect(response.body).toHaveProperty("id");

            const refreshTokenRepo = connection.getRepository(RefreshToken);

            const query = refreshTokenRepo
                .createQueryBuilder("refreshToken")
                .where(`refreshToken.userId = ${response.body.id}`);

            const tokens = await query.getMany();
            expect(tokens).toHaveLength(1);
        });
    });

    describe("Fields are missing", () => {
        it("should return 400 status code if email field is missing", async () => {
            const userData = {
                firstName: "Lakshya",
                lastName: "Mittal",
                password: "strongPassword@123",
            };

            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            expect(response.statusCode).toBe(400);

            const userRepository = connection.getRepository(User);
            const numberOfUsers = await userRepository.count();
            expect(numberOfUsers).toBe(0);
        });

        it("should return 400 status code if firstName field is missing", async () => {
            const userData = {
                email: "abc@gmail.com",
                lastName: "Mittal",
                password: "strongPassword@123",
            };

            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            expect(response.statusCode).toBe(400);

            const userRepository = connection.getRepository(User);
            const numberOfUsers = await userRepository.count();
            expect(numberOfUsers).toBe(0);
        });

        it("should return 400 status code if lastName field is missing", async () => {
            const userData = {
                email: "abc@gmail.com",
                firstName: "Lakshya",
                password: "strongPassword@123",
            };

            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            expect(response.statusCode).toBe(400);

            const userRepository = connection.getRepository(User);
            const numberOfUsers = await userRepository.count();
            expect(numberOfUsers).toBe(0);
        });

        it("should return 400 status code if password field is missing", async () => {
            const userData = {
                email: "abc@gmail.com",
                firstName: "Lakshya",
                lastName: "Mittal",
            };

            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            expect(response.statusCode).toBe(400);

            const userRepository = connection.getRepository(User);
            const numberOfUsers = await userRepository.count();
            expect(numberOfUsers).toBe(0);
        });
    });

    describe("Fields are not in proper format", () => {
        it("should trim the email field", async () => {
            const properEmail = "abc@gmail.com";
            const userData = {
                email: "    " + properEmail + "  ",
                firstName: "abc",
                lastName: "abc",
                password: "strongPassword@123",
            };

            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            expect(response.statusCode).toBe(201);

            const userRepository = connection.getRepository(User);
            const users = await userRepository.find();

            expect(users[0].email).toBe(properEmail);
        });

        it("should return 400 status code if email is not a valid email", async () => {
            const userData = {
                email: "abcgmail.com",
                firstName: "Lakshya",
                lastName: "Mittal",
                password: "strongPassword@123",
            };

            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            expect(response.statusCode).toBe(400);

            const userRepository = connection.getRepository(User);
            const numberOfUsers = await userRepository.count();
            expect(numberOfUsers).toBe(0);
        });

        it("should return 400 status code if password length is less than 8", async () => {
            const userData = {
                email: "abc@gmail.com",
                firstName: "Lakshya",
                lastName: "Mittal",
                password: "secret",
            };

            const response = await request(app)
                .post(registerRoute)
                .send(userData);

            expect(response.statusCode).toBe(400);

            const userRepository = connection.getRepository(User);
            const numberOfUsers = await userRepository.count();
            expect(numberOfUsers).toBe(0);
        });
    });
});
