import { checkSchema } from "express-validator";
export default checkSchema({
    email: { isEmail: true, normalizeEmail: true, notEmpty: true },
    firstName: { trim: true, notEmpty: true },
    lastName: { trim: true, notEmpty: true },
    password: { isLength: { options: { min: 8 } }, notEmpty: true },
    tenantId: { trim: true, isInt: true, toInt: true, notEmpty: true },
    // forbid 'role'
    role: { optional: true, custom: { options: () => false }, errorMessage: "Do not send 'role'" },
});
