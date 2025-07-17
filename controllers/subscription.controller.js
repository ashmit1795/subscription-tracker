import Subscription from "../models/subscription.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import debug from "debug";
import User from "../models/user.model.js";
import workflowClient from "../config/upstash.js";
import { SERVER_URL } from "../config/env.js";
import dayjs from "dayjs";

const subscriptionDebug = debug("subtracker:controller:subscription");

// Create a new subscription
const createSubscription = async (req, res, next) => {
    const { name, price, currency, frequency, category, paymentMethod, startDate } = req.body;

    subscriptionDebug("Create Subscription request received", { name, price, currency, frequency, category, paymentMethod, startDate });
    
    try {
		const subscription = await Subscription.create({
			name,
			price,
			currency,
			frequency,
			category,
			paymentMethod,
			startDate: startDate, // Ensure startDate is parsed correctly
			user: req.user._id, // Associate subscription with the logged-in user
		});

		if (!subscription) {
			subscriptionDebug("Subscription creation failed");
			throw new ApiError(504, "Subscription creation failed");
		}

        const createdSubscription = await Subscription.findById(subscription._id).select("-updatedAt -__v").populate("user", "-password -__v -createdAt -updatedAt -role");
		// Trigger the workflow to send a reminder for the subscription
		createdSubscription.workflowId = await createWorkflowForSubscription(createdSubscription._id); // Store the workflow run ID in the subscription
        await createdSubscription.save({ validateBeforeSave: false });

        subscriptionDebug("Subscription created successfully", { subscriptionId: subscription._id });
        
		// Return the created subscription with a success message
		return res
			.status(201)
			.json(
				new ApiResponse(
					createdSubscription,
					"Subscription created successfully",
					201
				)
			);
	} catch (error) {
		subscriptionDebug("Error creating subscription: %O", error);
		next(error); // Pass the error to the error middleware
	}
}

// ! Get all subscriptions, admin-only controller
const getAllSubscriptions = async (req, res, next) => {
    try {
        const subscriptions = await Subscription.find().select("-updatedAt -__v").populate("user", "-password -__v -createdAt -updatedAt -role");
        if (!subscriptions || subscriptions.length === 0) {
            return res.status(404).json(new ApiResponse(null, "No subscriptions found", 404));
        }

        // If subscriptions are found, return them with a success message
        return res.status(200).json(new ApiResponse(subscriptions, "Subscriptions retrieved successfully", 200));
    } catch (error) {
        subscriptionDebug("Error retrieving subscriptions: %O", error);
        next(error); // Pass the error to the error middleware
    }
};

// Get current user's subscriptions
const getCurrentUserSubscriptions = async (req, res, next) => {
    try {
        const userId = req.user._id;
        subscriptionDebug("Retrieving subscriptions for user", { userId });

        const subscriptions = await Subscription.find({ user: userId }).select("-updatedAt -__v").populate("user", "-password -__v -createdAt -updatedAt -role");
        if (!subscriptions || subscriptions.length === 0) {
            return res.status(404).json(new ApiResponse(null, "No subscriptions found for the current user", 404));
        }

        subscriptionDebug("Subscriptions retrieved successfully for user", { userId, count: subscriptions.length });
        return res.status(200).json(new ApiResponse({ subscriptions, subscriptionCount: subscriptions.length }, "Subscriptions retrieved successfully", 200));
    } catch (error) {
        subscriptionDebug("Error retrieving current user subscriptions: %O", error);
        next(error); // Pass the error to the error middleware
    }
}

// ! Get specific user's subscription, admin-only controller
const getSpecificUserSubscription = async (req, res, next) => { 
    try {
        const userId = req.params.id;

        subscriptionDebug("Retrieving subscriptions for specific user", { userId });
        if (!userId) {
            throw new ApiError(400, "User ID is required");
        }
        const user = await User.findById(userId).select("-password -__v -updatedAt");
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const subscriptions = await Subscription.find({ user: user._id }).select("-updatedAt -__v");
        if (!subscriptions || subscriptions.length === 0) {
            return res.status(404).json(new ApiResponse(null, "No subscriptions found for this user", 404));
        }

        return res.status(200).json(new ApiResponse({user, subscriptions, subscriptionCount: subscriptions.length }, "Subscriptions retrieved successfully", 200));
    } catch (error) {
        next(error);
    }
}

// Cancel a subscription
const cancelSubscription = async (req, res, next) => { 
    const subscriptionId = req.params.id;

    try {
        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription) {
            subscriptionDebug("Subscription not found", { subscriptionId });
            throw new ApiError(404, "Subscription not found");
        }

        subscription.status = "cancelled"; // Update the subscription status to canceled
        if (subscription.workflowId) {
			await cancelWorkflowById(subscription.workflowId); // Cancel the workflow
			subscription.workflowId = null; // Clear the workflow run ID as the subscription is being cancelled
        }
        
        await subscription.save({ validateBeforeSave: false }); // Save the updated subscription without validation
        subscriptionDebug("Subscription cancelled successfully", { subscriptionId });

        return res.status(200).json(new ApiResponse(subscription, "Subscription & Reminder cancelled successfully", 200));
    } catch (error) {
        subscriptionDebug("Error canceling subscription: %O", error);
        next(error); // Pass the error to the error middleware
    }
}

// Unsubscribe from a subscription
const unsubscribe = async (req, res, next) => {
	const subscriptionId = req.params.id;

	try {
		const subscription = await Subscription.findById(subscriptionId);
		if (!subscription) {
			throw new ApiError(404, "Subscription not found");
		}

		subscription.status = "inactive"; // Or "unsubscribed"
		subscription.renewalDate = null; // Immediate stop → no further renewals

		if (subscription.workflowId) {
			await workflowClient.cancel({ ids: subscription.workflowId });
			subscription.workflowId = null;
		}

		await subscription.save({ validateBeforeSave: false });

		return res
			.status(200)
			.json(
				new ApiResponse(
					subscription,
					"Unsubscribed successfully. Access revoked immediately.",
					200
				)
			);
	} catch (error) {
		next(error);
	}
}

// Resume a cancelled subscription
const resumeSubscription = async (req, res, next) => {
    const subscriptionId = req.params.id;
    const startDate = req.body.startDate; // Expecting startDate in the request body

    try {
		if (!startDate) {
			subscriptionDebug("Start date is required to resume subscription", {
				subscriptionId,
			});
			throw new ApiError(
				400,
				"Start date is required to resume subscription"
			);
		}

		const subscription = await Subscription.findById(subscriptionId);
		if (!subscription) {
			subscriptionDebug("Subscription not found", { subscriptionId });
			throw new ApiError(404, "Subscription not found");
		}

		if (subscription.status !== "cancelled") {
			subscriptionDebug("Subscription is not cancelled", {subscriptionId});
			throw new ApiError(400, "Subscription is not cancelled");
		}

		subscription.status = "active"; // Resume the subscription
		subscription.startDate = startDate; // Update the start date
		subscription.workflowId = null; // Defensive reset before creating a new one
        subscription.renewalDate = subscription.calculateRenewalDate(startDate); // Force recalculation by the pre-save hook

        // Check if the renewal date is in the past and set status to expired if so
        if (dayjs(subscription.renewalDate).isBefore(dayjs(), "day")) {
            subscription.status = "expired";
        }
        
        
		subscription.workflowId = await createWorkflowForSubscription(subscription._id); // Store the new workflow run ID in the subscription
		await subscription.save({ validateBeforeSave: true}); // Save the updated subscription with validation

		return res
			.status(200)
			.json(
				new ApiResponse(
					subscription,
					"Subscription resumed successfully",
					200
				)
			);
	} catch (error) {
        subscriptionDebug("Error resuming subscription: %O", error.message);
        next(error); // Pass the error to the error middleware
    }
}

// ! Delete a subscription, admin-only controller
const deleteSubscription = async (req, res, next) => { 
    try {
        const subscriptionId = req.params.id;
        subscriptionDebug("Deleting subscription", { subscriptionId });
        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription) {
            subscriptionDebug("Subscription not found", { subscriptionId });
            throw new ApiError(404, "Subscription not found");
        }
        // If the subscription has an associated workflow, cancel it
        if (subscription.workflowId) {
            await cancelWorkflowById(subscription.workflowId);
        }
        // Delete the subscription
        const deletedSubscription = await Subscription.deleteOne(subscription._id);

        return res
			.status(200)
			.json(
				new ApiResponse(
					deletedSubscription,
					"Subscription deleted successfully",
					200
				)
			);
    } catch (error) {
        subscriptionDebug("Error deleting subscription: %O", error);
        next(error); // Pass the error to the error middleware
    }
}

// Update a subscription
const updateSubscription = async (req, res, next) => { 
    const subscriptionId = req.params.id;
    const userId = req.user._id; // Assuming the user ID is in req.user
    const {
		name,
		price,
		currency,
		frequency,
		category,
		paymentMethod,
		startDate,
	} = req.body; // Destructure the fields you want to update from the request body

    try {
        const subscription = await Subscription.findById(subscriptionId);
        if (!subscription) {
            subscriptionDebug("Subscription not found", { subscriptionId });
            throw new ApiError(404, "Subscription not found");
        }

        // Check if the subscription belongs to the user or if the user is an admin
        if (!subscription.user.equals(userId) && req.user.role !== "admin") {
            subscriptionDebug("Unauthorized access to subscription", { subscriptionId, userId });
            throw new ApiError(403, "You do not have permission to access this subscription");
        }

        // Only active subscriptions can be updated
        if (subscription.status !== "active") {
            subscriptionDebug("Subscription is not active", { subscriptionId });
            throw new ApiError(400, "Only active subscriptions can be updated");
        }
        
        // Update the subscription fields
        if (name) subscription.name = name;
        if (price) subscription.price = price;
        if (currency) subscription.currency = currency;
        if (frequency) subscription.frequency = frequency;
        if (category) subscription.category = category;
        if (paymentMethod) subscription.paymentMethod = paymentMethod;
        if (startDate) {
            subscription.startDate = startDate; // Ensure startDate is parsed correctly
            subscription.renewalDate = subscription.calculateRenewalDate(startDate); // Recalculate renewal date
            
            if (dayjs(subscription.renewalDate).isBefore(dayjs(), "day")) {
				subscription.status = "expired";
			}
        }

        await cancelWorkflowById(subscription.workflowId); // Cancel the existing workflow if it exists
        subscription.workflowId = await createWorkflowForSubscription(subscription._id); // Create a new workflow for the updated subscription
        const updatedSubscription = await subscription.save({ validateBeforeSave: true }); // Save the updated subscription with validation

        return res
			.status(200)
			.json(
				new ApiResponse(
					updatedSubscription,
					"Subscription updated successfully",
					200
				)
			);

    } catch (error) {
        subscriptionDebug("Error updating subscription: %O", error);
        next(error); // Pass the error to the error middleware
    }

}

// Get upcoming renewals for the current user
const getUpcomingRenewals = async (req, res, next) => {
	try {
		const userId = req.user._id; // Assuming authenticated user is available here

		const today = dayjs().startOf("day");
		const next30Days = today.add(30, "day").endOf("day"); // Next 30 days window

		const upcomingRenewals = await Subscription.find({
			user: userId,
			renewalDate: { $gte: today.toDate(), $lte: next30Days.toDate() },
			status: "active",
		}).select("name renewalDate price").sort({ renewalDate: 1 });

		return res
			.status(200)
			.json(
				new ApiResponse(
					upcomingRenewals,
					"Upcoming renewals fetched successfully",
					200
				)
			);
	} catch (error) {
		next(error);
	}
};

// Get subscription details by ID
const getSubscriptionById = async (req, res, next) => {
    const subscriptionId = req.params.id;
    try {
        const subscription = await Subscription.findById(subscriptionId).select("-updatedAt -__v -workflowId");
        if (!subscription) {
            subscriptionDebug("Subscription not found", { subscriptionId });
            throw new ApiError(404, "Subscription not found");
        }

        if(!subscription.user.equals(req.user._id) && req.user.role !== "admin") {
            subscriptionDebug("Unauthorized access to subscription", { subscriptionId, userId: req.user._id });
            throw new ApiError(403, "You do not have permission to access this subscription");
        }

        return res
            .status(200).json(
                new ApiResponse(
                    subscription,
                    "Subscription details retrieved successfully",
                    200
                )
            );
    } catch (error) {
        subscriptionDebug("Error retrieving subscription by ID: %O", error.message);
        next(error); // Pass the error to the error middleware
    }
}

export {
	createSubscription,
	getAllSubscriptions,
	getCurrentUserSubscriptions,
	getSpecificUserSubscription,
	cancelSubscription,
	unsubscribe,
	resumeSubscription,
	deleteSubscription,
	updateSubscription,
	getUpcomingRenewals,
	getSubscriptionById,
};

// Utility function to cancel a workflow by ID
const cancelWorkflowById = async (workflowId) => {
    try {
        if (!workflowId) {
            throw new ApiError(400, "Workflow ID is required to cancel the workflow");
        }
        await workflowClient.cancel({ ids: workflowId });
        subscriptionDebug("Workflow cancelled successfully", { workflowId });
    } catch (error) {
        subscriptionDebug("Error cancelling workflow: %O", error);
        throw new ApiError(500, "Failed to cancel workflow");
    }
}

// Utility function to create a new workflow for a subscription
const createWorkflowForSubscription = async (subscriptionId) => {
    try {
        const { workflowRunId } = await workflowClient.trigger({
            url: `${SERVER_URL}/api/v1/workflows/subscription/reminder`,
            body: {
                subscriptionId: subscriptionId
            },
            headers: {
                'content-type': 'application/json',
            },
            retries: 0
        });
        return workflowRunId;
    } catch (error) {
        subscriptionDebug("Error creating workflow for subscription: %O", error);
        throw new ApiError(500, "Failed to create workflow for subscription");
    }
}