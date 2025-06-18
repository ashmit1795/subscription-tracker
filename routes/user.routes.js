import { Router } from "express";
import { authorize, authorizeRoles } from "../middlewares/authorize.middleware.js";
import { getUserById, getUsers, updateUser } from "../controllers/user.controller.js";

const userRouter = Router();

// ! Get all users - admin only
userRouter.get("/", authorize, authorizeRoles("admin"), getUsers);

// ! Get user details by ID - admin only
userRouter.get("/:id", authorize, authorizeRoles("admin"), getUserById);

// Update user details
userRouter.put("/update", authorize, updateUser);

// Delete a user
userRouter.delete("/:id", authorize,  (req, res) => res.send({ title: "DELETE user" }));

export default userRouter;
