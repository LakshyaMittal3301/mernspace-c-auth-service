import request from "supertest";
import app from "../../src/app";

describe("POST /auth/register", () => {
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
    });
    describe("happy path", () => {});
});
