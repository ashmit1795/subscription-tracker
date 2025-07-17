
# 📬 Subscription Tracker API - 🐝SubBee

A backend service for managing and tracking user subscriptions with features like automated reminders, secure unsubscribe routes, user authentication, and email integrations.

## 🔗 Live API
**Base URL:** [https://subscription-tracker-sgrx.onrender.com](https://subscription-tracker-sgrx.onrender.com)

## 📑 Full API Documentation
Explore complete API usage, parameters, and responses here:  
👉 [View Postman Documentation](https://documenter.getpostman.com/view/32382436/2sB34ikes3)



## 🚀 Features

- 🔐 **User Authentication & Authorization**  
  Secure login and registration with hashed passwords, JWT access/refresh tokens, and role-based access (admin/user).

- 📩 **Email Reminders with Unsubscribe Option**  
  Automated subscription renewal reminders sent via email, with an embedded unsubscribe link.

- 🧠 **Smart Reminder Scheduling**  
  Reminders are scheduled at specific intervals (e.g., 7, 5, 2, 1, 0 days before renewal) using Upstash QStash workflows.

- 📤 **Transactional Emails via Gmail + Nodemailer**  
  Sends responsive HTML emails for reminders using Nodemailer with Gmail’s SMTP service.

- 📆 **Subscription Management**  
  Add, update, delete, and view subscriptions with fields like renewal date, frequency, and cost.

- 🧪 **Arcjet Security Middleware**  
  Protects endpoints with Arcjet for rate-limiting, bot defense, and abuse prevention.

- 📂 **Modular Folder Structure**  
  Clean and scalable codebase with clear separation of concerns (controllers, routes, middleware, models, etc).

- 📄 **API Documentation with Postman**  
  Complete API reference available at:  [Postman Docs](https://documenter.getpostman.com/view/32382436/2sB34ikes3)

- 🌐 **Unsubscribe via Secure POST Link**  
  One-click unsubscribe handled safely with a backend POST request to prevent abuse.

- ⚠️ **Robust Error Handling**  
  Centralized error middleware and consistent `ApiResponse` and `ApiError` classes for better API handling.

## 📁 Project Structure

```bash
subscription-tracker/
├── controllers/
│   ├── auth.controller.js           # Handles user authentication logic
│   ├── subscription.controller.js   # Manages subscriptions and renewal logic
│   ├── user.controller.js           # User profile management
│   └── workflow.controller.js       # Handles workflows (e.g., reminder jobs)
│
├── models/
│   ├── subscription.model.js        # Mongoose schema for subscriptions
│   └── user.model.js                # Mongoose schema for users
│
├── middlewares/
│   ├── arcjet.middleware.js         # Arcjet security middleware (rate-limiting, etc.)
│   ├── authorize.middleware.js      # JWT-based auth and role authorization
│   └── error.middleware.js          # Centralized error handling
│
├── db/
│   └── mongodb.js                   # MongoDB connection setup
│
├── config/
│   ├── env.js                       # Environment variable loader
│   ├── arcjet.js                    # Arcjet configuration
│   ├── nodemailer.js                # Email service configuration
│   └── upstash.js                   # Upstash (QStash/Workflow) configuration
│
├── routes/
│   ├── auth.routes.js               # Auth-related routes
│   ├── subscription.routes.js       # Subscription CRUD and actions
│   ├── user.routes.js               # User-related routes
│   └── workflow.routes.js           # Routes to manually trigger/monitor workflows
│
├── utils/
│   ├── ApiError.js                  # Custom error handler class
│   ├── ApiResponse.js               # Standardized API response format
│   ├── emailTemplate.js             # Dynamic HTML templates for emails
│   ├── parseDate.js                 # Helper for parsing dates
│   └── sendEmail.js                 # Function to send transactional emails
│
├── app.js                           # Express app setup with routes and middleware
├── index.js                         # Server entry point
├── constants.js                     # App-wide constants
├── package.json                     # Project metadata and dependencies
├── package-lock.json                # Exact version lock for npm
├── .node-version                    # Node.js version specification
├── .nvmrc                           # Node Version Manager config
├── eslint.config.js                 # ESLint configuration
└── .gitignore                       # Ignored files and directories
```

## Environment Variables

To run this project, you will need to add the following environment variables to your .env file

`PORT`

`SERVER_URL`

`DB_URI`

`NODE_ENV=development`

`DEBUG=subtracker:*`

`JWT_SECRET`

`JWT_EXPIRES_IN`

`ARCJET_KEY`

`ARCJET_ENV`

`QSTASH_URL`

`QSTASH_TOKEN`

`QSTASH_CURRENT_SIGNING_KEY`

`QSTASH_NEXT_SIGNING_KEY`

`EMAIL_APP_PASSWORD`

## Installation & Running Locally
Step-by-step instructions to run the project locally.


#### 1. Clone the repository

```bash
git clone https://github.com/ashmit1795/subscription-tracker.git
```

#### 2. Navigate into the project directory
```bash
cd subscription-tracker
```

#### 3. Install dependencies
```bash
npm install
```

#### 4. Set up your .env file (see above)

#### 5. Start the server
```bash
npm run dev
```

## 🧰 Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT (Access & Refresh Tokens)
- **Email Service**: Nodemailer + Gmail SMTP
- **Scheduling**: Upstash QStash Workflows
- **Security**: Arcjet Middleware
- **Docs**: Postman

## 🔒 Security Best Practices

- **JWT-Based Auth**: Secure access and refresh tokens used for route protection.
- **Password Hashing**: User passwords are securely hashed using `bcrypt`.
- **Environment Variables**: Sensitive information is stored in `.env` (never commit this).
- **Rate Limiting & IP Protection**: Arcjet Middleware guards against abuse and bot attacks.
- **Validation**: All inputs are validated at the controller level.

## 🧪 Testing

Manual testing is done via Postman. Use the [API documentation](https://documenter.getpostman.com/view/32382436/2sB34ikes3) to test:

- Registration & Login
- Subscription Creation & Cancellation
- Email Reminder Flow
- Logout

> Automated tests will be added in upcoming versions.
## 🤝 Contributing

Contributions are welcome! Feel free to fork the repo and submit a pull request.

- Fork the repository
- Create a new branch: `git checkout -b feature-name`
- Commit your changes: `git commit -m "Add feature"`
- Push to the branch: `git push origin feature-name`
- Submit a pull request 🚀
## 🙌 Acknowledgements

- **[JavaScript Mastery](https://www.youtube.com/@javascriptmastery)** – Initially followed along with his video to understand the core tech and project flow. Later extended it beyond the tutorial, made the app more robust, scalable, and aimed to make it crash-proof.
- **[Postman](https://www.postman.com/)** – For API testing and publishing the documentation.
- **[Upstash](https://upstash.com/)** – Used for serverless workflows and subscription cycle automation.
- **[Nodemailer](https://nodemailer.com/about/)** – For sending out subscription renewal emails.
- **[Arcjet](https://arcjet.com/)** – To add rate-limiting and protection against automated abuse.
- **[Chai aur Code](https://www.youtube.com/@chaiaurcode)** – For deeper insights into backend concepts that inspired improvements and enhancements.
