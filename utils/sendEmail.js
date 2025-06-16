import dayjs from "dayjs";
import ApiError from "./ApiError.js"
import { emailTemplates } from "./emailTemplate.js";
import transporter, { accountEmail } from "../config/nodemailer.js";
import debug from "debug";

const sendEmailDebug = debug("subtracker:utils:sendEmail");

const sendReminderEmail = async ({ to, type, subscription }) => {
    if (!to || !type) throw new ApiError(400, "Email recipient and type are required");
    
    const template = emailTemplates.find(t => t.label === type);
    if (!template) throw new ApiError(404, "Invalid email type");

    const mailInfo = {
		userName: subscription.user.name,
		subscriptionName: subscription.name,
		renewalDate: dayjs(subscription.renewalDate).format("MMM D, YYYY"),
		planName: subscription.name,
        price: `${subscription.currency} ${subscription.price} (${subscription.frequency})`,
        paymentMethod: subscription.paymentMethod,
    };
    
    const message = template.generateBody(mailInfo);
    const subject = template.generateSubject(mailInfo);
    const mailOptions = {
        from: accountEmail,
        to,
        subject,
        html: message,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("Error sending email:", error);
            throw new ApiError(500, "Failed to send email");
        }
        sendEmailDebug(`Email sent successfully to ${mailInfo.userName}`, info.response);
    });
}

export default sendReminderEmail;