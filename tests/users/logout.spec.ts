import request from "supertest";
import app from "../../src/app";
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { clearAllTablesExceptMigrations, isJWT } from "../utils";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import { Roles } from "../../src/constants";

describe("POST /auth/logout", () => {
    const registerRoute = "/auth/register";
    const loginRoute = "/auth/login";
    const refreshRoute = "/auth/refresh";
    const logoutRoute = "/auth/logout";

    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    const extractCookie = (cookies: string[] | undefined, name: string) => {
        const c = (cookies || []).find((x) => x.startsWith(`${name}=`));
        return c ? c.split(";")[0].split("=")[1] : "";
    };

    const mixCookieHeader = (accessToken: string, refreshToken: string) => [
        `accessToken=${accessToken}`,
        `refreshToken=${refreshToken}`,
    ];

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        await connection.runMigrations();
        // MUST match Config.JWKS_URI in test env (e.g. http://localhost:5501)
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

    const registerAndLogin = async (email = "logout@e.com", pwd = "Passw0rd!xyz") => {
        await request(app).post(registerRoute).send({
            firstName: "Lakshya",
            lastName: "Mittal",
            email,
            password: pwd,
        });

        const res = await request(app).post(loginRoute).send({ email, password: pwd });
        const cookies = res.get("Set-Cookie") || [];
        const userId = res.body.id;

        // Sanity: app-issued cookies look valid
        const at = extractCookie(cookies, "accessToken");
        const rt = extractCookie(cookies, "refreshToken");
        expect(isJWT(at)).toBeTruthy();
        expect(isJWT(rt)).toBeTruthy();

        return { cookies, userId, email, password: pwd };
    };

    const jwksAccessForUser = (userId: number, role: string = Roles.CUSTOMER) =>
        jwks.token({
            sub: String(userId),
            role,
            // If your middleware enforces issuer/audience, add them here too:
            // iss: "auth-service",
            // aud: "your-audience",
        });

    describe("Happy path", () => {
        it("clears auth cookies and revokes current session's refresh token", async () => {
            const { cookies, userId } = await registerAndLogin();

            // Use JWKS for access (so authenticate passes), real refresh from /login (so handler revokes it)
            const realRefresh = extractCookie(cookies, "refreshToken");
            const jwksAccess = jwksAccessForUser(userId);

            const out = await request(app).post(logoutRoute).set("Cookie", mixCookieHeader(jwksAccess, realRefresh));

            expect([200, 204]).toContain(out.statusCode);

            // Old refresh cookie should no longer work on /refresh
            const refreshWithOld = await request(app)
                .post(refreshRoute)
                .set("Cookie", mixCookieHeader(jwksAccess, realRefresh));

            expect([401, 403]).toContain(refreshWithOld.statusCode);
        });

        it("is idempotent (second logout still succeeds)", async () => {
            const { cookies, userId } = await registerAndLogin();
            const realRefresh = extractCookie(cookies, "refreshToken");
            const jwksAccess = jwksAccessForUser(userId);

            const first = await request(app).post(logoutRoute).set("Cookie", mixCookieHeader(jwksAccess, realRefresh));
            expect([200, 204]).toContain(first.statusCode);

            // Call again with same (now invalid) refresh; should still be OK
            const second = await request(app).post(logoutRoute).set("Cookie", mixCookieHeader(jwksAccess, realRefresh));
            expect([200, 204]).toContain(second.statusCode);
        });
    });

    describe("Edge cases", () => {
        it("requires an access token (no cookies => 401)", async () => {
            // With authenticate middleware on /logout, no access cookie should 401
            const res = await request(app).post(logoutRoute); // no Cookie header at all
            expect(res.statusCode).toBe(401);
        });

        it("only logs out the current session (multi-session safe)", async () => {
            const email = "multi-logout@e.com";
            const pwd = "Mlogout#12345";

            await request(app).post(registerRoute).send({
                firstName: "M",
                lastName: "L",
                email,
                password: pwd,
            });

            // Two independent sessions -> two refresh cookies
            const s1 = await request(app).post(loginRoute).send({ email, password: pwd });
            const s2 = await request(app).post(loginRoute).send({ email, password: pwd });

            const userId = s1.body.id as number;
            const s1Refresh = extractCookie(s1.get("Set-Cookie") || [], "refreshToken");
            const s2Refresh = extractCookie(s2.get("Set-Cookie") || [], "refreshToken");

            const jwksAccess = jwksAccessForUser(userId);

            // Logout using session-1 (jwks access + s1's refresh)
            const out = await request(app).post(logoutRoute).set("Cookie", mixCookieHeader(jwksAccess, s1Refresh));
            expect([200, 204]).toContain(out.statusCode);

            // Session-1 refresh should now fail
            const r1 = await request(app).post(refreshRoute).set("Cookie", mixCookieHeader(jwksAccess, s1Refresh));
            expect([401, 403]).toContain(r1.statusCode);

            // Session-2 refresh should still work
            const r2 = await request(app).post(refreshRoute).set("Cookie", mixCookieHeader(jwksAccess, s2Refresh));
            expect(r2.statusCode).toBe(200);
        });

        it("handles already-rotated/invalid refresh cookie gracefully (still succeeds)", async () => {
            const { cookies, userId } = await registerAndLogin();

            const oldRefresh = extractCookie(cookies, "refreshToken");
            const jwksAccess = jwksAccessForUser(userId);

            // Rotate refresh once
            const ref = await request(app).post(refreshRoute).set("Cookie", mixCookieHeader(jwksAccess, oldRefresh));
            expect(ref.statusCode).toBe(200);

            // Logout with the *old* (now invalid) refresh cookie should still return 200/204
            const out = await request(app).post(logoutRoute).set("Cookie", mixCookieHeader(jwksAccess, oldRefresh));
            expect([200, 204]).toContain(out.statusCode);
        });
    });
});
