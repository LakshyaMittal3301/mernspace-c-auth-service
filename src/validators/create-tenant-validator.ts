import { checkSchema } from "express-validator";

export default checkSchema({
    name: {
        notEmpty: true,
        errorMessage: "First Name is required",
        isLength: {
            options: { max: 100 },
            errorMessage: "Name can have a max length of 100 chars",
        },
    },
    address: {
        notEmpty: true,
        errorMessage: "Address is required",
        isLength: {
            options: { max: 255 },
            errorMessage: "Address can have a max length of 255 chars",
        },
    },
});
