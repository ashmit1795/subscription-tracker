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
	try {
		const { subscriptionId } = context.requestPayload;
		workflowDebug(`Starting workflow for subscription: ${subscriptionId}`);

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

		workflowDebug(
			`Renewal date: ${renewalDate.format(
				"YYYY-MM-DD"
			)}, Current date: ${now.format("YYYY-MM-DD")}`
		);

		// Check if the renewal date is in the past
		if (renewalDate.isBefore(now, "day")) {
			workflowDebug(
				`Renewal date has passed for subscription ${subscriptionId}. Stopping workflow.`
			);
			return;
		}

		// Process each reminder
		for (let i = 0; i < REMINDERS.length; i++) {
			const daysBefore = REMINDERS[i];
			const reminderDate = renewalDate.subtract(daysBefore, "day");

			workflowDebug(
				`\n=== Processing reminder ${i + 1}/${
					REMINDERS.length
				}: ${daysBefore} days before ===`
			);
			workflowDebug(
				`Reminder date: ${reminderDate.format("YYYY-MM-DD")}`
			);

			try {
				// If reminder date is in the future, sleep until that date
				if (reminderDate.isAfter(dayjs(), "day")) {
					workflowDebug(
						`Sleeping until ${reminderDate.format("YYYY-MM-DD")}`
					);
					await context.sleepUntil(
						`Sleep until ${daysBefore} days before`,
						reminderDate.startOf("day").toDate()
					);
					workflowDebug(
						`Woke up for ${daysBefore} days before reminder`
					);
				}

				// Re-fetch subscription after potential sleep
				const currentSubscription = await fetchSubscription(
					context,
					subscriptionId
				);

				if (
					!currentSubscription ||
					currentSubscription.status !== "active"
				) {
					workflowDebug(
						`Subscription no longer active. Stopping workflow.`
					);
					return;
				}

				// Send reminder or process renewal
				if (daysBefore === 0) {
					workflowDebug(`Processing renewal (day 0)`);
					await processRenewal(context, currentSubscription);
				} else {
					workflowDebug(`Sending ${daysBefore} days before reminder`);
					await sendReminder(
						context,
						currentSubscription,
						daysBefore
					);
				}

				workflowDebug(
					`✅ Completed ${daysBefore} days before reminder`
				);
			} catch (error) {
				workflowDebug(
					`❌ Error in ${daysBefore} days before reminder: ${error.message}`
				);
				throw error;
			}
		}

		workflowDebug(
			`🎉 Workflow completed successfully for subscription ${subscriptionId}`
		);
	} catch (error) {
		workflowDebug(`💥 Workflow failed: ${error.message}`);
		throw error;
	}
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
			workflowDebug(
				`No runs found for Workflow Run ID: ${workflowRunId}`
			);
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

		workflowDebug(
			`Workflow Run ID: ${workflowRunId}, Status: ${runs[0].workflowState}`
		);
		return res.json({
			workflowRunId: workflowRunId,
			status: runs[0].workflowState,
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
			.json(
				new ApiResponse(
					response,
					"Workflow cancelled successfully",
					200
				)
			);
	} catch (err) {
		next(err);
	}
};

const cancelAllWorkflows = async (req, res, next) => {
	try {
		const result = await qstash.cancel({ all: true });
		res.json(
			new ApiResponse(result, "All workflows cancelled successfully", 200)
		);
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
			new ApiResponse(
				{ details: simplified, count: simplified.length },
				"Running workflows fetched",
				200
			)
		);
	} catch (err) {
		next(err);
	}
};

const fetchSubscription = async (context, subscriptionId) => {
	return await context.run("Get Subscription", async () => {
		workflowDebug(`Fetching subscription ${subscriptionId}`);
		const subscription = await Subscription.findById(
			subscriptionId
		).populate("user", "name email");
		if (subscription) {
			workflowDebug(
				`✅ Subscription found: ${subscription.name}, Status: ${
					subscription.status
				}, Renewal: ${dayjs(subscription.renewalDate).format(
					"YYYY-MM-DD"
				)}`
			);
		} else {
			workflowDebug(`❌ Subscription not found`);
		}
		return subscription;
	});
};

const sendReminder = async (context, subscription, daysBefore) => {
	return await context.run(`Send ${daysBefore} days reminder`, async () => {
		workflowDebug(
			`📧 Sending ${daysBefore} days before reminder to ${subscription.user.email}`
		);

		await sendReminderEmail({
			to: subscription.user.email,
			type: `${daysBefore} days before reminder`,
			subscription: subscription,
		});

		workflowDebug(`✅ Reminder email sent successfully`);
	});
};

const processRenewal = async (context, subscription) => {
	return await context.run("Process Renewal", async () => {
		workflowDebug(
			`🔄 Processing renewal for subscription ${subscription._id}`
		);

		const currentRenewalDate = dayjs(subscription.renewalDate);
		let newRenewalDate;

		// Calculate new renewal date
		switch (subscription.frequency) {
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
				throw new ApiError(
					400,
					`Unsupported frequency: ${subscription.frequency}`
				);
		}

		// Update subscription
		subscription.renewalDate = newRenewalDate.toDate();
		subscription.status = "active";

		// Trigger new workflow for next cycle
		let newWorkflowId = null;
		try {
			const { workflowRunId } = await workflowClient.trigger({
				url: `${SERVER_URL}/api/v1/workflows/subscription/reminder`,
				body: { subscriptionId: subscription._id },
				headers: { "content-type": "application/json" },
				retries: 0,
			});
			newWorkflowId = workflowRunId;
			workflowDebug(`🚀 New workflow triggered: ${workflowRunId}`);
		} catch (error) {
			workflowDebug(
				`⚠️ Failed to trigger new workflow: ${error.message}`
			);
		}

		if (newWorkflowId) {
			subscription.workflowId = newWorkflowId;
		}

		await subscription.save({ validateBeforeSave: false });

		workflowDebug(
			`✅ Subscription renewed. New renewal date: ${newRenewalDate.format(
				"YYYY-MM-DD"
			)}`
		);
	});
};

export {
	sendReminders,
	getWorkflowStatus,
	cancelWorkflow,
	cancelAllWorkflows,
	listRunningWorkflows,
};
