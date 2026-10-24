const EMPLOYEE_HEADERS = ["employee_id", "name", "department", "position"];
const ATTENDANCE_HEADERS = ["employee_id", "date", "time_in", "time_in_photo_id", "time_out", "time_out_photo_id"];

function doPost(event) {
  let request = {};
  try {
    request = JSON.parse(event.parameter.payload || "{}");
    const result = handleRequest_(request);
    return responsePage_({ requestId: request.requestId, ok: true, result });
  } catch (error) {
    return responsePage_({
      requestId: request.requestId || "",
      ok: false,
      error: error && error.message ? error.message : "The request failed.",
    });
  }
}

function setupDtr() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Open this Apps Script project from the Google Sheet using Extensions > Apps Script.");

  PropertiesService.getScriptProperties().setProperty("DTR_SPREADSHEET_ID", spreadsheet.getId());
  const employeeSheet = getOrCreateSheet_(spreadsheet, "Employees", EMPLOYEE_HEADERS);
  const attendanceSheet = getOrCreateSheet_(spreadsheet, "Attendance", ATTENDANCE_HEADERS);
  attendanceSheet.getRange("A:F").setNumberFormat("@");
  const folderId = PropertiesService.getScriptProperties().getProperty("DTR_PHOTOS_FOLDER_ID");
  if (!folderId) {
    const folder = DriveApp.createFolder(`DTR Selfies - ${spreadsheet.getName()}`);
    PropertiesService.getScriptProperties().setProperty("DTR_PHOTOS_FOLDER_ID", folder.getId());
  }

  if (employeeSheet.getLastRow() === 1) {
    employeeSheet.getRange(2, 1, 3, EMPLOYEE_HEADERS.length).setValues([
      ["PMPI-2026-0003", "Nash Mhelmar Donasco", "Printing Staff", "Part-time Printing Staff"],
      ["PMPI-2026-0005", "Jian Carreon", "Printing Staff", "Part-time Printing Staff"],
      ["PMPI-2026-0004", "Alex Reyes", "Printing Staff", "Part-time Printing Staff"],
    ]);
  }
  SpreadsheetApp.getUi().alert("DTR sheets and private selfie folder are ready. Add employee rows in the Employees tab.");
}

function setDtrAdminPassword() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt("Set DTR admin password", "Enter a strong password. It will be stored in Apps Script properties, not in the public app.", ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;
  const password = result.getResponseText();
  if (password.length < 12) throw new Error("Use an admin password with at least 12 characters.");
  PropertiesService.getScriptProperties().setProperty("DTR_ADMIN_PASSWORD", password);
  ui.alert("Admin password saved.");
}

function handleRequest_(request) {
  const action = String(request.action || "");
  if (action === "employee") return employeeRequest_(request.employeeId);
  if (action === "punch") return punchRequest_(request);
  if (action === "adminLogin") return adminLogin_(request.password);
  if (action === "adminRecords") {
    requireAdmin_(request.token);
    return { records: readAttendance_(), today: today_() };
  }
  if (action === "adminPhoto") return adminPhoto_(request);
  throw new Error("Unsupported request.");
}

function employeeRequest_(employeeId) {
  const employee = findEmployee_(employeeId);
  return { employee, record: clientAttendance_(findAttendance_(employee.employee_id, today_())) };
}

function punchRequest_(request) {
  const punch = String(request.punch || "");
  if (punch !== "in" && punch !== "out") throw new Error("Invalid attendance action.");
  const employee = findEmployee_(request.employeeId);
  const date = today_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let photoFileId = "";
  try {
    const record = findAttendance_(employee.employee_id, date);
    if (punch === "in") {
      if (record && record.time_in) throw new Error("Time In has already been recorded for today.");
      const photo = savePhoto_(request.selfie, employee.employee_id, punch);
      photoFileId = photo.fileId;
      attendanceSheet_().appendRow([employee.employee_id, date, time_(), photoFileId, "", ""]);
    } else {
      if (!record || !record.time_in) throw new Error("Record Time In before Time Out.");
      if (record.time_out) throw new Error("Time Out has already been recorded for today.");
      const photo = savePhoto_(request.selfie, employee.employee_id, punch);
      photoFileId = photo.fileId;
      attendanceSheet_().getRange(record.row, 5, 1, 2).setValues([[time_(), photoFileId]]);
    }
  } catch (error) {
    if (photoFileId) DriveApp.getFileById(photoFileId).setTrashed(true);
    throw error;
  } finally {
    lock.releaseLock();
  }
  return { record: clientAttendance_(findAttendance_(employee.employee_id, date)) };
}

function adminLogin_(password) {
  const properties = PropertiesService.getScriptProperties();
  const configuredPassword = properties.getProperty("DTR_ADMIN_PASSWORD");
  if (!configuredPassword) throw new Error("Admin password is not configured. Run setDtrAdminPassword() from the Sheet's Apps Script project.");
  if (String(password || "") !== configuredPassword) throw new Error("Incorrect admin password.");
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(`dtr_admin_${token}`, "1", 1800);
  return { token, records: readAttendance_(), today: today_() };
}

function adminPhoto_(request) {
  requireAdmin_(request.token);
  if (request.punch !== "in" && request.punch !== "out") throw new Error("Invalid photo request.");
  const record = findAttendance_(request.employeeId, request.date);
  if (!record) throw new Error("Attendance record not found.");
  const fileId = request.punch === "in" ? record.time_in_photo_id : record.time_out_photo_id;
  if (!fileId) throw new Error("No photo is saved for this attendance action.");
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  return { dataUrl: `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}` };
}

function requireAdmin_(token) {
  if (!token || CacheService.getScriptCache().get(`dtr_admin_${token}`) !== "1") {
    throw new Error("Admin session expired. Please sign in again.");
  }
}

function findEmployee_(employeeId) {
  const wanted = String(employeeId || "").trim().toUpperCase();
  if (!wanted) throw new Error("Enter your employee ID.");
  const values = employeesSheet_().getDataRange().getDisplayValues();
  for (let index = 1; index < values.length; index += 1) {
    if (String(values[index][0]).trim().toUpperCase() === wanted) {
      return {
        employee_id: String(values[index][0]).trim(),
        name: String(values[index][1]).trim(),
        department: String(values[index][2]).trim(),
        position: String(values[index][3]).trim(),
      };
    }
  }
  throw new Error("Employee ID not found. Contact the administrator.");
}

function findAttendance_(employeeId, date) {
  const values = attendanceSheet_().getDataRange().getDisplayValues();
  for (let index = 1; index < values.length; index += 1) {
    if (values[index][0] === employeeId && values[index][1] === date) {
      return attendanceObject_(values[index], index + 1);
    }
  }
  return null;
}

function readAttendance_() {
  const employees = employeesSheet_().getDataRange().getDisplayValues();
  const names = new Map(employees.slice(1).map(row => [row[0], row[1]]));
  const values = attendanceSheet_().getDataRange().getDisplayValues();
  return values.slice(1)
    .filter(row => row[0] && row[1])
    .map(row => {
      const record = attendanceObject_(row);
      record.employeeName = names.get(record.employee_id) || "Unknown employee";
      record.employeeId = record.employee_id;
      record.employee_id = undefined;
      record.timeIn = record.time_in;
      record.timeOut = record.time_out;
      record.time_in = undefined;
      record.time_out = undefined;
      record.timeInPhoto = Boolean(record.time_in_photo_id);
      record.timeOutPhoto = Boolean(record.time_out_photo_id);
      record.time_in_photo_id = undefined;
      record.time_out_photo_id = undefined;
      return record;
    })
    .sort((left, right) => `${right.date}${right.timeIn}`.localeCompare(`${left.date}${left.timeIn}`));
}

function attendanceObject_(row, rowNumber) {
  return {
    employee_id: row[0],
    date: row[1],
    time_in: row[2],
    time_in_photo_id: row[3],
    time_out: row[4],
    time_out_photo_id: row[5],
    row: rowNumber || null,
  };
}

function savePhoto_(dataUrl, employeeId, punch) {
  const match = String(dataUrl || "").match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("A valid selfie photo is required.");
  if (match[2].length > 4 * 1024 * 1024) throw new Error("The selfie is too large. Please retake the photo.");
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 3 * 1024 * 1024) throw new Error("The selfie is too large. Please retake the photo.");
  const extension = match[1] === "png" ? "png" : "jpg";
  const filename = `${employeeId}_${today_()}_${punch}_${Date.now()}.${extension}`;
  const blob = Utilities.newBlob(bytes, `image/${match[1]}`, filename);
  const folderId = PropertiesService.getScriptProperties().getProperty("DTR_PHOTOS_FOLDER_ID");
  if (!folderId) throw new Error("Selfie folder is missing. Run setupDtr() first.");
  const file = DriveApp.getFolderById(folderId).createFile(blob);
  return { fileId: file.getId() };
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function time_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm:ss");
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
    if (headers.some((header, index) => current[index] !== header)) {
      throw new Error(`Unexpected columns in the ${name} sheet. Do not rename or reorder its header row.`);
    }
  }
  return sheet;
}

function employeesSheet_() {
  return spreadsheet_().getSheetByName("Employees");
}

function attendanceSheet_() {
  return spreadsheet_().getSheetByName("Attendance");
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("DTR_SPREADSHEET_ID");
  if (!id) throw new Error("Run setupDtr() from the linked Google Sheet before deploying the app.");
  return SpreadsheetApp.openById(id);
}

function clientAttendance_(record) {
  if (!record) return null;
  return {
    employeeId: record.employee_id,
    date: record.date,
    timeIn: record.time_in,
    timeOut: record.time_out,
  };
}

function responsePage_(message) {
  const json = JSON.stringify(message).replace(/</g, "\\u003c");
  return HtmlService.createHtmlOutput(`<!doctype html><html><body><script>window.parent.postMessage(${json},"*");</script></body></html>`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
