import nodemailer from "nodemailer"
import { EMAIL_APP_PASSWORD } from "./env.js";

export const accountEmail = "ashmitpatra77@gmail.com";

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: accountEmail,
		pass: EMAIL_APP_PASSWORD,
	},
});

export default transporter;
