# DTR Web App

A Daily Time Record app hosted on GitHub Pages. A Google Apps Script web app connects it to a Google Sheet for shared attendance and a private Google Drive folder for Time In and Time Out selfies.

## Google Sheets and Drive setup

1. Create a Google Sheet in the Google account that should own the attendance data and selfie files.
2. In the Sheet, select **Extensions → Apps Script**. Replace the editor contents with [`Code.gs`](./Code.gs) and save.
3. In the Apps Script editor, select and run `setupDtr`. Approve the requested Google Sheets and Drive permissions. This creates the `Employees` and `Attendance` tabs, seeds the current employee list, and creates a private Drive folder for selfies.
4. Add, edit, or remove employees in the Sheet's **Employees** tab. Keep the column headings and order unchanged: `employee_id`, `name`, `department`, `position`.
5. Select and run `setDtrAdminPassword` from Apps Script. Choose a strong password of at least 12 characters. It is saved in Apps Script properties, not in this GitHub repository.
6. In Apps Script, select **Deploy → New deployment → Web app**. Set **Execute as** to your account, and **Who has access** to **Anyone**. Deploy and copy the `/exec` web-app URL.
7. Paste the deployed URL into [`google-sheets-config.js`](./google-sheets-config.js):

   ```js
   window.DTR_GAS_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
   ```

8. Commit the app to GitHub and enable GitHub Pages. Open the GitHub Pages URL on employee and admin devices. Employees enter their employee ID; the admin opens the **Admin** tab and enters the password configured in step 5.

The Sheet stores the employee, date, time-in/time-out, and private Drive file IDs. Times remain stored as 24-hour `HH:mm:ss` values; the admin dashboard displays them as 12-hour times with AM/PM and calculates elapsed time in the browser. A record without Time Out is shown as **Ongoing**. The admin employee directory shows every employee's attendance-day, completed-day, ongoing-day, and total-completed-time summary; admins can also open an employee's full attendance history and upload/replace their default profile picture. Employee profile-photo IDs are stored in a separate `Employee Photos` tab, while the actual images stay in the private Drive folder. `setupDtr()` creates that tab; if you already ran setup before this feature was added, the app creates the tab the first time a profile picture or employee lookup is requested. These additions do not change attendance columns or existing attendance data. Attendance dates and times use the Apps Script project's time zone; set the correct time zone in the Apps Script project settings.

When you change the Apps Script code, deploy a new version of the web app. If the existing deployment URL is retained, update that deployment to use the new version.

## Security and privacy limitations

Employees sign in using **only their employee ID**, as requested. An ID card number is an identifier, not a secret: anyone who knows or guesses another employee's ID can submit a time entry and selfie for that employee. The employee lookup also returns that employee's default profile picture, so anyone who knows a valid ID can view that picture. The selfie lets an admin review attendance submissions later; it does not authenticate the person taking it or perform face recognition.

The Apps Script endpoint must be publicly reachable for GitHub Pages to call it without employee Google accounts. Employee photo/time submission is therefore not strongly authenticated. Admin data and photo retrieval require the password stored in Apps Script properties and a short-lived server-side session token, but the public endpoint can still be targeted and Apps Script quotas apply. Use strong IDs, protect employee IDs, and do not treat this as tamper-proof payroll or biometric verification. Review employee consent, photo retention, and access obligations before collecting photos.

Never put a Google service-account key, admin password, or other secret in `app.js`, `google-sheets-config.js`, or any public GitHub file. The Apps Script web-app URL itself is not a secret.

## Camera requirements

The webcam requires an HTTPS page (GitHub Pages provides HTTPS) and browser camera permission. Photos are requested for both Time In and Time Out.
