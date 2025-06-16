import debug from "debug";
import mongoose from "mongoose";
import User from "../models/user.model.js"
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { NODE_ENV } from "../config/env.js";

const authDebug = debug("subtracker:controller:auth");

const signUp = async (req, res, next) => { 
    // atomic transactions
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { email, name, password } = req.body;
        authDebug("SignUp request received", { email, name });

        // Validate email, name and password
        if(!email || !name || !password) {
            authDebug("Email, Name or Password is missing");
            throw new ApiError(400, "Email, Name or Password is missing");
        }

        // Check if user exists or not
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            authDebug("User already exists");
            throw new ApiError(409, "User already exists");
        }

        // Create a new user
        const newUser = await User.create([{ name, email, password }], { session });
        if (!newUser) {
            authDebug("User creation failed");
            throw new ApiError(500, "User creation failed");
        }

        await session.commitTransaction();
        session.endSession(); 

        authDebug("User created successfully");
        res.status(201)
            .json(new ApiResponse(newUser[0], "User created successfully", 201));   
    } catch (error) {
        await session.abortTransaction();
        next(error); // Pass the error to the error middleware
    }
}

const signIn = async (req, res, next) => { 
    const { email, password } = req.body;

    try {
		// Validate email and password
		if (!email || !password) {
			authDebug("Email or Password is missing");
			throw new ApiError(400, "Email or Password is missing");
		}

		// Check if user exists or not
		const existingUser = await User.findOne({ email });
		if (!existingUser) {
			authDebug("User does not exist");
			throw new ApiError(404, "User does not exist");
		}

		// Check if password is valid
		// Note: comparePassword is an instance method defined in the User model
		const isPasswordValid = await existingUser.comparePassword(password);
		if (!isPasswordValid) {
			authDebug("Invalid password");
			throw new ApiError(401, "Invalid password");
		}

		// Generate JWT token
		const token = existingUser.generateToken();
		if (!token) {
			authDebug("Token generation failed");
			throw new ApiError(500, "Token generation failed");
		}

		const options = {
			httpOnly: true,
			secure: NODE_ENV === "production", // Set to true in production
        };
        
		res.status(200)
			.cookie("token", token, options)
			.json(
				new ApiResponse(
					{ user: existingUser },
					"User signed in successfully",
					200
				)
			);
	} catch (error) {
		next(error); // Pass the error to the error middleware
	}
}

const signOut = async (req, res, next) => {
	try {
		const user = req.user; // Assuming user is set by an authentication middleware
		if (!user) {
			authDebug("User not authenticated");
			throw new ApiError(401, "User not authenticated");
		}
		res.status(200)
			.clearCookie("token")
			.json(new ApiResponse(null, "User signed out successfully", 200));
	} catch (error) {
		authDebug("Error during sign out", error);
		next(error); // Pass the error to the error middleware
	}
}

export { signIn, signUp, signOut };