import { checkSchema } from "express-validator";
export default checkSchema({
    email: { isEmail: true, normalizeEmail: true, notEmpty: true },
    firstName: { trim: true, notEmpty: true },
    lastName: { trim: true, notEmpty: true },
    password: { isLength: { options: { min: 8 } }, notEmpty: true },
    // forbid 'role' & 'tenantId'
    role: { optional: true, custom: { options: () => false }, errorMessage: "Do not send 'role'" },
    tenantId: { optional: true, custom: { options: () => false }, errorMessage: "Do not send 'tenantId'" },
});
