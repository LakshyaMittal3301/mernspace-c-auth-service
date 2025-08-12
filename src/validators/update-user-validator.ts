import { checkSchema } from "express-validator";

export default checkSchema({
    // email is allowed (admin can change); just validate format + normalize
    email: {
        optional: true,
        trim: true,
        isEmail: { errorMessage: "Valid email required" },
        normalizeEmail: true,
    },
    firstName: {
        optional: true,
        trim: true,
        notEmpty: { errorMessage: "firstName cannot be empty when provided" },
    },
    lastName: {
        optional: true,
        trim: true,
        notEmpty: { errorMessage: "lastName cannot be empty when provided" },
    },
    password: {
        optional: true,
        isLength: { options: { min: 8 }, errorMessage: "password must be at least 8 characters" },
    },
    // tenantId remains optional (only relevant for managers);
    // pure type/shape validation here; existence is checked in the service.
    tenantId: {
        optional: { options: { nullable: true } },
        custom: {
            options: (v) =>
                v === null ||
                v === undefined ||
                (typeof v === "string" && /^\s*\d+\s*$/.test(v)) ||
                Number.isInteger(v),
            errorMessage: "tenantId must be an integer or null",
        },
        customSanitizer: {
            options: (value) => {
                if (value === undefined) return undefined; // preserve undefined
                if (value === null) return null; // keep explicit null
                return parseInt(String(value).trim(), 10); // coerce "123" → 123
            },
        },
    },
    // role updates are NOT allowed now — reject if present
    role: {
        optional: true,
        custom: { options: () => false },
        errorMessage: "Do not send 'role'",
    },
});
