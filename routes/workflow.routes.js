import { Router } from "express";
import { cancelAllWorkflows, cancelWorkflow, getWorkflowStatus, listRunningWorkflows, sendReminders } from "../controllers/workflow.controller.js";
import { NODE_ENV } from "../config/env.js";
import { authorize, authorizeRoles } from "../middlewares/authorize.middleware.js";

const workflowRouter = Router();


workflowRouter.post("/subscription/reminder", sendReminders);
workflowRouter.get("/status/:workflowRunId", authorize, authorizeRoles("admin"), getWorkflowStatus);
workflowRouter.post("/cancel/:workflowRunId", authorize, authorizeRoles("admin"), cancelWorkflow);
workflowRouter.post("/cancel-all", authorize, authorizeRoles("admin"), cancelAllWorkflows);
workflowRouter.get("/running", authorize, authorizeRoles("admin"), listRunningWorkflows);



if (NODE_ENV === "development") {
    workflowRouter.post("/cancel/:workflowRunId", cancelWorkflow);
    workflowRouter.post("/cancel-all", cancelAllWorkflows);
    workflowRouter.get("/running", listRunningWorkflows);

}

export default workflowRouter;
