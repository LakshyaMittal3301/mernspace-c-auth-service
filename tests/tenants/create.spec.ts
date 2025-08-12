import { DataSource } from "typeorm";
import { AppDataSource } from "../../src/config/data-source";
import { createJWKSMock, JWKSMock } from "mock-jwks";
import request from "supertest";
import app from "../../src/app";
import { Tenant } from "../../src/entity/Tenant";
import { User } from "../../src/entity/User";
import { createUser } from "../utils";
import { Roles } from "../../src/constants";

describe("POST /tenants", () => {
    const createTenantRoute = "/tenants";
    let connection: DataSource;
    let jwks: JWKSMock;
    let stopJwksMock: Function;
    let adminUser: User;
    let adminUserAccessToken: string;

    beforeAll(async () => {
        connection = await AppDataSource.initialize();
        jwks = createJWKSMock("http://localhost:5501");
    });

    beforeEach(async () => {
        stopJwksMock = jwks.start();
        await connection.dropDatabase();
        await connection.synchronize();

        const adminData = {
            firstName: "lakshya",
            lastName: "mittal",
            email: "lakshya@gmail.com",
            password: "password@123",
            role: Roles.ADMIN,
        };

        adminUser = await createUser(connection, adminData);
        adminUserAccessToken = jwks.token({
            sub: String(adminUser.id),
            role: adminUser.role,
        });
    });

    afterEach(async () => {
        stopJwksMock();
    });

    afterAll(async () => {
        await connection.destroy();
    });

    describe("All fields are present", () => {
        const tenantData = {
            name: "Tenant name",
            address: "Tenant address",
        };

        it("should return a 201 status code", async () => {
            const response = await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${adminUserAccessToken}`])
                .send(tenantData);

            expect(response.statusCode).toBe(201);
        });

        it("should create a tenant in the database", async () => {
            await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${adminUserAccessToken}`])
                .send(tenantData);

            const tenantRepo = connection.getRepository(Tenant);
            const tenants = await tenantRepo.find();

            expect(tenants).toHaveLength(1);
            expect(tenants[0].name).toBe(tenantData.name);
            expect(tenants[0].address).toBe(tenantData.address);
        });

        it("should return 401 if user is not authenticated", async () => {
            const response = await request(app).post(createTenantRoute).send(tenantData);

            expect(response.statusCode).toBe(401);

            const tenantRepo = connection.getRepository(Tenant);
            const tenants = await tenantRepo.find();

            expect(tenants).toHaveLength(0);
        });

        it("should return 403 if user is not admin", async () => {
            const managerData = {
                firstName: "lakshya",
                lastName: "mittal",
                email: "lakshya1@gmail.com",
                password: "password@123",
                role: Roles.MANAGER,
            };

            const managerUser = await createUser(connection, managerData);
            const managerAccessToken = jwks.token({
                sub: String(managerUser.id),
                role: managerUser.role,
            });

            const response = await request(app)
                .post(createTenantRoute)
                .set("Cookie", [`accessToken=${managerAccessToken}`])
                .send(tenantData);

            expect(response.statusCode).toBe(403);

            const tenantRepo = connection.getRepository(Tenant);
            const tenants = await tenantRepo.find();

            expect(tenants).toHaveLength(0);
        });
    });
});
