import User from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import debug from "debug";


const userDebug = debug("subtracker:controller:user");

const getUsers = async (req, res, next) => { 
    try {
        const users = await User.find().select("-password -__v");
        if (!users || users.length === 0) {
            return res.status(404).json(new ApiResponse(null, "No users found", 404));
        }

        // If users are found, return them with a success message
        return res.status(200).json(new ApiResponse(users, "Users retrieved successfully", 200));
    } catch (error) {
        userDebug("Error retrieving users: %O", error);
        next(error); // Pass the error to the error middleware
    }
}

const getUserById = async (req, res, next) => { 
    try {
        const userId = req.params.id;

        // Validate userId
        if (!userId) {
            throw new ApiError(400, "User ID is required");
        }

        const user = await User.findById(userId).select("-password -__v");
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        // If user is found, return it with a success message
        return res.status(200).json(new ApiResponse(user, "User retrieved successfully", 200));
    } catch (error) {
        userDebug("Error retrieving user by ID: %O", error);
        next(error); // Pass the error to the error middleware
    }
}

const updateUser = async (req, res, next) => {
    try {
        const userId = req.user._id; // Assuming the user ID is in req.user
        const { name } = req.body;

        // Validate updateData
        if (!name) {
            throw new ApiError(400, "No data provided for update");
        }

        const updatedUser = await User.findByIdAndUpdate(userId, { name }, { new: true }).select("-password -__v");
        if (!updatedUser) {
            throw new ApiError(404, "User not found");
        }

        // If user is updated successfully, return it with a success message
        return res.status(200).json(new ApiResponse(updatedUser, "User updated successfully", 200));
    } catch (error) {
        userDebug("Error updating user: %O", error);
        next(error); // Pass the error to the error middleware
    }
}

const deleteUser = async (req, res, next) => { 
    try {
        const userId = req.params.id;

        // Validate userId
        if (!userId) {
            throw new ApiError(400, "User ID is required");
        }

        const deletedUser = await User.findByIdAndDelete(userId);
        if (!deletedUser) {
            throw new ApiError(404, "User not found");
        }

        // If user is deleted successfully, return a success message
        return res.status(200).json(new ApiResponse(null, "User deleted successfully", 200));
    } catch (error) {
        userDebug("Error deleting user: %O", error);
        next(error); // Pass the error to the error middleware
    }
}

export {getUsers, getUserById, updateUser, deleteUser};