import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import ApiError from "../utils/ApiError.js";
import debug from "debug";
import User from "../models/user.model.js";

const authDebug = debug("subtracker:middleware:authorize");

export const authorize = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.startsWith("Bearer") && req.headers.authorization.split(" ")[1];

        if(!token) {
            authDebug("No token provided");
            throw new ApiError(401, "Unauthorized access");
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.userId).select("-password -__v");
        if (!user) {
            authDebug("User not found");
            throw new ApiError(404, "User not found");
        }

        req.user = user;
        authDebug("User authorized successfully", { userId: user._id, role: user.role });

        next();
    } catch (error) {
        authDebug("Authorization error: %O", error);
        next(error instanceof ApiError ? error : new ApiError(401, "Unauthorized access"));
    }
}

export const authorizeRoles = (...roles) => {
	return (req, res, next) => {
		if (!roles.includes(req.user.role)) {
			return next(
				new ApiError(403, "You are not allowed to access this resource")
			);
		}
		next();
	};
};

