import { checkSchema } from "express-validator";

const listUsersValidator = checkSchema(
    {
        page: {
            optional: true,
            isInt: { options: { min: 1 } },
            toInt: true,
            errorMessage: "page must be an integer >= 1",
        },
        limit: {
            optional: true,
            isInt: { options: { min: 1, max: 100 } },
            toInt: true,
            errorMessage: "limit must be an integer between 1 and 100",
        },
        sort: {
            optional: true,
            toLowerCase: true,
            isIn: { options: [["id", "createdAt"]] },
            errorMessage: "sort must be one of: id, createdAt",
        },
        order: {
            optional: true,
            toLowerCase: true,
            isIn: { options: [["asc", "desc"]] },
            errorMessage: "order must be of: asc, desc",
        },
        q: {
            optional: true,
            isString: true,
            isLength: { options: { max: 200 } },
            trim: true,
            customSanitizer: {
                options: (v: string) => v.replace(/\s+/g, " ").replace(/[\u0000-\u001F\u007F]/g, ""), // collapse spaces & drop control chars
            },
            errorMessage: "q must be a string up to 200 characters",
        },
        role: {
            optional: true,
            toLowerCase: true,
            isIn: { options: [["admin", "manager", "customer"]] },
            errorMessage: "role must be one of: admin, manager, customer",
        },
    },
    ["query"],
);

export default listUsersValidator;
