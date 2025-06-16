import { Router } from "express";
import { authorize, authorizeRoles } from "../middlewares/authorize.middleware.js";
import { getUserById, getUsers } from "../controllers/user.controller.js";

const userRouter = Router();

// Get all users
userRouter.get("/", authorize, authorizeRoles("admin"), getUsers);

// Get user details by ID
userRouter.get("/:id", authorize, getUserById);
userRouter.post("/", (req, res) => res.send({ title: "CREATE new user" }));
userRouter.put("/:id", (req, res) => res.send({ title: "UPDATE user" }));
userRouter.delete("/:id", (req, res) => res.send({ title: "DELETE user" }));

export default userRouter;
