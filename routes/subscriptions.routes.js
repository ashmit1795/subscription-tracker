import { Router } from "express";
import { authorize, authorizeRoles } from "../middlewares/authorize.middleware.js";
import { cancelSubscription, createSubscription, deleteSubscription, getAllSubscriptions, getCurrentUserSubscriptions, getSpecificUserSubscription, getSubscriptionById, getUpcomingRenewals, resumeSubscription, unsubscribe, updateSubscription } from "../controllers/subscription.controller.js";

const subscriptionsRouter = Router();

// ! Get all subscriptions, admin-only route
subscriptionsRouter.get("/", authorize, authorizeRoles("admin"), getAllSubscriptions);

// Get current user's subscriptions
subscriptionsRouter.get("/current-user", authorize, getCurrentUserSubscriptions);

// Get upcoming renewals
subscriptionsRouter.get("/upcoming-renewals", authorize, getUpcomingRenewals);

// Get subscription details by ID
subscriptionsRouter.get("/:id", authorize, getSubscriptionById);

// Create a new subscription
subscriptionsRouter.post("/", authorize, createSubscription);

// Update an existing subscription
subscriptionsRouter.put("/update/:id", authorize, updateSubscription);

// ! Delete a subscription, admin-only route
subscriptionsRouter.delete("/delete/:id", authorize, authorizeRoles("admin"), deleteSubscription);

// ! Get all subscriptions for a specific user, admin-only route
subscriptionsRouter.get("/user/:id", authorize, authorizeRoles("admin"), getSpecificUserSubscription);


// Cancel a subscription
subscriptionsRouter.delete("/cancel/:id", authorize, cancelSubscription);

// Unsubscribe from a subscription
subscriptionsRouter.delete("/unsubscribe/:id", authorize, unsubscribe);

// Resume a subscription
subscriptionsRouter.put("/resume/:id", authorize, resumeSubscription);


export default subscriptionsRouter;