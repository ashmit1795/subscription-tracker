// * import { serve } from "@upstash/workflow/express"; This might not work, because upstash is written in CommonJS, not ESM.
import { createRequire } from "module";
import Subscription from "../models/subscription.model.js";
import dayjs from "dayjs";
const require = createRequire(import.meta.url);
import debug from "debug";
import sendReminderEmail from "../utils/sendEmail.js";
import { Client } from "@upstash/workflow";
import { QSTASH_TOKEN, SERVER_URL } from "../config/env.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import workflowClient from "../config/upstash.js";

const workflowDebug = debug("subtracker:controller:workflow");

const { serve } = require("@upstash/workflow/express");
const qstash = new Client({ token: QSTASH_TOKEN });

const REMINDERS = [7, 5, 2, 1, 0]; // Days before renewal to send reminders

const sendReminders = serve(async (context) => {
	const { subscriptionId } = context.requestPayload;
	const subscription = await fetchSubscription(context, subscriptionId);

	// If no subscription found or not active, stop the workflow
	if (!subscription || subscription.status !== "active") return;

	// Get current time within a workflow step to ensure determinism
	const currentTime = await getCurrentTime(context);
	const renewalDate = dayjs(subscription.renewalDate);

	// Check if the renewal date is in the past
	if (renewalDate.isBefore(dayjs(currentTime))) {
		workflowDebug(`Renewal date has passed for subscription ${subscriptionId}. Stopping workflow.`);
		return;
	}

	for (const daysBefore of REMINDERS) {
		const reminderDate = renewalDate.subtract(daysBefore, "day");

		// Use the deterministic current time for comparison
		if (reminderDate.isAfter(dayjs(currentTime))) {
			await sleepUntilReminder(context, `${daysBefore} days before reminder`, reminderDate);

			// After sleep, re-fetch subscription and check if it's still active
			const subscriptionAfterSleep = await fetchSubscription(context, subscriptionId);
			if (!subscriptionAfterSleep || subscriptionAfterSleep.status !== "active") return;

			// Get current time again after sleep
			const currentTimeAfterSleep = await getCurrentTime(context);

			// Check if the renewal date is same as the reminder date
			if (renewalDate.isSame(reminderDate, "day")) {
				await processRenewal(context, `${daysBefore} days before reminder`, subscriptionAfterSleep);
				return; // Stop further reminders if renewal is processed
			}

			// Otherwise, check if the current date is the same as the reminder date, then trigger the reminder
			if (dayjs(currentTimeAfterSleep).isSame(reminderDate, "day")) {
				await triggerReminder(context, `${daysBefore} days before reminder`, subscriptionAfterSleep);
			}
		} else if (dayjs(currentTime).isSame(reminderDate, "day")) {
			// If the reminder date is today, send the reminder immediately
			await triggerReminder(context, `${daysBefore} days before reminder`, subscription);
		}
	}
});

// ! Get the status of a workflow run - admin only
const getWorkflowStatus = async (req, res, next) => {
	try {
		const workflowRunId = req.params.workflowRunId;
		if (!workflowRunId) {
			workflowDebug("Workflow Run ID is required");
			return res.status(400).json(new ApiError(400, "Workflow Run ID is required"));
		}

		const { runs } = await qstash.logs({
			workflowRunId: workflowRunId,
			count: 1,
		});
		if (!runs || runs.length === 0) {
			workflowDebug(`No runs found for Workflow Run ID: ${workflowRunId}`);
			return res.status(404).json(
				new ApiResponse(
					{
						workflowRunId: workflowRunId,
						status: "not_found",
					},
					"Workflow run not found",
					404
				)
			);
		}

		workflowDebug(`Workflow Run ID: ${workflowRunId}, Status: ${runs[0].workflowState}`);
		// Return the workflow run ID and its status
		return res.json({
			workflowRunId: workflowRunId,
			status: runs[0].workflowState, // e.g., RUN_STARTED, RUN_SUCCESS, RUN_CANCELLED
		});
	} catch (err) {
		next(err);
	}
};

// ! Cancel a specific workflow run - admin only
const cancelWorkflow = async (req, res, next) => {
	try {
		const workflowRunId = req.params.workflowRunId;
		if (!workflowRunId) {
			throw new ApiError(400, "Workflow Run ID is required");
		}

		const response = await qstash.cancel({ ids: workflowRunId });

		return res.status(200).json(new ApiResponse(response, "Workflow cancelled successfully", 200));
	} catch (err) {
		next(err);
	}
};

// ! Cancel all workflows - admin only
const cancelAllWorkflows = async (req, res, next) => {
	try {
		const result = await qstash.cancel({ all: true });
		res.json(new ApiResponse(result, "All workflows cancelled successfully", 200));
	} catch (err) {
		next(err);
	}
};

// ! List all running workflows - admin only
const listRunningWorkflows = async (req, res, next) => {
	try {
		const allRuns = [];
		let cursor = undefined;

		do {
			const { runs, cursor: nextCursor } = await qstash.logs({
				state: "RUN_STARTED",
				count: 100,
				cursor,
			});
			allRuns.push(...runs);
			cursor = nextCursor;
		} while (cursor);

		const simplified = allRuns.map((run) => ({
			workflowRunId: run.workflowRunId,
			workflowUrl: run.workflowUrl,
			createdAt: new Date(run.workflowRunCreatedAt).toISOString(),
		}));

		return res.json(new ApiResponse({ details: simplified, count: simplified.length }, "Running workflows fetched", 200));
	} catch (err) {
		next(err);
	}
};

const fetchSubscription = async (context, subscriptionId) => {
	return await context.run("Get Subscription", async () => {
		return await Subscription.findById(subscriptionId).populate("user", "name email");
	});
};

const getCurrentTime = async (context) => {
	return await context.run("Get Current Time", async () => {
		return new Date();
	});
};

const sleepUntilReminder = async (context, label, date) => {
	workflowDebug(`Sleeping until ${label}. Next reminder at ${date}`);
	return await context.sleepUntil(label, date.toDate());
};

const triggerReminder = async (context, label, subscription) => {
	return await context.run(label, async () => {
		workflowDebug(`Triggering ${label}`);
		// Send Email
		await sendReminderEmail({
			to: subscription.user.email,
			type: label,
			subscription: subscription,
		});
	});
};

const processRenewal = async (context, label, subscription) => {
	return await context.run(label, async () => {
		workflowDebug(`Processing renewal for subscription ${subscription._id}. Updating the subscription immediately.`);
		const subscriptionForRenewal = await Subscription.findById(subscription._id).populate("user", "name email");

		subscriptionForRenewal.status = "active";
		subscriptionForRenewal.workflowId = null;
		const renewalDate = dayjs(subscriptionForRenewal.renewalDate);
		
		if (subscriptionForRenewal.frequency === "monthly") {
			subscriptionForRenewal.renewalDate = renewalDate.add(1, "month").toDate();
		} else if (subscriptionForRenewal.frequency === "yearly") {
			subscriptionForRenewal.renewalDate = renewalDate.add(1, "year").toDate();
		} else if (subscriptionForRenewal.frequency === "weekly") {
			subscriptionForRenewal.renewalDate = renewalDate.add(1, "week").toDate();
		} else if (subscriptionForRenewal.frequency === "daily") {
			subscriptionForRenewal.renewalDate = renewalDate.add(1, "day").toDate();
		} else {
			workflowDebug(`Unsupported frequency: ${subscriptionForRenewal.frequency}`);
			throw new ApiError(400, `Unsupported frequency: ${subscriptionForRenewal.frequency}`);
		}

		await subscriptionForRenewal.save({ validateBeforeSave: false });

		const { workflowRunId } = await workflowClient.trigger({
			url: `${SERVER_URL}/api/v1/workflows/subscription/reminder`,
			body: {
				subscriptionId: subscriptionForRenewal._id,
			},
			headers: {
				"content-type": "application/json",
			},
			retries: 0,
		});

		workflowDebug(`Renewal Workflow triggered for subscription ${subscriptionForRenewal._id} with run ID: ${workflowRunId}`);
		subscriptionForRenewal.workflowId = workflowRunId; // Store the workflow run ID in the subscription
		await subscriptionForRenewal.save({ validateBeforeSave: false });
	});
}

export { sendReminders, getWorkflowStatus, cancelWorkflow, cancelAllWorkflows, listRunningWorkflows };
