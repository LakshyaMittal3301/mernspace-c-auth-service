import request from "supertest";
import app from "../../src/app";
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { isJWT } from "../utils";
import { RefreshToken } from "../../src/entity/RefreshToken";

describe.skip("POST /auth/refresh", () => {
    const registerRoute = "/auth/register";
    const loginRoute = "/auth/login";
    const refreshRoute = "/auth/refresh";

    let connection: DataSource;

    const extractCookie = (cookies: string[] | undefined, name: string) => {
        const c = (cookies || []).find((x) => x.startsWith(`${name}=`));
        return c ? c.split(";")[0].split("=")[1] : "";
    };

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

    const bootstrapUserAndLogin = async (email = "u@e.com", pwd = "Passw0rd!xyz") => {
        await request(app).post(registerRoute).send({
            firstName: "Lakshya",
            lastName: "Mittal",
            email,
            password: pwd,
        });
        // or do explicit login to ensure the flow is same as prod
        const res = await request(app).post(loginRoute).send({ email, password: pwd });
        const cookies = res.get("Set-Cookie") || [];
        return {
            accessToken: extractCookie(cookies, "accessToken"),
            refreshToken: extractCookie(cookies, "refreshToken"),
            cookies,
            userId: res.body.id,
        };
    };

    describe("Happy path", () => {
        it("returns 200, rotates refresh token, and issues a new access token", async () => {
            const { cookies: initialCookies, userId } = await bootstrapUserAndLogin();

            const res1 = await request(app).post(refreshRoute).set("Cookie", initialCookies);
            expect(res1.statusCode).toBe(200);
            expect(res1.headers["content-type"]).toEqual(expect.stringContaining("json"));

            const r1Cookies = res1.get("Set-Cookie") || [];
            const newAccess = extractCookie(r1Cookies, "accessToken");
            const newRefresh = extractCookie(r1Cookies, "refreshToken");

            expect(isJWT(newAccess)).toBeTruthy();
            expect(isJWT(newRefresh)).toBeTruthy();

            // DB should have at least one (more) refresh token for the same user
            const rtRepo = connection.getRepository(RefreshToken);
            const tokensAfter = await rtRepo
                .createQueryBuilder("rt")
                .where("rt.userId = :id", { id: userId })
                .getMany();

            expect(tokensAfter.length).toBeGreaterThanOrEqual(1);
            tokensAfter.forEach((t) => expect(t.expiresAt).toBeInstanceOf(Date));
        });

        it("old refresh token becomes unusable after rotation (single-use)", async () => {
            const { cookies: initialCookies } = await bootstrapUserAndLogin();

            const first = await request(app).post(refreshRoute).set("Cookie", initialCookies);
            expect(first.statusCode).toBe(200);

            // try reusing the ORIGINAL (now-rotated) cookie again
            const second = await request(app).post(refreshRoute).set("Cookie", initialCookies);
            expect([401, 403]).toContain(second.statusCode);
        });

        it("new access token actually changes on refresh", async () => {
            const { cookies: initialCookies } = await bootstrapUserAndLogin();

            // grab original access token value
            const origAccess = extractCookie(initialCookies, "accessToken");
            expect(isJWT(origAccess)).toBeTruthy();

            // Wait to pass one second
            await new Promise((r) => setTimeout(r, 1100));

            const res = await request(app).post(refreshRoute).set("Cookie", initialCookies);
            expect(res.statusCode).toBe(200);

            const newAccess = extractCookie(res.get("Set-Cookie") || [], "accessToken");
            expect(isJWT(newAccess)).toBeTruthy();
            expect(newAccess).not.toEqual(origAccess);
        });
    });

    describe("Edge cases", () => {
        it("returns 401/400 if refreshToken cookie is missing", async () => {
            await bootstrapUserAndLogin();

            const res = await request(app).post(refreshRoute); // no cookies
            expect([400, 401]).toContain(res.statusCode);
        });

        it("returns 401 if refresh token row no longer exists (deleted/rotated)", async () => {
            const { cookies, userId } = await bootstrapUserAndLogin();

            // Delete all refresh tokens for user to simulate missing jti in DB
            const rtRepo = connection.getRepository(RefreshToken);
            const existing = await rtRepo.createQueryBuilder("rt").where("rt.userId = :id", { id: userId }).getMany();
            await rtRepo.remove(existing);

            const res = await request(app).post(refreshRoute).set("Cookie", cookies);
            expect([401, 403]).toContain(res.statusCode);
        });

        it("rejects clearly malformed refresh token cookie", async () => {
            await bootstrapUserAndLogin();

            const res = await request(app)
                .post(refreshRoute)
                .set("Cookie", ["refreshToken=this-is-not-a-jwt; Path=/; HttpOnly"]);
            expect([400, 401]).toContain(res.statusCode);
        });

        it("keeps other sessions valid when one session refreshes (multi-session)", async () => {
            // Login twice -> two sessions (two distinct refresh tokens)
            const u = { email: "multi@e.com", pwd: "Multi#12345" };
            await request(app).post(registerRoute).send({
                firstName: "M",
                lastName: "S",
                email: u.email,
                password: u.pwd,
            });
            const s1 = await request(app).post(loginRoute).send({ email: u.email, password: u.pwd });
            const s2 = await request(app).post(loginRoute).send({ email: u.email, password: u.pwd });

            const s1Cookies = s1.get("Set-Cookie") || [];
            const s2Cookies = s2.get("Set-Cookie") || [];

            // Refresh using only session-1 cookie
            const r1 = await request(app).post(refreshRoute).set("Cookie", s1Cookies);
            expect(r1.statusCode).toBe(200);

            // Session-2 cookie should still be able to refresh independently
            const r2 = await request(app).post(refreshRoute).set("Cookie", s2Cookies);
            expect(r2.statusCode).toBe(200);
        });
    });
});
