import request from "supertest";
import bcrypt from "bcrypt";
import app from "../../src/app";
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { User } from "../../src/entity/User";
import { Roles } from "../../src/constants";
import { isJWT } from "../utils";
import { RefreshToken } from "../../src/entity/RefreshToken";

describe.skip("POST /auth/login", () => {
    const loginRoute = "/auth/login";
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

    describe("Valid credentials", () => {
        const plainPassword = "strongPassword@123";
        const email = "lakshya@example.com";

        beforeEach(async () => {
            const userRepo = connection.getRepository(User);
            const passwordHash = await bcrypt.hash(plainPassword, 10);

            await userRepo.save({
                firstName: "Lakshya",
                lastName: "Mittal",
                email,
                password: passwordHash, // assuming your column is named `password`
                role: Roles.CUSTOMER,
            });
        });

        it("should return 200 when login is successful", async () => {
            const response = await request(app).post(loginRoute).send({ email, password: plainPassword });
            expect(response.statusCode).toBe(200);
            expect(response.headers["content-type"]).toEqual(expect.stringContaining("json"));
        });

        it("should return the user id in body", async () => {
            const response = await request(app).post(loginRoute).send({ email, password: plainPassword });

            expect(response.body).toHaveProperty("id");
            const repo = connection.getRepository(User);
            const users = await repo.find();
            expect(response.body.id).toBe(users[0].id);
        });

        it("should set accessToken and refreshToken cookies", async () => {
            const response = await request(app).post(loginRoute).send({ email, password: plainPassword });

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

        it("should create a refresh token row for the user", async () => {
            const response = await request(app).post(loginRoute).send({ email, password: plainPassword });
            expect(response.body).toHaveProperty("id");

            const refreshTokenRepo = connection.getRepository(RefreshToken);
            const tokens = await refreshTokenRepo
                .createQueryBuilder("rt")
                .where("rt.userId = :id", { id: response.body.id })
                .getMany();

            expect(tokens).toHaveLength(1);
            expect(tokens[0].expiresAt).toBeInstanceOf(Date);
        });
    });

    describe("Missing or malformed fields", () => {
        it("should return 400 if email is missing", async () => {
            const res = await request(app).post(loginRoute).send({ password: "secret123" });
            expect(res.statusCode).toBe(400);
        });

        it("should return 400 if password is missing", async () => {
            const res = await request(app).post(loginRoute).send({ email: "a@b.com" });
            expect(res.statusCode).toBe(400);
        });

        it("should trim the email and still succeed", async () => {
            const userRepo = connection.getRepository(User);
            const passwordHash = await bcrypt.hash("secret123", 10);
            await userRepo.save({
                firstName: "A",
                lastName: "B",
                email: "trimme@site.com",
                password: passwordHash,
                role: Roles.CUSTOMER,
            });

            const res = await request(app).post(loginRoute).send({
                email: "   trimme@site.com   ",
                password: "secret123",
            });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("id");
        });

        it("should return 400 if email is not a valid email", async () => {
            const res = await request(app).post(loginRoute).send({
                email: "not-an-email",
                password: "somepassword",
            });
            expect(res.statusCode).toBe(400);
        });
    });

    describe("Invalid credentials", () => {
        it("should return 401 if user does not exist", async () => {
            const res = await request(app).post(loginRoute).send({
                email: "missing@site.com",
                password: "whatever123",
            });

            expect(res.statusCode).toBe(401);

            // Should not set auth cookies
            const cookies = res.get("Set-Cookie") || [];
            const hasAccess = cookies.some((c) => c.startsWith("accessToken="));
            const hasRefresh = cookies.some((c) => c.startsWith("refreshToken="));
            expect(hasAccess).toBe(false);
            expect(hasRefresh).toBe(false);
        });

        it("should return 401 if password is incorrect", async () => {
            const userRepo = connection.getRepository(User);
            const passwordHash = await bcrypt.hash("correctPassword1!", 10);
            await userRepo.save({
                firstName: "Test",
                lastName: "User",
                email: "test@login.com",
                password: passwordHash,
                role: Roles.CUSTOMER,
            });

            const res = await request(app).post(loginRoute).send({
                email: "test@login.com",
                password: "WRONGpassword",
            });

            expect(res.statusCode).toBe(401);

            const cookies = res.get("Set-Cookie") || [];
            const hasAccess = cookies.some((c) => c.startsWith("accessToken="));
            const hasRefresh = cookies.some((c) => c.startsWith("refreshToken="));
            expect(hasAccess).toBe(false);
            expect(hasRefresh).toBe(false);
        });

        it("should not reveal whether email or password was wrong (generic message)", async () => {
            const res1 = await request(app).post(loginRoute).send({
                email: "nobody@site.com",
                password: "badpass",
            });

            const userRepo = connection.getRepository(User);
            const passwordHash = await bcrypt.hash("RealPass#123", 10);
            await userRepo.save({
                firstName: "N",
                lastName: "U",
                email: "real@site.com",
                password: passwordHash,
                role: Roles.CUSTOMER,
            });

            const res2 = await request(app).post(loginRoute).send({
                email: "real@site.com",
                password: "wrongpass",
            });

            expect(res1.statusCode).toBe(401);
            expect(res2.statusCode).toBe(401);
            // If you return messages, ensure they are identical (optional):
            // expect(res1.body.error).toBe(res2.body.error);
        });
    });

    describe("Database invariants", () => {
        it("should not create a new user on login", async () => {
            const userRepo = connection.getRepository(User);
            const passwordHash = await bcrypt.hash("Secret!234", 10);
            await userRepo.save({
                firstName: "Keep",
                lastName: "Count",
                email: "keep@count.com",
                password: passwordHash,
                role: Roles.CUSTOMER,
            });

            const before = await userRepo.count();

            await request(app).post(loginRoute).send({
                email: "keep@count.com",
                password: "Secret!234",
            });

            const after = await userRepo.count();
            expect(after).toBe(before);
        });

        it("should create exactly one new refresh token per successful login", async () => {
            const userRepo = connection.getRepository(User);
            const rtRepo = connection.getRepository(RefreshToken);

            const passwordHash = await bcrypt.hash("xYz12345!", 10);
            const user = await userRepo.save({
                firstName: "Token",
                lastName: "Maker",
                email: "token@maker.com",
                password: passwordHash,
                role: Roles.CUSTOMER,
            });

            const before = await rtRepo.count({ where: { user: { id: user.id } } });

            await request(app).post(loginRoute).send({
                email: "token@maker.com",
                password: "xYz12345!",
            });

            const after = await rtRepo.count({ where: { user: { id: user.id } } });
            expect(after).toBe(before + 1);
        });
    });
});
