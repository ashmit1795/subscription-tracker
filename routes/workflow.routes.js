import { Router } from "express";
import { cancelAllWorkflows, cancelWorkflow, getWorkflowStatus, listRunningWorkflows, sendReminders } from "../controllers/workflow.controller.js";
import { NODE_ENV } from "../config/env.js";
import { authorize, authorizeRoles } from "../middlewares/authorize.middleware.js";

const workflowRouter = Router();

// Reminder route for subscriptions
workflowRouter.post("/subscription/reminder", sendReminders);

// ! Get the status of a workflow run - admin only
workflowRouter.get("/status/:workflowRunId", authorize, authorizeRoles("admin"), getWorkflowStatus);

// ! Cancel a specific workflow run - admin only
workflowRouter.post("/cancel/:workflowRunId", authorize, authorizeRoles("admin"), cancelWorkflow);

// ! Cancel all workflows - admin only
workflowRouter.post("/cancel-all", authorize, authorizeRoles("admin"), cancelAllWorkflows);

// ! List all running workflows - admin only
workflowRouter.get("/running", authorize, authorizeRoles("admin"), listRunningWorkflows);



if (NODE_ENV === "development") {
    workflowRouter.post("/cancel/:workflowRunId", cancelWorkflow);
    workflowRouter.post("/cancel-all", cancelAllWorkflows);
    workflowRouter.get("/running", listRunningWorkflows);

}

export default workflowRouter;
