import { checkSchema } from "express-validator";

export default checkSchema({
    email: {
        notEmpty: true,
        isEmail: true,
        errorMessage: "Email is required",
    },
    firstName: {
        notEmpty: true,
        errorMessage: "First Name is required",
    },
    lastName: {
        notEmpty: true,
        errorMessage: "Last Name is required",
    },
    password: {
        notEmpty: true,
        errorMessage: "Password is required",
    },
});
