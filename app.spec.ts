import { calculateDiscount } from "./src/utils";
import request from "supertest";
import app from "./src/app";

describe("App", () => {
    it("should return correct discount amount", () => {
        const discount = calculateDiscount(100, 10);

        expect(discount).toBe(10);
    });

    it("should return 200 status code", async () => {
        const response = await request(app).get("/ping").send();

        expect(response.statusCode).toBe(200);
    });
});
