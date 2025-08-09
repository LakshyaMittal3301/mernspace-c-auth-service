import { checkSchema } from "express-validator";

export default checkSchema({
    email: {
        trim: true,
        notEmpty: true,
        isEmail: true,
        errorMessage: "Email is required",
    },
    password: {
        notEmpty: true,
        errorMessage: "Password is required",
    },
});
