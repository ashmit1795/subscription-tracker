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

	// Fetch subscription at the beginning of workflow
	const subscription = await fetchSubscription(context, subscriptionId);

	// If no subscription found or not active, stop the workflow
	if (!subscription || subscription.status !== "active") {
		workflowDebug(
			`Subscription ${subscriptionId} not found or not active. Stopping workflow.`
		);
		return;
	}

	const renewalDate = dayjs(subscription.renewalDate);
	const now = dayjs();

	// Check if the renewal date is in the past
	if (renewalDate.isBefore(now, "day")) {
		workflowDebug(`Renewal date has passed for subscription ${subscriptionId}. Stopping workflow.`);
		return;
	}

	workflowDebug(
		`Starting reminder workflow for subscription ${subscriptionId}, renewal date: ${renewalDate.format()}`
	);

	for (const daysBefore of REMINDERS) {
		const reminderDate = renewalDate.subtract(daysBefore, "day");
		const currentTime = dayjs();

		workflowDebug(`Processing reminder for ${daysBefore} days before. Reminder date: ${reminderDate.format()}, Current time: ${currentTime.format()}`);

		// If the reminder date is in the future, sleep until that date
		if (reminderDate.isAfter(currentTime, "day")) {
			workflowDebug(
				`Reminder date is in future. Sleeping until ${reminderDate.format()}`
			);
			await sleepUntilReminder(
				context,
				`${daysBefore} days before reminder`,
				reminderDate
			);
		}

		// After sleeping (or if reminder date is today/past), process the reminder
		// Re-fetch subscription to get latest data after sleep
		const currentSubscription = await fetchSubscription(
			context,
			subscriptionId
		);

		// Check if subscription is still active after sleep
		if (!currentSubscription || currentSubscription.status !== "active") {
			workflowDebug(
				`Subscription ${subscriptionId} is no longer active after sleep. Stopping workflow.`
			);
			return;
		}

		// Check if we should still send this reminder (renewal date might have changed)
		const latestRenewalDate = dayjs(currentSubscription.renewalDate);
		const latestReminderDate = latestRenewalDate.subtract(
			daysBefore,
			"day"
		);
		const nowAfterSleep = dayjs();

		// Only trigger reminder if we're on or past the reminder date
		if (nowAfterSleep.isSameOrAfter(latestReminderDate, "day")) {
			workflowDebug(`Triggering reminder for ${daysBefore} days before`);
			await triggerReminder(
				context,
				`${daysBefore} days before reminder`,
				currentSubscription,
				daysBefore
			);
		} else {
			workflowDebug(
				`Skipping reminder for ${daysBefore} days before - reminder date has shifted`
			);
		}
	}

	workflowDebug(`Completed all reminders for subscription ${subscriptionId}`);
});

const getWorkflowStatus = async (req, res, next) => {
	try {
		const workflowRunId = req.params.workflowRunId;
		if (!workflowRunId) {
			workflowDebug("Workflow Run ID is required");
			return res
				.status(400)
				.json(new ApiError(400, "Workflow Run ID is required"));
		}

		const { runs } = await qstash.logs({
			workflowRunId: workflowRunId,
			count: 1,
		});
		if (!runs || runs.length === 0) {
			workflowDebug(`No runs found for Workflow Run ID: ${workflowRunId}`);
			return res.status(404).json(
				new ApiResponse({ workflowRunId: workflowRunId, status: "not_found" }, "Workflow run not found",404));
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

const cancelWorkflow = async (req, res, next) => {
	try {
		const workflowRunId = req.params.workflowRunId;
		if (!workflowRunId) {
			throw new ApiError(400, "Workflow Run ID is required");
		}

		const response = await qstash.cancel({ ids: workflowRunId });

		return res
			.status(200)
			.json(new ApiResponse(response, "Workflow cancelled successfully", 200));
	} catch (err) {
		next(err);
	}
};

const cancelAllWorkflows = async (req, res, next) => {
	try {
		const result = await qstash.cancel({ all: true });
		res.json(new ApiResponse(result, "All workflows cancelled successfully", 200));
	} catch (err) {
		next(err);
	}
};

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

		return res.json(
			new ApiResponse({details: simplified, count: simplified.length}, "Running workflows fetched", 200)
		);
	} catch (err) {
		next(err);
	}
};

const fetchSubscription = async (context, subscriptionId) => {
	return await context.run("Get Subscription", async () => {
		workflowDebug(`Fetching subscription ${subscriptionId}`);
		const subscription = await Subscription.findById(subscriptionId).populate("user", "name email");
		workflowDebug(`Subscription fetched: ${subscription ? "found" : "not found"}`);
		return subscription;
	});
};

const sleepUntilReminder = async (context, label, date) => {
	workflowDebug(`Sleeping until ${label}. Next reminder at ${date.format()}`);
	// Use the start of the day for the reminder date to ensure we wake up on the right day
	const sleepUntilDate = date.startOf("day").toDate();
	return await context.sleepUntil(label, sleepUntilDate);
};

const triggerReminder = async (context, label, subscription, daysBefore) => {
	// If the renewal date is 0 days before the renewal, we need to update the subscription status and renewal date
	if (daysBefore === 0) {
		workflowDebug(`Subscription renewal date is today. Updating the subscription immediately.`);
		return await context.run(label, async () => {
			const subscriptionId = subscription._id;
			workflowDebug(`Renewal date is today for subscription ${subscriptionId}. Updating status and renewal date.`);

			// Re-fetch to ensure we have the latest data
			const subscriptionForRenewal = await Subscription.findById(subscriptionId).populate("user", "name email");

			if (!subscriptionForRenewal) {
				workflowDebug(`Subscription ${subscriptionId} not found during renewal update`);
				return;
			}

			// Update renewal date based on frequency
			const currentRenewalDate = dayjs(subscriptionForRenewal.renewalDate);
			let newRenewalDate;

			switch (subscriptionForRenewal.frequency) {
				case "monthly":
					newRenewalDate = currentRenewalDate.add(1, "month");
					break;
				case "yearly":
					newRenewalDate = currentRenewalDate.add(1, "year");
					break;
				case "weekly":
					newRenewalDate = currentRenewalDate.add(1, "week");
					break;
				case "daily":
					newRenewalDate = currentRenewalDate.add(1, "day");
					break;
				default:
					workflowDebug(`Unsupported frequency: ${subscriptionForRenewal.frequency}`);
					throw new ApiError(400,`Unsupported frequency: ${subscriptionForRenewal.frequency}`);
			}

			// Update the subscription
			subscriptionForRenewal.renewalDate = newRenewalDate.toDate();
			subscriptionForRenewal.status = "active";

			// Trigger new workflow for the next renewal cycle
			try {
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

				workflowDebug(`New renewal workflow triggered for subscription ${subscriptionId} with run ID: ${workflowRunId}`);
				subscriptionForRenewal.workflowId = workflowRunId;
			} catch (error) {
				workflowDebug(`Failed to trigger new workflow: ${error.message}`);
				// Don't throw here, as we still want to save the updated subscription
			}

			await subscriptionForRenewal.save({ validateBeforeSave: false });
			workflowDebug(`Subscription ${subscriptionId} updated successfully. New renewal date: ${newRenewalDate.format()}`);
		});
	}

	// Send reminder email for non-renewal days
	return await context.run(label, async () => {
		workflowDebug(`Triggering ${label} for subscription ${subscription._id}`);

		try {
			await sendReminderEmail({
				to: subscription.user.email,
				type: label,
				subscription: subscription,
			});
			workflowDebug(`Reminder email sent successfully for ${label}`);
		} catch (error) {
			workflowDebug(`Failed to send reminder email: ${error.message}`);
			throw error; // Re-throw to ensure the workflow step fails if email fails
		}
	});
};

export {
	sendReminders,
	getWorkflowStatus,
	cancelWorkflow,
	cancelAllWorkflows,
	listRunningWorkflows,
};