import connectToDatabase from "./db/mongodb.js";
import { app } from "./app.js";
import { PORT } from "./config/env.js";
import debug from "debug";

const indexDebug = debug("subtracker:index");

connectToDatabase().then(() => {
    console.log("start");
    app.on("error", (error) => {
        indexDebug("Error:", error);
    });
    app.listen(PORT, () => {
        indexDebug(`Subscription Tracker API is running on http://localhost:${PORT}`);
    });
}).catch((error) => {
    indexDebug("Database connection failed:", error);
});