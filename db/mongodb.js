import mongoose from "mongoose";
import { DB_URI, NODE_ENV } from "../config/env.js";
import { DB_NAME } from "../constants.js";
import debug from "debug";

const dbDebug = debug("subtracker:database:mongodb");


if (!DB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable inside .env.<development/production>.local ");
}

const connectToDatabase = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${DB_URI}/${DB_NAME}`);
        dbDebug(`Connected to MongoDB: ${connectionInstance.connection.host} in ${NODE_ENV} mode`);
    } catch (error) {
        dbDebug("Error connecting to database:", error);
        process.exit(1);
    }
}

export default connectToDatabase;