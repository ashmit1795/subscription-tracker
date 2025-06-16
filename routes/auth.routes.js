import { Router } from "express";
import { signIn, signOut, signUp } from "../controllers/auth.controller.js";
import { authorize } from "../middlewares/authorize.middleware.js";

const authRouter = Router();

authRouter.post("/sign-up", signUp);
authRouter.post("/sign-in", signIn);
authRouter.post("/sign-out", authorize, signOut);

export default authRouter;