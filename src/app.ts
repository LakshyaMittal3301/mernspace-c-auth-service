import "reflect-metadata";
import express, { Request, Response, NextFunction } from "express";
import { HttpError } from "http-errors";
import logger from "./config/logger";
import authRouter from "./routes/auth";
import cookieParser from "cookie-parser";
import path from "path";
import tenantRouter from "./routes/tenant";
import adminUserRouter from "./routes/admin.users";

const app = express();

const publicDir = path.join(__dirname, "..", "public");

// Serve ONLY the .well-known directory
app.use(
    "/.well-known",
    express.static(path.join(publicDir, ".well-known"), {
        dotfiles: "allow",
        immutable: true,
        maxAge: "1d",
        index: false,
    }),
);

app.use(express.json());
app.use(cookieParser());

app.get("/ping", async (req, res) => {
    res.send("PONG (AUTH Service)");
});

app.use("/auth", authRouter);
app.use("/tenants", tenantRouter);
app.use("/admin", adminUserRouter);

app.use((err: HttpError, req: Request, res: Response, next: NextFunction) => {
    logger.error(err.message);
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
        errors: [
            {
                type: err.name,
                msg: err.message,
                path: "",
                location: "",
            },
        ],
    });
});
export default app;
