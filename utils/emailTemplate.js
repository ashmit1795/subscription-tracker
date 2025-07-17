export const generateEmailTemplate = ({
	userName,
	subscriptionName,
	renewalDate,
	planName,
	price,
	paymentMethod,
	supportLink,
	daysLeft,
}) => `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #f5f5f5; max-width: 600px; margin: 0 auto; background-color: #0f172a; padding: 0;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 0 15px rgba(0,0,0,0.3);">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(90deg, #4a90e2, #6366f1); text-align: center; padding: 30px 20px;">
            <p style="font-size: 42px; font-weight: 900; color: #fff; margin: 0;">SubBee 🐝</p>
            <p style="font-size: 14px; color: #cbd5e1; margin-top: 8px; font-style: italic;">busy reminding you</p>
            </td>
        </tr>
        <!-- Content -->
        <tr>
            <td style="padding: 30px 25px;">
                <p style="font-size: 16px; margin-bottom: 20px; color: #e2e8f0;">Hey <strong style="color: #4fbcf7;">${userName}</strong>,</p>
                <p style="font-size: 16px; margin-bottom: 25px; color: #cbd5e1;">
                    Just a quick reminder that your <strong>${subscriptionName}</strong> subscription is set to renew on 
                    <strong style="color: #4fbcf7;">${renewalDate}</strong> (${daysLeft} days from today).
                </p>
        
                <!-- Subscription Info Box -->
                <table cellpadding="25" cellspacing="0" border="0" width="100%" style="background-color: #334155; border-radius: 10px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 12px; font-size: 15px; color: #f1f5f9; border-bottom: 1px solid #475569;"><strong>📦 Plan:</strong> ${planName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; font-size: 15px; color: #f1f5f9; border-bottom: 1px solid #475569;"><strong>💵 Price:</strong> ${price}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; font-size: 15px; color: #f1f5f9;"><strong>🏦 Payment Method:</strong> ${paymentMethod}</td>
                    </tr>
                </table>
        
                <p style="font-size: 15px; margin-bottom: 20px; color: #cbd5e1;">Need to modify or cancel this subscription? Use endpoint, or visit <a href="https://documenter.getpostman.com/view/32382436/2sB34ikes3" style="color: #60a5fa; text-decoration: underline;">API Documentation</a> before the renewal date.</p>
        
                <p style="font-size: 15px; margin-top: 30px; color: #cbd5e1;">
                    Need help? 
                    <a href="${supportLink}" style="color: #60a5fa; text-decoration: underline;">Contact our support team</a>.
                </p>
        
                <p style="font-size: 15px; margin-top: 35px; color: #e2e8f0;">
                    Best,<br><strong>The SubBee 🐝 Team</strong>
                </p>
            </td>
        </tr>
        <!-- Footer -->
        <tr>
            <td style="background-color: #0f172a; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
                <p style="margin: 0;">Ashmit Inc. | Balangir, Odisha, India </p>
                <p style="margin: 8px 0 0;">
                    <a href="https://documenter.getpostman.com/view/32382436/2sB34ikes3#a7490843-802d-41fd-8f37-93bdf7eb1c13" style="color: #60a5fa; text-decoration: underline; margin: 0 8px;">Unsubscribe</a> | 
                    <a href="#" style="color: #60a5fa; text-decoration: underline; margin: 0 8px;">Privacy Policy</a> | 
                    <a href="#" style="color: #60a5fa; text-decoration: underline; margin: 0 8px;">Terms of Service</a>
                </p>
            </td>
        </tr>
    </table>
</div>
`;

export const emailTemplates = [
	{
		label: "7 days before reminder",
		generateSubject: (data) =>
			`📅 Reminder: Your ${data.subscriptionName} Subscription Renews in 7 Days!`,
		generateBody: (data) => generateEmailTemplate({ ...data, daysLeft: 7 }),
	},
	{
		label: "5 days before reminder",
		generateSubject: (data) =>
			`⏳ ${data.subscriptionName} Renews in 5 Days – Stay Subscribed!`,
		generateBody: (data) => generateEmailTemplate({ ...data, daysLeft: 5 }),
	},
	{
		label: "2 days before reminder",
		generateSubject: (data) =>
			`🚀 2 Days Left!  ${data.subscriptionName} Subscription Renewal`,
		generateBody: (data) => generateEmailTemplate({ ...data, daysLeft: 2 }),
	},
	{
		label: "1 days before reminder",
		generateSubject: (data) =>
			`⚡ Final Reminder: ${data.subscriptionName} Renews Tomorrow!`,
		generateBody: (data) => generateEmailTemplate({ ...data, daysLeft: 1 }),
	}
];
