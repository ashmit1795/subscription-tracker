import mongoose from "mongoose";
import dayjs from "dayjs";
import ApiError from "../utils/ApiError.js";

const subscriptionSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Subscription Name is required"],
			trim: true,
			minLength: 2,
			maxLength: 100,
		},
		price: {
			type: Number,
			required: [true, "Subscription Price is required"],
			min: [0, "Price must be greater than 0"],
		},
		currency: {
			type: String,
			required: [true, "Currency is required"],
			trim: true,
			enum: ["USD", "EUR", "GBP", "INR", "JPY"], // Add more currencies as needed
			default: "INR",
		},
		frequency: {
			type: String,
			required: [true, "Subscription Frequency is required"],
			enum: ["monthly", "yearly", "daily", "weekly"], // Add more frequencies as needed
		},
		category: {
			type: String,
			required: [true, "Subscription Category is required"],
			trim: true,
			enum: [
				"basic",
				"premium",
				"enterprise",
				"sports",
				"news",
				"education",
				"recharge",
				"others",
				"lifestyle",
				"entertainment",
				"gaming",
			], // Add more categories as needed
		},
		paymentMethod: {
			type: String,
			required: [true, "Payment Method is required"],
			trim: true,
		},
		status: {
			type: String,
			required: [true, "Subscription Status is required"],
			enum: ["active", "inactive", "cancelled", "expired"], // Add more statuses as needed
			default: "active",
		},
		startDate: {
			type: Date,
			required: [true, "Subscription Start Date is required"],
			validate: {
				validator: (value) => {
					return value <= new Date();
				},
				message: "Start date cannot be in the future",
			},
		},
		renewalDate: {
			type: Date,
			validate: {
				validator: function(value) {
					return value > this.startDate;
				},
				message: "Renewal date must be after the start date",
			},
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User ID is required"],
            index: true,
		},
		workflowId: {
			type: String,
			default: null,
		}
	},
	{ timestamps: true }
);


subscriptionSchema.pre("save", function (next) {

	if (!this.renewalDate) {
		this.renewalDate = this.calculateRenewalDate(this.startDate);
	}

	// Check if renewalDate is in the past
	if (dayjs(this.renewalDate).isBefore(dayjs(), "day")) {
		this.status = "expired";
	}

	next();
});

subscriptionSchema.methods.calculateRenewalDate = function (startDateParam) {
	const startDate = dayjs(startDateParam);
	const renewalFrequency = {
		monthly: 1, // months
		yearly: 1, // years
		daily: 1, // days
		weekly: 1, // weeks
	};

	if (this.frequency === "monthly") {
		return startDate.add(renewalFrequency.monthly, "month").toDate();
	} else if (this.frequency === "yearly") {
		return startDate.add(renewalFrequency.yearly, "year").toDate();
	} else if (this.frequency === "weekly") {
		return startDate.add(renewalFrequency.weekly, "week").toDate();
	} else if (this.frequency === "daily") {
		return startDate.add(renewalFrequency.daily, "day").toDate();
	} else {
		throw new ApiError("Invalid frequency type");
	}
}

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;