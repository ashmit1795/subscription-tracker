import express from "express";

import userRouter from "./routes/user.routes.js";
import subscriptionsRouter from "./routes/subscriptions.routes.js";
import authRouter from "./routes/auth.routes.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import cookieParser from "cookie-parser";
import { NODE_ENV } from "./config/env.js";
import ApiError from "./utils/ApiError.js";
import arcjetMiddleware from "./middlewares/arcjet.middleware.js";
import workflowRouter from "./routes/workflow.routes.js";

export const app = express();

// Middleware

// Parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser for handling cookies
app.use(cookieParser());

// Arcjet middleware for security and rate limiting
app.use(arcjetMiddleware);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/subscriptions", subscriptionsRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/workflows", workflowRouter);

if (NODE_ENV === "development") {
    app.get("/error", () => {
        throw new ApiError(500, "This is a test error for development environment");
    });
}

app.get("/", (req, res) => {
    res.send({
        title: "Subscription Tracker API",
        description: "API for managing subscriptions and user accounts",
        version: "1.0.0",
    });
});

app.use(errorMiddleware);
