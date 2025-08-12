import { checkSchema } from "express-validator";

export default checkSchema({
    name: {
        optional: true,
        notEmpty: { errorMessage: "Name cannot be empty" },
        isLength: {
            options: { max: 100 },
            errorMessage: "Name can have a max length of 100 chars",
        },
        trim: true,
    },
    address: {
        optional: true,
        notEmpty: { errorMessage: "Address is required" },
        isLength: {
            options: { max: 255 },
            errorMessage: "Address can have a max length of 255 chars",
        },
        trim: true,
    },
});
