import aj from "../config/arcjet.js";
import ApiError from "../utils/ApiError.js";
import debug from "debug";

const arcjetDebug = debug("subtracker:arcjet:middleware");

const arcjetMiddleware = async (req, res, next) => {
    try {
        const decision = await aj.protect(req, { requested: 1 });

		if (decision.isDenied()) {
			if (decision.reason.isRateLimit()) {
				throw new ApiError(429, "Rate limit exceeded. Please try again later.");
			}

			if (decision.reason.isBot()) {
				throw new ApiError(403, "Access denied. Bot traffic is not allowed.");
			}

			throw new ApiError(403, "Access denied.");
		}

		next();
    } catch (error) {
        arcjetDebug("Arcjet middleware error:", error);
        next(error);
    }
};

export default arcjetMiddleware;
