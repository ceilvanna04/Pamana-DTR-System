# DTR Web App

A simple Daily Time Record (DTR) web application with employee ID lookup, webcam selfie capture, simulated facial verification, time-in/out, breaks, and an admin dashboard.

## Important
This starter is designed to run immediately on GitHub Pages as a front-end demo. The facial verification included here is **not biometric identity verification**: it captures a selfie and performs basic camera/face-presence UX only. Do not deploy this as a real security control without implementing a properly reviewed biometric verification service and privacy controls.

## Run
Open `index.html` locally, or use any static hosting service such as GitHub Pages.

## Admin login

The admin dashboard is protected by a login screen.

**Change these credentials before using the application in production.** In this static demo they are visible in the JavaScript source, so this is not real security. A production version should authenticate against a backend using hashed passwords and secure sessions.

Data is stored in the browser's localStorage for this demo. A production system should replace this with a secure backend and database.


### Captured face on Admin Dashboard
When an employee completes Time In, the demo stores the captured selfie with that attendance record and shows a clickable face thumbnail beside the employee on the Admin Dashboard. Click the thumbnail to view a larger image. This is for visual review only; it does not perform facial recognition or prove that the face belongs to the employee. Because the demo uses browser localStorage, production use should store biometric data securely on a backend with appropriate consent, retention, access controls, and privacy compliance.
