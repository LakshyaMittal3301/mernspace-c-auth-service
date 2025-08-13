// tests/tenants/delete-tenant.spec.ts
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import request from "supertest";
import app from "../../src/app";
import { Tenant } from "../../src/entity/Tenant";
import { User } from "../../src/entity/User";
import { clearAllTablesExceptMigrations, createUser } from "../utils";
import { Roles } from "../../src/constants";

describe("DELETE /tenants/:id", () => {
    const route = (id: string | number) => `/tenants/${id}`;
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    let admin: User;
    let adminAccessToken: string;

    const makeTokenFor = (user: User, extra: Record<string, any> = {}) =>
        jwks.token({ sub: String(user.id), role: user.role, ...extra });

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        await connection.runMigrations();
        // MUST match Config.JWKS_URI in test env (e.g. http://localhost:5501)
        jwks = createJWKSMock("http://localhost:5501");
    });

    beforeEach(async () => {
        stopJwksMock = jwks.start();
        await clearAllTablesExceptMigrations(connection);

        admin = await createUser(connection, {
            firstName: "Admin",
            lastName: "User",
            email: "admin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        adminAccessToken = makeTokenFor(admin);
    });

    afterEach(async () => {
        stopJwksMock();
    });

    afterAll(async () => {
        await connection.destroy();
    });

    const seedTenant = async (overrides?: Partial<Tenant>) => {
        const repo = connection.getRepository(Tenant);
        const t = repo.create({
            name: "To Delete",
            address: "Somewhere",
            ...overrides,
        });
        return repo.save(t);
    };

    describe("Happy path & idempotency", () => {
        it("returns 204 and removes the tenant if it exists", async () => {
            const t = await seedTenant();
            const before = await connection.getRepository(Tenant).count();

            const res = await request(app)
                .delete(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(204);
            expect(res.text).toBe(""); // no body

            const after = await connection.getRepository(Tenant).count();
            expect(after).toBe(before - 1);

            const gone = await connection.getRepository(Tenant).findOne({ where: { id: t.id } });
            expect(gone).toBeNull();
        });

        it("returns 204 even if the tenant has already been deleted (idempotent)", async () => {
            const t = await seedTenant();

            await request(app)
                .delete(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send()
                .expect(204);

            // delete again
            const res2 = await request(app)
                .delete(route(t.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res2.statusCode).toBe(204);
            expect(res2.text).toBe("");
        });

        it("returns 204 for a numeric but non-existing id", async () => {
            const res = await request(app)
                .delete(route(99999))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(204);
            expect(res.text).toBe("");

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });

        it("handles whitespace id that parses to a number", async () => {
            const t = await seedTenant();

            const res = await request(app)
                .delete(route(`   ${t.id}  `))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(204);
        });
    });

    describe("Invalid input", () => {
        it("400 when id is not a number", async () => {
            const res = await request(app)
                .delete(route("abc"))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();

            expect(res.statusCode).toBe(400);

            const count = await connection.getRepository(Tenant).count();
            expect(count).toBe(0);
        });

        it("treats negative or zero ids as numeric (implementation choice) — here expect 204", async () => {
            // If your controller decides to 400 these, flip the expectation accordingly.
            const res0 = await request(app)
                .delete(route(0))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();
            expect(res0.statusCode).toBe(204);

            const resNeg = await request(app)
                .delete(route(-123))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send();
            expect(resNeg.statusCode).toBe(204);
        });
    });

    describe("Auth / RBAC", () => {
        it("401 when unauthenticated", async () => {
            const res = await request(app).delete(route(1)).send();
            expect(res.statusCode).toBe(401);
        });

        it("401 when access token is invalid", async () => {
            const res = await request(app).delete(route(1)).set("Cookie", ["accessToken=not-a-jwt"]).send();

            expect(res.statusCode).toBe(401);
        });

        it("401 when access token is expired", async () => {
            const expired = makeTokenFor(admin, { exp: Math.floor(Date.now() / 1000) - 10 });

            const res = await request(app)
                .delete(route(1))
                .set("Cookie", [`accessToken=${expired}`])
                .send();

            expect(res.statusCode).toBe(401);
        });

        it("403 when non-admin calls the route", async () => {
            const manager = await createUser(connection, {
                firstName: "Mgr",
                lastName: "User",
                email: "mgr@example.com",
                password: "Manager@123",
                role: Roles.MANAGER,
            });
            const managerToken = makeTokenFor(manager);

            const t = await seedTenant();

            const res = await request(app)
                .delete(route(t.id))
                .set("Cookie", [`accessToken=${managerToken}`])
                .send();

            expect(res.statusCode).toBe(403);

            // Ensure record still exists
            const stillThere = await connection.getRepository(Tenant).findOne({ where: { id: t.id } });
            expect(stillThere).not.toBeNull();
        });
    });

    describe("Invariants", () => {
        it("does not create any new tenants as a side-effect", async () => {
            const before = await connection.getRepository(Tenant).count();

            await request(app)
                .delete(route(123456)) // non-existent
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send()
                .expect(204);

            const after = await connection.getRepository(Tenant).count();
            expect(after).toBe(before);
        });

        it("deleting one tenant does not affect others", async () => {
            const repo = connection.getRepository(Tenant);
            const t1 = await seedTenant({ name: "A" });
            const t2 = await seedTenant({ name: "B" });

            await request(app)
                .delete(route(t1.id))
                .set("Cookie", [`accessToken=${adminAccessToken}`])
                .send()
                .expect(204);

            const stillThere = await repo.findOne({ where: { id: t2.id } });
            expect(stillThere).not.toBeNull();
            expect(stillThere!.name).toBe("B");
        });
    });
});
