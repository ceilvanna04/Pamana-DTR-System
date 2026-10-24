# Pamana DTR System

The **Pamana DTR System** is a lightweight, web-based Daily Time Record (DTR) application designed for seamless attendance tracking. Hosted via GitHub Pages, it leverages a Google Apps Script backend to connect directly with a Google Sheet for centralized attendance logs and a secure, private Google Drive folder for time-in and time-out verification selfies.

## Key Features

* **Simple Employee Experience:** Employees access a clean interface via GitHub Pages where they log attendance quickly using their employee ID.
* **Webcam Verification:** The system prompts for a live webcam photo during both **Time In** and **Time Out** to capture visual confirmation for every attendance log.
* **Centralized Google Sheets Backend:** Attendance records—including employee details, timestamps, and private Drive file references—are automatically synced and organized in a Google Sheet.
* **Secure Admin Dashboard:** Administrators have a dedicated tab protected by a secure password stored safely in Apps Script properties. The admin view allows authorized personnel to review attendance logs alongside corresponding employee selfies fetched securely from Google Drive.

## Architecture & Data Storage

* **Attendance Logs:** Stored in a structured Google Sheet containing employee identification, dates, time-in/time-out timestamps, and linked Drive file IDs.
* **Selfie Management:** Photos are stored as private files within a designated Google Drive folder rather than bloating the spreadsheet cells. The admin dashboard dynamically fetches these images upon secure sign-in.
* **Time Zones:** All timestamps adhere strictly to the time zone configured within the underlying Google Apps Script project settings.

## Security and Privacy Limitations

* **Identifier vs. Secret:** Employee sign-in relies on an employee ID number rather than a password. Because an ID is an identifier rather than a strict secret, anyone with knowledge of an ID can technically submit an entry. The captured selfie acts as an administrative review tool rather than a biometric face-recognition mechanism.
* **Public Endpoint:** Because GitHub Pages communicates with the Apps Script web app without requiring individual employee Google accounts, the endpoint must remain publicly reachable. Administrators should encourage strong ID protection and use this tool alongside appropriate data privacy, consent, and photo retention policies.
* **Credentials Protection:** Sensitive keys, passwords, or tokens are never exposed in public repository files like `app.js` or `google-sheets-config.js`.

## Camera Requirements

The application requires an active browser camera permission and an HTTPS environment (provided automatically by GitHub Pages) to successfully capture and transmit attendance verification photos.
