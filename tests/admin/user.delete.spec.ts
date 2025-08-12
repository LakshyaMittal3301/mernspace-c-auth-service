// tests/admin/users.delete.spec.ts
import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import request from "supertest";
import app from "../../src/app";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import { Roles } from "../../src/constants";
import { createUser } from "../utils";
import { User } from "../../src/entity/User";
import { Tenant } from "../../src/entity/Tenant";
import { RefreshToken } from "../../src/entity/RefreshToken";

describe.skip("DELETE /admin/users/:id", () => {
    const route = (id: number | string) => `/admin/users/${id}`;
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;

    const makeToken = (u: User, extra: Record<string, any> = {}) =>
        jwks.token({ sub: String(u.id), role: u.role, ...extra });

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        jwks = createJWKSMock("http://localhost:5501"); // must match Config.JWKS_URI in tests
    });

    beforeEach(async () => {
        stopJwksMock = jwks.start();
        await connection.dropDatabase();
        await connection.synchronize();
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

    describe.skip("Auth / RBAC", () => {
        it("401 when unauthenticated", async () => {
            const res = await request(app).delete(route(1)).send();
            expect(res.statusCode).toBe(401);
        });

        it("403 when non-admin calls the route", async () => {
            const mgr = await createUser(connection, {
                firstName: "Mgr",
                lastName: "User",
                email: "mgr@example.com",
                password: "Manager@123",
                role: Roles.MANAGER,
            });
            const res = await request(app)
                .delete(route(mgr.id))
                .set("Cookie", [`accessToken=${makeToken(mgr)}`])
                .send();
            expect(res.statusCode).toBe(403);
        });

        it("401 when access token is invalid", async () => {
            const res = await request(app).delete(route(1)).set("Cookie", ["accessToken=not-a-jwt"]).send();
            expect(res.statusCode).toBe(401);
        });

        it("401 when access token is expired", async () => {
            const { admin } = await seedAdminForAuth();
            const expired = makeToken(admin, { exp: Math.floor(Date.now() / 1000) - 10 });
            const res = await request(app)
                .delete(route(1))
                .set("Cookie", [`accessToken=${expired}`])
                .send();
            expect(res.statusCode).toBe(401);
        });
    });

    describe.skip("Params / basic validation", () => {
        it("400 when id is not a number", async () => {
            const { token } = await seedAdminForAuth();
            const res = await request(app)
                .delete(route("abc"))
                .set("Cookie", [`accessToken=${token}`])
                .send();
            expect(res.statusCode).toBe(400);
        });
    });

    describe.skip("Not found vs idempotent behavior", () => {
        it("204 when user does not exist (idempotent delete)", async () => {
            const { token } = await seedAdminForAuth();
            const res = await request(app)
                .delete(route(999999))
                .set("Cookie", [`accessToken=${token}`])
                .send();
            expect(res.statusCode).toBe(204);
            // body should be empty on 204
            expect(res.text === "" || res.text === undefined).toBe(true);
        });
    });

    describe.skip("Happy paths", () => {
        it("204 and removes the user; does not affect others", async () => {
            const { token } = await seedAdminForAuth();

            const u1 = await createUser(connection, {
                firstName: "Kill",
                lastName: "Me",
                email: "killme@example.com",
                password: "Passw0rd!",
                role: Roles.ADMIN,
            });
            const u2 = await createUser(connection, {
                firstName: "Keep",
                lastName: "Me",
                email: "keepme@example.com",
                password: "Passw0rd!",
                role: Roles.MANAGER,
            });

            const repo = connection.getRepository(User);
            const before = await repo.count();

            const res = await request(app)
                .delete(route(u1.id))
                .set("Cookie", [`accessToken=${token}`])
                .send();
            expect(res.statusCode).toBe(204);
            expect(res.text === "" || res.text === undefined).toBe(true);

            const after = await repo.count();
            expect(after).toBe(before - 1);
            expect(await repo.findOneBy({ id: u1.id })).toBeNull();
            expect(await repo.findOneBy({ id: u2.id })).not.toBeNull(); // other user remains
        });

        it("204 when deleting a manager associated with a tenant; tenant remains", async () => {
            const { token } = await seedAdminForAuth();
            const t = await seedTenant("Shop X");

            const repo = connection.getRepository(User);
            const manager = await repo.save(
                repo.create({
                    firstName: "Mana",
                    lastName: "Ger",
                    email: "m@x.com",
                    password: "StrongP@ssw0rd",
                    role: Roles.MANAGER,
                    // depending on your mapping:
                    tenantId: (t as any).id ?? undefined,
                    tenant: (t as any).id ? undefined : t,
                }) as any,
            );

            const res = await request(app)
                .delete(route(manager.id))
                .set("Cookie", [`accessToken=${token}`])
                .send();
            expect(res.statusCode).toBe(204);

            // tenant should still exist
            const tRepo = connection.getRepository(Tenant);
            const stillThere = await tRepo.findOneBy({ id: (t as any).id ?? t.id });
            expect(stillThere).not.toBeNull();
        });

        it("idempotent: deleting same id twice returns 204 both times", async () => {
            const { token } = await seedAdminForAuth();
            const u = await createUser(connection, {
                firstName: "Twice",
                lastName: "Gone",
                email: "twice@example.com",
                password: "Passw0rd!",
                role: Roles.ADMIN,
            });

            const first = await request(app)
                .delete(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send();
            expect(first.statusCode).toBe(204);

            const second = await request(app)
                .delete(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send();
            expect(second.statusCode).toBe(204);
        });
    });

    describe.skip("Cascade delete of refresh tokens", () => {
        it("deletes all refresh tokens belonging to the user (onDelete: CASCADE)", async () => {
            const { token } = await seedAdminForAuth();

            const u = await createUser(connection, {
                firstName: "Has",
                lastName: "Tokens",
                email: "hastokens@example.com",
                password: "Passw0rd!",
                role: Roles.MANAGER,
            });

            const rtRepo = connection.getRepository(RefreshToken);
            const inOneHour = new Date(Date.now() + 60 * 60 * 1000);

            // seed a couple of tokens for this user
            await rtRepo.save(
                rtRepo.create({
                    user: u,
                    expiresAt: inOneHour,
                }),
            );
            await rtRepo.save(
                rtRepo.create({
                    user: u,
                    expiresAt: inOneHour,
                }),
            );

            const before = await rtRepo.count({ where: { user: { id: u.id } } });
            expect(before).toBe(2);

            // delete the user
            const res = await request(app)
                .delete(route(u.id))
                .set("Cookie", [`accessToken=${token}`])
                .send();
            expect(res.statusCode).toBe(204);

            // tokens should be gone due to FK CASCADE
            const after = await rtRepo.count({ where: { user: { id: u.id } } });
            expect(after).toBe(0);
        });
    });

    describe.skip("Policy: self-delete (choose your behavior)", () => {
        it("either 204 (allowed) or 403 (forbidden) when admin deletes themselves", async () => {
            const { admin, token } = await seedAdminForAuth();

            const res = await request(app)
                .delete(route(admin.id))
                .set("Cookie", [`accessToken=${token}`])
                .send();
            expect([204, 403]).toContain(res.statusCode);

            // If you forbid self-delete, assert that user still exists:
            // const repo = connection.getRepository(User);
            // const stillExists = await repo.findOneBy({ id: admin.id });
            // if (res.statusCode === 403) expect(stillExists).not.toBeNull();
        });
    });
});
