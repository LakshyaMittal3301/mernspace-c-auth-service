import "reflect-metadata";
import express, { Request, Response, NextFunction } from "express";
import { HttpError } from "http-errors";
import logger from "./config/logger";
import authRouter from "./routes/auth";

const app = express();
app.use(express.json());

app.get("/ping", async (req, res) => {
    res.send("PONG (AUTH Service)");
});

app.use("/auth", authRouter);

app.use((err: HttpError, req: Request, res: Response, next: NextFunction) => {
    logger.error(err.message);
    res.status(err.statusCode).json({
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
