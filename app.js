const state = {
  page: "employee",
  employee: null,
  record: null,
  records: [],
  employees: [],
  employeeDirectoryAvailable: false,
  selectedEmployeeId: "",
  pendingPhotoEmployeeId: "",
  todayDate: "",
  adminToken: null,
  stream: null,
  refreshInterval: null,
};
let clockInterval;

const $ = selector => document.querySelector(selector);
const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

function render() {
  $("#app").innerHTML = `<div class="shell">
    <header class="topbar"><div class="brand">DTR System</div><nav class="nav">
      <button class="${state.page === "employee" ? "active" : ""}" onclick="setPage('employee')">Employee</button>
      <button class="${state.page === "admin" ? "active" : ""}" onclick="setPage('admin')">Admin</button>
    </nav></header>
    <main class="main">${state.page === "admin" ? adminPage() : employeePage()}</main>
    <div id="toast" class="toast"></div>
  </div>`;
  if (state.page === "employee" && state.employee) updateClock();
  if (state.page === "admin" && state.adminToken) {
    renderTable();
    renderEmployeeDirectory();
    renderEmployeeSummary();
  }
}

function setPage(page) {
  closeCamera();
  closePhoto();
  stopRefreshing();
  state.page = page;
  if (page === "employee") {
    state.adminToken = null;
    state.records = [];
    state.todayDate = "";
    state.employee = null;
    state.record = null;
  }
  render();
  if (page === "admin" && state.adminToken) {
    void refreshAdmin();
    state.refreshInterval = window.setInterval(() => void refreshAdmin(), 15000);
  }
}

function updateClock() {
  const tick = () => {
    const clock = $("#clock");
    if (clock) clock.textContent = timeNow();
  };
  tick();
  if (!clockInterval) clockInterval = window.setInterval(tick, 1000);
}

function employeePage() {
  if (!state.employee) {
    return `<section class="hero"><div class="muted">Daily attendance</div><h1>Daily Time Record</h1><p class="muted">Enter your employee ID to continue.</p></section>
      <section class="card kiosk">
        ${apiNotConfigured()}
        <div class="field"><label>EMPLOYEE ID</label><input id="employeeId" placeholder="e.g. PMPI-2026-0003" autocomplete="off" onkeydown="if(event.key==='Enter')lookupEmployee()"></div>
        <div id="employeeError" class="status error" style="display:none"></div>
        <div class="actions"><button class="btn primary" onclick="lookupEmployee()">Continue</button></div>
      </section>`;
  }
  const record = state.record;
  return `<section class="hero"><div class="muted">Daily attendance</div><h1>Daily Time Record</h1><div id="clock" class="clock"></div><div class="muted">${new Date().toLocaleDateString()}</div></section>
    <section class="card kiosk">
      <div class="employee-profile-header">${state.employee.profilePhoto
        ? `<img class="profile-photo" src="${escapeHTML(state.employee.profilePhoto)}" alt="Profile photo for ${escapeHTML(state.employee.name)}">`
        : `<div class="profile-photo profile-photo-placeholder" aria-hidden="true">${escapeHTML(initials(state.employee.name))}</div>`}
        <div class="employee-profile-details"><h2 style="margin:0">${escapeHTML(state.employee.name)}</h2><p class="muted">${escapeHTML(state.employee.employee_id)}</p></div><button class="btn secondary" onclick="clearEmployee()">Back</button></div>
      <div class="profile"><div class="info"><small>Department</small><strong>${escapeHTML(state.employee.department)}</strong></div><div class="info"><small>Position</small><strong>${escapeHTML(state.employee.position)}</strong></div></div>
      ${record ? recordActions(record) : `<div class="status">Take a selfie to record your time in.</div><div class="actions"><button class="btn primary" onclick="openCamera('in')">Selfie &amp; Time In</button></div>`}
    </section>`;
}

function apiNotConfigured() {
  return window.DTR_GAS_URL
    ? ""
    : `<div class="status error">Google Sheets connection is not configured. Add your deployed Apps Script web-app URL to google-sheets-config.js.</div>`;
}

function initials(name) {
  return String(name || "").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
}

async function lookupEmployee() {
  const input = $("#employeeId");
  const id = input?.value.trim();
  const error = $("#employeeError");
  if (!id || !window.DTR_GAS_URL) {
    if (error) {
      error.textContent = !window.DTR_GAS_URL ? "Google Sheets connection is not configured." : "Enter your employee ID.";
      error.style.display = "block";
    }
    return;
  }
  try {
    const result = await rpc({ action: "employee", employeeId: id });
    state.employee = result.employee;
    state.record = result.record;
    render();
  } catch (err) {
    if (error) {
      error.textContent = err.message;
      error.style.display = "block";
    }
  }
}

function clearEmployee() {
  closeCamera();
  state.employee = null;
  state.record = null;
  render();
}

function recordActions(record) {
  const actionButton = record.timeOut
    ? `<div class="status ok">Today's attendance is complete.</div>`
    : record.timeIn
      ? `<div class="actions"><button class="btn primary" onclick="openCamera('out')">Selfie &amp; Time Out</button></div>`
      : `<div class="actions"><button class="btn primary" onclick="openCamera('in')">Selfie &amp; Time In</button></div>`;
  return `<div class="status ok"><strong>Today's attendance</strong><br>Date: ${escapeHTML(record.date)}<br>Time In: ${escapeHTML(record.timeIn || "—")}<br>Time Out: ${escapeHTML(record.timeOut || "—")}</div>${actionButton}`;
}

async function openCamera(action) {
  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.id = "cameraModal";
  modal.innerHTML = `<div class="modal-card"><h2>Selfie for Time ${action === "in" ? "In" : "Out"}</h2><p class="muted">Center your face in the frame and capture a clear photo. Your photo will be stored for admin review.</p><div class="camera"><span class="camera-label">LIVE CAMERA</span><video id="video" autoplay playsinline></video><canvas id="canvas"></canvas></div><div id="verifyStatus" class="status">Starting camera…</div><div class="actions"><button class="btn secondary" onclick="closeCamera()">Cancel</button><button id="captureBtn" class="btn primary" disabled onclick="captureSelfie('${action}')">Capture &amp; Submit</button></div></div>`;
  document.body.appendChild(modal);
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    $("#video").srcObject = state.stream;
    $("#verifyStatus").textContent = "Camera ready. Make sure your face is clearly visible.";
    $("#captureBtn").disabled = false;
  } catch (err) {
    $("#verifyStatus").className = "status error";
    $("#verifyStatus").textContent = `Camera access failed: ${err.message}`;
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
  }
}

function closeCamera() {
  stopCamera();
  $("#cameraModal")?.remove();
}

function captureSelfie(action) {
  const video = $("#video");
  const canvas = $("#canvas");
  const context = canvas.getContext("2d");
  canvas.width = 640;
  canvas.height = Math.round(640 * (video.videoHeight || 480) / (video.videoWidth || 640));
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const selfie = canvas.toDataURL("image/jpeg", 0.65);
  $("#verifyStatus").textContent = "Saving your attendance and photo…";
  $("#captureBtn").disabled = true;
  void submitPunch(action, selfie);
}

async function submitPunch(action, selfie) {
  try {
    const result = await rpc({ action: "punch", employeeId: state.employee.employee_id, punch: action, selfie });
    state.record = result.record;
    closeCamera();
    render();
    toast(action === "in" ? "Time In recorded" : "Time Out recorded");
  } catch (err) {
    const status = $("#verifyStatus");
    const button = $("#captureBtn");
    if (status) {
      status.className = "status error";
      status.textContent = `Could not save attendance: ${err.message}`;
    }
    if (button) button.disabled = false;
  }
}

function adminPage() {
  if (!state.adminToken) {
    return `<section class="hero"><div class="muted">Restricted Area</div><h1>Admin Login</h1><p class="muted">Enter the administrator password configured in Apps Script.</p></section>
      <section class="card kiosk">${apiNotConfigured()}
        <div class="field"><label>ADMIN PASSWORD</label><input id="adminPassword" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')adminLogin()"></div>
        <div id="adminError" class="status error" style="display:none"></div>
        <div class="actions"><button class="btn primary" onclick="adminLogin()">Login</button></div>
      </section>`;
  }
  const today = state.todayDate || new Date().toISOString().slice(0, 10);
  const todayCount = state.records.filter(record => record.date === today).length;
  return `<section class="hero"><div class="muted">Administration</div><h1>Attendance Dashboard</h1><p class="muted">Shared records refresh automatically every 15 seconds.</p></section>
    <div class="grid"><div class="card"><div class="muted">Today's Records</div><div id="todayCount" class="stat">${todayCount}</div></div><div class="card"><div class="muted">All Records</div><div id="allCount" class="stat">${state.records.length}</div></div></div>
    <section class="card records"><h2>Employees</h2><p class="muted">Upload or replace profile pictures, or open an employee's attendance history.</p><div id="employeeDirectory"></div></section>
    <section id="employeeSummary" class="card records" hidden></section>
    <section class="card records"><div class="toolbar"><div class="field"><label>SEARCH</label><input id="adminSearch" oninput="renderTable()" placeholder="Employee ID or name"></div><div><button class="btn secondary" onclick="showAllAttendance()">Show all</button></div><div><button class="btn secondary" onclick="refreshAdmin()">Refresh</button></div><div><button class="btn secondary" onclick="adminLogout()">Logout</button></div></div><div class="table-wrap"><div id="adminTable"></div></div></section>
    <input id="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden onchange="handleProfilePhotoUpload(this)">`;
}

async function adminLogin() {
  const password = $("#adminPassword")?.value;
  const error = $("#adminError");
  if (!password || !window.DTR_GAS_URL) {
    if (error) {
      error.textContent = !window.DTR_GAS_URL ? "Google Sheets connection is not configured." : "Enter the admin password.";
      error.style.display = "block";
    }
    return;
  }
  try {
    const result = await rpc({ action: "adminLogin", password });
    state.adminToken = result.token;
    state.records = result.records;
    state.employees = Array.isArray(result.employees) ? result.employees : [];
    state.employeeDirectoryAvailable = Array.isArray(result.employees);
    state.todayDate = result.today;
    render();
    state.refreshInterval = window.setInterval(() => void refreshAdmin(), 15000);
  } catch (err) {
    if (error) {
      error.textContent = err.message;
      error.style.display = "block";
    }
  }
}

async function refreshAdmin() {
  if (!state.adminToken) return;
  try {
    const result = await rpc({ action: "adminRecords", token: state.adminToken });
    state.records = result.records;
    state.employees = Array.isArray(result.employees) ? result.employees : [];
    state.employeeDirectoryAvailable = Array.isArray(result.employees);
    state.todayDate = result.today;
    updateAdminDashboard();
  } catch (err) {
    if (err.message.includes("Admin session expired")) {
      adminLogout();
      toast("Admin session expired. Please sign in again.");
      return;
    }
    toast(`Could not refresh attendance: ${err.message}`);
  }
}

function updateAdminDashboard() {
  const today = state.todayDate || new Date().toISOString().slice(0, 10);
  if ($("#todayCount")) $("#todayCount").textContent = state.records.filter(record => record.date === today).length;
  if ($("#allCount")) $("#allCount").textContent = state.records.length;
  renderTable();
  renderEmployeeDirectory();
  renderEmployeeSummary();
}

function parseTimeSeconds(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(String(value || "").trim());
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
}

function formatTime12Hour(value) {
  const seconds = parseTimeSeconds(value);
  if (seconds === null) return value || "—";
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor(seconds % 3600 / 60);
  const second = seconds % 60;
  const hour12 = hour % 12 || 12;
  const period = hour < 12 ? "AM" : "PM";
  return `${hour12}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")} ${period}`;
}

function formatAttendanceDuration(record) {
  if (!record.timeIn) return "—";
  if (!record.timeOut) return "Ongoing";
  const start = parseTimeSeconds(record.timeIn);
  const end = parseTimeSeconds(record.timeOut);
  if (start === null || end === null || end < start) return "—";
  const totalMinutes = Math.floor((end - start) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function durationMinutes(record) {
  if (!record.timeIn || !record.timeOut) return 0;
  const start = parseTimeSeconds(record.timeIn);
  const end = parseTimeSeconds(record.timeOut);
  return start === null || end === null || end < start ? 0 : Math.floor((end - start) / 60);
}

function formatDurationMinutes(totalMinutes) {
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

function renderTable() {
  const table = $("#adminTable");
  if (!table) return;
  const query = ($("#adminSearch")?.value || "").toLowerCase();
  const rows = state.records.map((record, index) => ({ record, index })).filter(({ record }) => {
    const employeeMatches = !state.selectedEmployeeId || record.employeeId === state.selectedEmployeeId;
    const queryMatches = !query || record.employeeId.toLowerCase().includes(query)
      || record.employeeName.toLowerCase().includes(query);
    return employeeMatches && queryMatches;
  });
  table.innerHTML = rows.length
    ? `<table class="table"><thead><tr><th>Employee</th><th>Date</th><th>Time In</th><th>Time In Photo</th><th>Time Out</th><th>Time Out Photo</th><th>Total Hours</th></tr></thead><tbody>${rows.map(({ record, index }) => `<tr><td><strong>${escapeHTML(record.employeeName)}</strong><br><span class="muted">${escapeHTML(record.employeeId)}</span></td><td>${escapeHTML(record.date)}</td><td>${escapeHTML(formatTime12Hour(record.timeIn))}</td><td>${record.timeInPhoto ? `<button class="btn secondary" onclick="viewPhoto(${index},'in')">View photo</button>` : "—"}</td><td>${escapeHTML(formatTime12Hour(record.timeOut))}</td><td>${record.timeOutPhoto ? `<button class="btn secondary" onclick="viewPhoto(${index},'out')">View photo</button>` : "—"}</td><td>${escapeHTML(formatAttendanceDuration(record))}</td></tr>`).join("")}</tbody></table>`
    : `<div class="empty">No attendance records yet.</div>`;
}

function renderEmployeeDirectory() {
  const directory = $("#employeeDirectory");
  if (!directory) return;
  directory.innerHTML = !state.employeeDirectoryAvailable
    ? `<div class="status error">Employee management data is unavailable from the current Apps Script version. Attendance records can still be viewed below. Update Apps Script with the latest Code.gs and deploy a new version to enable employee profiles and history.</div>`
    : state.employees.length
    ? `<div class="table-wrap"><table class="table"><thead><tr><th>Employee</th><th>Department</th><th>Profile picture</th><th>Attendance days</th><th>Completed</th><th>Ongoing</th><th>Total time</th><th>History</th></tr></thead><tbody>${state.employees.map((employee, index) => {
      const attendance = summarizeEmployee(employee.employeeId);
      return `<tr><td><strong>${escapeHTML(employee.name)}</strong><br><span class="muted">${escapeHTML(employee.employeeId)}</span></td><td>${escapeHTML(employee.department)}</td><td>${employee.hasProfilePhoto ? `Picture added <button class="btn secondary" data-profile-index="${index}" data-action="view-profile">View</button>` : "No picture"} <button class="btn secondary" data-profile-index="${index}" data-action="upload-profile">Upload / Replace</button></td><td>${attendance.days}</td><td>${attendance.completed}</td><td>${attendance.ongoing}</td><td>${formatDurationMinutes(attendance.totalMinutes)}</td><td><button class="btn secondary" data-profile-index="${index}" data-action="view-attendance">${state.selectedEmployeeId === employee.employeeId ? "Viewing" : "View days"}</button></td></tr>`;
    }).join("")}</tbody></table></div>`
    : `<div class="empty">No employees in the Employees sheet.</div>`;
  directory.querySelectorAll("button[data-profile-index]").forEach(button => {
    button.addEventListener("click", () => {
      const employee = state.employees[Number(button.dataset.profileIndex)];
      if (!employee) return;
      if (button.dataset.action === "view-attendance") {
        state.selectedEmployeeId = state.selectedEmployeeId === employee.employeeId ? "" : employee.employeeId;
        renderEmployeeSummary();
        renderEmployeeDirectory();
        renderTable();
      } else if (button.dataset.action === "upload-profile") {
        state.pendingPhotoEmployeeId = employee.employeeId;
        $("#profilePhotoInput")?.click();
      } else if (button.dataset.action === "view-profile") {
        void viewProfilePhoto(employee);
      }
    });
  });
}

function summarizeEmployee(employeeId) {
  const records = state.records.filter(record => record.employeeId === employeeId);
  const completedRecords = records.filter(record => record.timeIn && record.timeOut);
  return {
    days: records.length,
    completed: completedRecords.length,
    ongoing: records.filter(record => record.timeIn && !record.timeOut).length,
    totalMinutes: completedRecords.reduce((total, record) => total + durationMinutes(record), 0),
  };
}

function renderEmployeeSummary() {
  const summary = $("#employeeSummary");
  if (!summary) return;
  const employee = state.employees.find(item => item.employeeId === state.selectedEmployeeId);
  if (!employee) {
    summary.innerHTML = "";
    summary.hidden = true;
    return;
  }
  const records = state.records.filter(record => record.employeeId === employee.employeeId);
  const completed = records.filter(record => record.timeIn && record.timeOut);
  const ongoing = records.filter(record => record.timeIn && !record.timeOut).length;
  const minutes = completed.reduce((total, record) => total + durationMinutes(record), 0);
  summary.hidden = false;
  summary.innerHTML = `<h2>${escapeHTML(employee.name)} — Attendance Summary</h2><div class="grid summary-grid"><div class="info"><small>Attendance days</small><strong>${records.length}</strong></div><div class="info"><small>Completed days</small><strong>${completed.length}</strong></div><div class="info"><small>Ongoing</small><strong>${ongoing}</strong></div><div class="info"><small>Total completed time</small><strong>${formatDurationMinutes(minutes)}</strong></div></div><p class="muted small">All recorded attendance days for ${escapeHTML(employee.employeeId)} are shown below.</p>`;
}

function showAllAttendance() {
  state.selectedEmployeeId = "";
  const search = $("#adminSearch");
  if (search) search.value = "";
  renderEmployeeDirectory();
  renderEmployeeSummary();
  renderTable();
}

async function handleProfilePhotoUpload(input) {
  const file = input.files?.[0];
  const employeeId = state.pendingPhotoEmployeeId;
  input.value = "";
  state.pendingPhotoEmployeeId = "";
  if (!file || !employeeId) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    toast("Choose a JPEG, PNG, or WebP image.");
    return;
  }
  try {
    const dataUrl = await resizeProfilePhoto(file);
    await rpc({ action: "adminUploadProfilePhoto", token: state.adminToken, employeeId, selfie: dataUrl });
    const employee = state.employees.find(item => item.employeeId === employeeId);
    if (employee) employee.hasProfilePhoto = true;
    renderEmployeeDirectory();
    toast("Employee profile picture saved");
  } catch (err) {
    toast(`Could not upload profile picture: ${err.message}`);
  }
}

function resizeProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected image could not be opened."));
    };
    image.src = objectUrl;
  });
}

async function viewProfilePhoto(employee) {
  try {
    const result = await rpc({
      action: "adminProfilePhoto",
      token: state.adminToken,
      employeeId: employee.employeeId,
    });
    if (!result.dataUrl) {
      toast("This employee does not have a profile picture yet.");
      return;
    }
    const modal = document.createElement("div");
    modal.className = "modal show";
    modal.id = "photoModal";
    modal.innerHTML = `<section class="modal-card face-preview-card" role="dialog" aria-modal="true"><div class="face-preview-header"><div><h2>Employee Profile Picture</h2><p class="muted">${escapeHTML(employee.name)} · ${escapeHTML(employee.employeeId)}</p></div><button class="btn secondary" onclick="closePhoto()">Close</button></div><img class="face-preview-image profile-photo-preview" src="${escapeHTML(result.dataUrl)}" alt="Profile picture for ${escapeHTML(employee.name)}"></section>`;
    modal.addEventListener("click", event => {
      if (event.target === modal) closePhoto();
    });
    document.body.appendChild(modal);
  } catch (err) {
    toast(`Could not load profile picture: ${err.message}`);
  }
}

async function viewPhoto(index, punch) {
  const record = state.records[index];
  try {
    const result = await rpc({ action: "adminPhoto", token: state.adminToken, employeeId: record.employeeId, date: record.date, punch });
    const modal = document.createElement("div");
    modal.className = "modal show";
    modal.id = "photoModal";
    modal.innerHTML = `<section class="modal-card face-preview-card" role="dialog" aria-modal="true"><div class="face-preview-header"><div><h2>${punch === "in" ? "Time In" : "Time Out"} Photo</h2><p class="muted">${escapeHTML(record.employeeName)} · ${escapeHTML(record.date)} · ${escapeHTML(formatTime12Hour(punch === "in" ? record.timeIn : record.timeOut))}</p></div><button class="btn secondary" onclick="closePhoto()">Close</button></div><img class="face-preview-image" src="${result.dataUrl}" alt="${punch === "in" ? "Time In" : "Time Out"} selfie for ${escapeHTML(record.employeeName)}"></section>`;
    modal.addEventListener("click", event => {
      if (event.target === modal) closePhoto();
    });
    document.body.appendChild(modal);
  } catch (err) {
    toast(`Could not load photo: ${err.message}`);
  }
}

function closePhoto() {
  $("#photoModal")?.remove();
}

function stopRefreshing() {
  if (state.refreshInterval) {
    window.clearInterval(state.refreshInterval);
    state.refreshInterval = null;
  }
}

function adminLogout() {
  closePhoto();
  stopRefreshing();
  state.adminToken = null;
  state.records = [];
  render();
}

function rpc(payload) {
  if (!window.DTR_GAS_URL) return Promise.reject(new Error("Apps Script web-app URL is not configured."));
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const frame = document.createElement("iframe");
    frame.name = `dtr-request-${requestId}`;
    frame.title = "DTR request";
    frame.hidden = true;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = window.DTR_GAS_URL;
    form.target = frame.name;
    form.hidden = true;
    const input = document.createElement("input");
    input.name = "payload";
    input.value = JSON.stringify({ ...payload, requestId });
    form.appendChild(input);
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
      form.remove();
      frame.remove();
    };
    const onMessage = event => {
      if (event.data?.requestId !== requestId) return;
      cleanup();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error || "The Google Sheets request failed."));
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Google Apps Script did not respond. Check the deployment and permissions."));
    }, 30000);
    window.addEventListener("message", onMessage);
    document.body.append(frame, form);
    form.submit();
  });
}

function toast(message) {
  const element = $("#toast");
  if (!element) return;
  element.textContent = message;
  element.style.display = "block";
  window.setTimeout(() => {
    element.style.display = "none";
  }, 3500);
}

render();
