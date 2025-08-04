import express from "express";

const app = express();

app.get("/ping", (req, res) => {
    res.send("PONG (AUTH Service)");
});

export default app;
