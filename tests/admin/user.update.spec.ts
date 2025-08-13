import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import request from "supertest";
import app from "../../src/app";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import { Roles } from "../../src/constants";
import { clearAllTablesExceptMigrations, createUser } from "../utils";
import { User } from "../../src/entity/User";
import { Tenant } from "../../src/entity/Tenant";

describe("PATCH /admin/users/:id", () => {
    const route = (id: number | string) => `/admin/users/${id}`;
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    const makeToken = (u: User, extra: Record<string, any> = {}) =>
        jwks.token({ sub: String(u.id), role: u.role, ...extra });

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        await connection.runMigrations();
        jwks = createJWKSMock("http://localhost:5501"); // must match Config.JWKS_URI
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

    const seedAdminForAuth = async () => {
        const admin = await createUser(connection, {
            firstName: "Auth",
            lastName: "Admin",
            email: "authadmin@example.com",
            password: "Admin@123",
            role: Roles.ADMIN,
        });
        return { admin, token: makeToken(admin) };
    };

    const seedTenant = async (name = "Shop A") => {
        const repo = connection.getRepository(Tenant);
        return repo.save(repo.create({ name, address: "Addr" }));
    };

    describe("Auth / RBAC", () => {
        it("401 when unauthenticated", async () => {
            const res = await request(app).patch(route(1)).send({ firstName: "X" });
            expect(res.statusCode).toBe(401);
        });

        it("403 when non-admin calls the route", async () => {
            const mgr = await createUser(connection, {
                firstName: "Mgr",
                lastName: "U",
                email: "mgr@example.com",
                password: "Manager@123",
                role: Roles.MANAGER,
            });
            const res = await request(app)
                .patch(route(mgr.id))
                .set("Cookie", [`accessToken=${makeToken(mgr)}`])
                .send({ firstName: "Nope" });
            expect(res.statusCode).toBe(403);
        });

        it("401 when access token is invalid", async () => {
            const res = await request(app)
                .patch(route(1))
                .set("Cookie", ["accessToken=not-a-jwt"])
                .send({ firstName: "X" });
            expect(res.statusCode).toBe(401);
        });

        it("401 when access token is expired", async () => {
            const { admin } = await seedAdminForAuth();
            const expired = makeToken(admin, { exp: Math.floor(Date.now() / 1000) - 10 });
            const res = await request(app)
                .patch(route(1))
                .set("Cookie", [`accessToken=${expired}`])
                .send({ firstName: "X" });
            expect(res.statusCode).toBe(401);
        });
    });

    describe("Params / basic request validation", () => {
        it("400 when id is not a number", async () => {
            const { token } = await seedAdminForAuth();
            const res = await request(app)
                .patch(route("abc"))
                .set("Cookie", [`accessToken=${token}`])
                .send({ firstName: "X" });
            expect(res.statusCode).toBe(400);
        });

        it("400 when body is empty", async () => {
            const { token } = await seedAdminForAuth();
            const u = await createUser(connection, {
                firstName: "T",
                lastName: "User",
                email: "tuser@example.com",
                password: "Passw0rd!",
                role: Roles.ADMIN,
            });
            const res = await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({});
            expect(res.statusCode).toBe(400);
        });
    });

    describe("Field validation (validator schema only)", () => {
        it("400 when email is invalid", async () => {
            const { token } = await seedAdminForAuth();
            const u = await createUser(connection, {
                firstName: "E",
                lastName: "User",
                email: "euser@example.com",
                password: "Passw0rd!",
                role: Roles.ADMIN,
            });
            const res = await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ email: "not-an-email" });
            expect(res.statusCode).toBe(400);
        });

        it("400 when password length < 8", async () => {
            const { token } = await seedAdminForAuth();
            const u = await createUser(connection, {
                firstName: "P",
                lastName: "User",
                email: "puser@example.com",
                password: "Passw0rd!",
                role: Roles.ADMIN,
            });
            const res = await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ password: "short" });
            expect(res.statusCode).toBe(400);
        });

        it("400 when firstName or lastName are empty strings", async () => {
            const { token } = await seedAdminForAuth();
            const u = await createUser(connection, {
                firstName: "N",
                lastName: "User",
                email: "nuser@example.com",
                password: "Passw0rd!",
                role: Roles.ADMIN,
            });

            const r1 = await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ firstName: "" });
            expect(r1.statusCode).toBe(400);

            const r2 = await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ lastName: "" });
            expect(r2.statusCode).toBe(400);
        });

        it("400 when role is sent (forbidden in validator)", async () => {
            const { token } = await seedAdminForAuth();
            const u = await createUser(connection, {
                firstName: "R",
                lastName: "User",
                email: "ruser@example.com",
                password: "Passw0rd!",
                role: Roles.MANAGER,
            });
            const res = await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ role: Roles.ADMIN });
            expect(res.statusCode).toBe(400);
        });

        it("400 when tenantId is not integer or null", async () => {
            const { token } = await seedAdminForAuth();
            const u = await createUser(connection, {
                firstName: "Tnt",
                lastName: "User",
                email: "tnt@example.com",
                password: "Passw0rd!",
                role: Roles.MANAGER,
            });
            const res = await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ tenantId: "not-int" });
            expect(res.statusCode).toBe(400);
        });
    });

    describe("Not found", () => {
        it("404 when target user does not exist", async () => {
            const { token } = await seedAdminForAuth();
            const res = await request(app)
                .patch(route(999999))
                .set("Cookie", [`accessToken=${token}`])
                .send({ firstName: "New" });
            expect(res.statusCode).toBe(404);
        });
    });

    describe("Business rules in service", () => {
        it("400 or 404 when setting tenantId to a non-existent tenant", async () => {
            const { token } = await seedAdminForAuth();
            const u = await createUser(connection, {
                firstName: "M",
                lastName: "User",
                email: "muser@example.com",
                password: "Passw0rd!",
                role: Roles.MANAGER,
            });
            const res = await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ tenantId: 987654 });
            expect([400, 404]).toContain(res.statusCode); // pick one in your service and lock it
        });

        it("400 when updating email to another user's email (uniqueness)", async () => {
            const { token } = await seedAdminForAuth();

            await createUser(connection, {
                firstName: "A",
                lastName: "One",
                email: "one@example.com",
                password: "Passw0rd!",
                role: Roles.ADMIN,
            });
            const u2 = await createUser(connection, {
                firstName: "B",
                lastName: "Two",
                email: "two@example.com",
                password: "Passw0rd!",
                role: Roles.ADMIN,
            });

            const res = await request(app)
                .patch(route(u2.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ email: "one@example.com" }); // conflict with u1

            expect(res.statusCode).toBe(400);

            // Ensure u2 email unchanged
            const repo = connection.getRepository(User);
            const reloaded = await repo.findOneByOrFail({ id: u2.id });
            expect(reloaded.email).toBe("two@example.com");
        });
    });

    describe("Happy paths", () => {
        it("200 updating basic fields (email/name) normalizes and trims; response is DTO; password not leaked", async () => {
            const { token } = await seedAdminForAuth();
            const u = await createUser(connection, {
                firstName: "John",
                lastName: "Doe",
                email: "john@example.com",
                password: "Passw0rd!",
                role: Roles.ADMIN,
            });

            const res = await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({
                    email: "  NEW.Email@Example.COM ",
                    firstName: "  Jane ",
                    lastName: "  Smith  ",
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("user");
            const user = res.body.user;

            expect(user.id).toBe(u.id);
            expect(user.email).toBe("new.email@example.com"); // normalized
            expect(user.firstName).toBe("Jane");
            expect(user.lastName).toBe("Smith");
            expect(typeof user.createdAt).toBe("string");
            expect(user).not.toHaveProperty("password");

            // DB persisted
            const repo = connection.getRepository(User);
            const db = await repo.findOneByOrFail({ id: u.id });
            expect(db.email).toBe("new.email@example.com");
            expect(db.firstName).toBe("Jane");
            expect(db.lastName).toBe("Smith");
        });

        it("200 updating password hashes it (DB), response never returns password", async () => {
            const { token } = await seedAdminForAuth();
            const u = await createUser(connection, {
                firstName: "Pwd",
                lastName: "User",
                email: "pwduser@example.com",
                password: "OldPass@123",
                role: Roles.ADMIN,
            });

            const res = await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ password: "NewPass@123" });

            expect(res.statusCode).toBe(200);
            expect(res.body.user).not.toHaveProperty("password");

            const repo = connection.getRepository(User);
            const db = await repo.findOneByOrFail({ id: u.id });
            expect(db.password).not.toBe("NewPass@123"); // hashed
        });

        it("200 setting tenantId for a manager (moves shop)", async () => {
            const { token } = await seedAdminForAuth();
            const t1 = await seedTenant("Shop 1");
            const t2 = await seedTenant("Shop 2");

            const repo = connection.getRepository(User);
            const manager = await repo.save(
                repo.create({
                    firstName: "Mana",
                    lastName: "Ger",
                    email: "move@x.com",
                    password: "StrongP@ssw0rd",
                    role: Roles.MANAGER,
                    // initially in t1
                    tenantId: (t1 as any).id ?? undefined,
                    tenant: (t1 as any).id ? undefined : t1,
                }) as any,
            );

            const res = await request(app)
                .patch(route(manager.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ tenantId: (t2 as any).id ?? t2.id });

            expect(res.statusCode).toBe(200);
            const dto = res.body.user;
            expect(dto.role).toBe(Roles.MANAGER);
            expect(dto.tenantId).toBe((t2 as any).id ?? t2.id);

            const db = await repo.findOneByOrFail({ id: manager.id });
            // Either direct FK or via relation depending on your mapping:
            expect((db as any).tenantId ?? db.tenant?.id).toBe((t2 as any).id ?? t2.id);
        });

        it("200 allowing tenantId = null clears assignment", async () => {
            const { token } = await seedAdminForAuth();
            const t = await seedTenant();

            const repo = connection.getRepository(User);
            const manager = await repo.save(
                repo.create({
                    firstName: "Mana",
                    lastName: "Ger",
                    email: "clear@x.com",
                    password: "StrongP@ssw0rd",
                    role: Roles.MANAGER,
                    tenantId: (t as any).id ?? undefined,
                    tenant: (t as any).id ? undefined : t,
                }) as any,
            );

            const res = await request(app)
                .patch(route(manager.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ tenantId: null });

            expect(res.statusCode).toBe(200);
            const dto = res.body.user;
            expect(dto.tenantId).toBeNull();

            const db = await repo.findOneByOrFail({ id: manager.id });
            expect((db as any).tenantId ?? db.tenant?.id ?? null).toBeNull();
        });

        it("200 when updating only one field (partial update)", async () => {
            const { token } = await seedAdminForAuth();
            const u = await createUser(connection, {
                firstName: "Solo",
                lastName: "Field",
                email: "solo@example.com",
                password: "Passw0rd!",
                role: Roles.ADMIN,
            });

            const res = await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ firstName: "Only" });

            expect(res.statusCode).toBe(200);
            expect(res.body.user.firstName).toBe("Only");

            const repo = connection.getRepository(User);
            const db = await repo.findOneByOrFail({ id: u.id });
            expect(db.firstName).toBe("Only");
            expect(db.lastName).toBe("Field");
            expect(db.email).toBe("solo@example.com");
        });

        it("200 when email is unchanged (should not trigger uniqueness error)", async () => {
            const { token } = await seedAdminForAuth();
            const u = await createUser(connection, {
                firstName: "Same",
                lastName: "Mail",
                email: "same@example.com",
                password: "Passw0rd!",
                role: Roles.ADMIN,
            });

            const res = await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ email: "same@example.com" });

            expect(res.statusCode).toBe(200);

            const repo = connection.getRepository(User);
            const db = await repo.findOneByOrFail({ id: u.id });
            expect(db.email).toBe("same@example.com");
        });
    });

    describe("DB invariants", () => {
        it("updates exactly one row and does not create a new user", async () => {
            const { token } = await seedAdminForAuth();
            const repo = connection.getRepository(User);

            const u = await createUser(connection, {
                firstName: "Count",
                lastName: "Me",
                email: "count@example.com",
                password: "Passw0rd!",
                role: Roles.ADMIN,
            });

            const beforeCount = await repo.count();
            await request(app)
                .patch(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send({ firstName: "Updated" })
                .expect(200);

            const afterCount = await repo.count();
            expect(afterCount).toBe(beforeCount);

            const updated = await repo.findOneByOrFail({ id: u.id });
            expect(updated.firstName).toBe("Updated");
        });
    });
});
