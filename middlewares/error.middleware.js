// import debug from "debug";

// const errorDebug = debug("subtracker:middleware:error");

// const errorMiddleware = (err, req, res, next) => {
//     try {
//         let error = { ...err };

//         error.message = err.message;

//         errorDebug(err);

//         // Mongoose bad object ID error
//         if (err.name === "CastError") {
//             const message = `Resource not found. Invalid: ${err.path}`;
//             error = new Error(message);
//             error.statusCode = 404;
//         }

//         // Mongoose duplicate key error
//         if (err.code === 11000) {
//             const message = `Duplicate field value entered: ${Object.keys(err.keyValue).join(", ")}`;
//             error = new Error(message);
//             error.statusCode = 400;
//         }

//         // Mongoose validation error
//         if (err.name === "ValidationError") {
//             const message = Object.values(err.errors).map((val) => val.message).join(", ");
//             error = new Error(message);
//             error.statusCode = 400;
//         }

//         res.status(error.statusCode || 500).json({
//             success: false,
//             error: error.message || "Server Error",
//         });

//     } catch (error) {
//         next(error);
//     }
// }

// export default errorMiddleware;

import ApiError from "../utils/ApiError.js"; 

const errorMiddleware = (err, req, res, next) => {
	try {
		// Default values
		let statusCode = err.statusCode || 500;
		let message = err.message || "Internal Server Error";
		let errors = [];
		let data = null;

		// If it's an instance of ApiError, retain its properties
		if (err instanceof ApiError) {
			statusCode = err.statusCode;
			message = err.message;
			errors = err.errors;
			data = err.data;
		}

		// Mongoose bad object ID error
		else if (err.name === "CastError") {
			statusCode = 404;
			message = `Resource not found. Invalid: ${err.path}`;
		}

		// Mongoose duplicate key error
		else if (err.code === 11000) {
			statusCode = 400;
			message = `Duplicate field value entered: ${Object.keys(err.keyValue).join(", ")}`;
		}

		// Mongoose validation error
		else if (err.name === "ValidationError") {
			statusCode = 400;
			message = Object.values(err.errors)
				.map((val) => val.message)
				.join(", ");
		}

		res.status(statusCode).json({
			success: false,
			message,
			errors,
			data,
		});
	} catch (error) {
		// If errorMiddleware itself fails, use next to pass error further
		next(error);
	}
};

export default errorMiddleware;
