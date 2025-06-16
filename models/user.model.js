/* eslint-disable no-useless-escape */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/env.js";

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, "User Name is required"],
		trim: true,
		minLength: 2,
		maxLength: 50,
	},
	email: {
		type: String,
		required: [true, "User Email is required"],
		unique: true,
		trim: true,
		lowercase: true,
		match: [
			/\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b/gi,
			"Please fill a valid email address",
		],
	},
	password: {
		type: String,
        required: [true, "User Password is required"],
        minLength:6,
	},
	role: {
		type: String,
		enum: ["user", "admin"],
		default: "user",
	},
}, {timestamps: true});

userSchema.pre("save", async function (next) {
	if (this.isModified("password")) {
		// Hash the password before saving it to the database
		const salt = await bcrypt.genSalt(10);
		this.password = await bcrypt.hash(this.password, salt);
	}
	next();
});

userSchema.methods.comparePassword = async function (password) {
	return await bcrypt.compare(password, this.password);
}

userSchema.methods.generateToken = function () {
	return jwt.sign({ userId: this._id, role: this.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

const User = mongoose.model("User", userSchema);

export default User;
