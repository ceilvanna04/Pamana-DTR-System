const EMPLOYEES=[
{id:"PMPI-2026-0003",name:"Nash Mhelmar Donasco",department:"Printing Staff",position:"Part-time Printing Staff"},
{id:"PMPI-2026-0005",name:"Jian Carreon",department:"Printing Staff",position:"Part-time Printing Staff"},
{id:"PMPI-2026-0004",name:"Alex Reyes",department:"Printing Staff",position:"Part-time Printing Staff"},
];

let state={page:"employee",employee:null,stream:null,adminLoggedIn:false};
let clockInterval;
const ADMIN_USERNAME="PamanaMedia&PublishingInc2026";
const ADMIN_PASSWORD="P@manaM3d1a2026";

const $=s=>document.querySelector(s);
const today=()=>new Date().toISOString().slice(0,10);
const timeNow=()=>new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
const records=()=>JSON.parse(localStorage.getItem("dtr_records")||"[]");
const saveRecords=r=>localStorage.setItem("dtr_records",JSON.stringify(r));

function employeePage(){
 return `<section class="hero"><div class="muted">Daily attendance</div><h1>Daily Time Record</h1><p class="muted">Record your work hours quickly and securely.</p><div id="clock" class="clock"></div><div class="muted">${new Date().toLocaleDateString()}</div></section>
 <section class="card kiosk">${state.employee?employeeCard():lookupCard()}</section>`;
}
function updateClock(){
 const tick=()=>{const clock=$("#clock");if(clock)clock.textContent=timeNow()};
 tick();
 if(!clockInterval)clockInterval=setInterval(tick,1000);
}

function render(){
 document.querySelector("#app").innerHTML=`
 <div class="shell">
  <header class="topbar">
   <div class="brand">DTR System</div>
   <nav class="nav">
    <button class="${state.page==="employee"?"active":""}" onclick="setPage('employee')">Employee</button>
    <button class="${state.page==="admin"?"active":""}" onclick="setPage('admin')">Admin</button>
   </nav>
  </header>
  <main class="main">${state.page==="employee"?employeePage():state.page==="adminLogin"?adminLoginPage():adminPage()}</main>
  <div id="toast" class="toast"></div>
 </div>`;
 if(state.page==="employee") updateClock();
}
function setPage(p){
 stopCamera();
 if(p==="admin" && !state.adminLoggedIn){
   state.page="adminLogin";
 } else {
   state.page=p;
 }
 state.employee=null;
 render();
}
function lookupCard(){
 return `<h2>Enter Employee ID</h2><p class="muted">Use your registered employee ID to retrieve your information.</p>
 <div class="field"><label>EMPLOYEE ID</label><input id="employeeId" placeholder="e.g. PMPI-XXXX-XXXX" autocomplete="off"></div>
 <div class="actions"><button class="btn primary" onclick="lookupEmployee()">Search Employee</button></div>
 <div class="status small">Please be aware that time ins and outs required photo for verification, otherwise non compliance will result to not record your DTR.</div>`;
}
function lookupEmployee(){
 const id=$("#employeeId").value.trim().toUpperCase();
 const emp=EMPLOYEES.find(e=>e.id===id);
 if(!emp){toast("Employee ID not found");return}
 state.employee=emp;render();
}
function employeeCard(){
 const rec=records().find(r=>r.employeeId===state.employee.id&&r.date===today());
 return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><div><h2 style="margin:0">${state.employee.name}</h2><p class="muted">${state.employee.id}</p></div><button class="btn secondary" onclick="clearEmployee()">Change ID</button></div>
 <div class="profile">
  <div class="info"><small>Department</small><strong>${state.employee.department}</strong></div>
  <div class="info"><small>Position</small><strong>${state.employee.position}</strong></div>
 </div>
 ${rec?recordActions(rec):`<div class="status">Identity verification is required before Time In.</div><div class="actions"><button class="btn primary" onclick="openCamera('in')">Verify & Time In</button></div>`}`;
}
function recordActions(rec){
 let buttons="";
 if(!rec.breakOut)buttons+=`<button class="btn secondary" onclick="openCamera('breakOut')">Break Out</button>`;
 else if(!rec.breakIn)buttons+=`<button class="btn secondary" onclick="openCamera('breakIn')">Break In</button>`;
 else if(!rec.timeOut)buttons+=`<button class="btn primary" onclick="openCamera('out')">Verify & Time Out</button>`;
 return `<div class="status ok"><strong>Today's attendance</strong><br>Time In: ${rec.timeIn||"—"}<br>Break Out: ${rec.breakOut||"—"}<br>Break In: ${rec.breakIn||"—"}<br>Time Out: ${rec.timeOut||"—"}</div>
 <div class="actions">${buttons||`<button class="btn secondary" onclick="clearEmployee()">Done</button>`}</div>`;
}
function clearEmployee(){stopCamera();state.employee=null;render();}

async function openCamera(action){
 const modal=document.createElement("div");
 modal.className="modal show";modal.id="cameraModal";
 modal.innerHTML=`<div class="modal-card"><h2>Identity Verification</h2><p class="muted">Position your face inside the camera frame, then capture a selfie. This demo checks camera access and face presence only.</p><div class="camera"><span class="camera-label">LIVE CAMERA</span><video id="video" autoplay playsinline></video><canvas id="canvas"></canvas></div><div id="verifyStatus" class="status">Starting camera…</div><div class="actions"><button class="btn secondary" onclick="closeCamera()">Cancel</button><button id="captureBtn" class="btn primary" disabled onclick="captureSelfie('${action}')">Capture & Verify</button></div></div>`;
 document.body.appendChild(modal);
 try{
  state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});
  $("#video").srcObject=state.stream;
  $("#verifyStatus").textContent="Camera ready. Make sure your face is clearly visible.";
  $("#captureBtn").disabled=false;
 }catch(e){
  $("#verifyStatus").className="status error";
  $("#verifyStatus").textContent="Camera access was blocked or unavailable. Allow camera permission and try again.";
 }
}
function stopCamera(){if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null}}
function closeCamera(){stopCamera();$("#cameraModal")?.remove()}
function captureSelfie(action){
 const video=$("#video"),canvas=$("#canvas"),ctx=canvas.getContext("2d");
 canvas.width=video.videoWidth||640;canvas.height=video.videoHeight||480;ctx.drawImage(video,0,0,canvas.width,canvas.height);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 let bright=0;for(let i=0;i<pixels.length;i+=16){bright+=pixels[i]+pixels[i+1]+pixels[i+2]}
 const avg=bright/(pixels.length/16*3);
 if(avg<25){$("#verifyStatus").className="status error";$("#verifyStatus").textContent="The image is too dark. Move to a brighter area and try again.";return}
 $("#verifyStatus").className="status";$("#verifyStatus").textContent="Selfie captured. Completing demo verification…";
 $("#captureBtn").disabled=true;
 const selfieData=canvas.toDataURL("image/jpeg",0.75);
 setTimeout(()=>completeAction(action,selfieData),900);
}
function completeAction(action,selfieData){
 const id=state.employee.id,r=records(),i=r.findIndex(x=>x.employeeId===id&&x.date===today());
 let rec=i>=0?r[i]:{employeeId:id,date:today()};
 const t=timeNow();
 if(action==="in"){rec.timeIn=t;rec.timeInSelfie=selfieData||null;}
 if(action==="breakOut")rec.breakOut=t;
 if(action==="breakIn")rec.breakIn=t;
 if(action==="out")rec.timeOut=t;
 if(i>=0)r[i]=rec;else r.push(rec);
 saveRecords(r);closeCamera();render();
 toast(action==="in"?"Time In recorded":action==="out"?"Time Out recorded":"Attendance updated");
}
function adminLoginPage(){
 return `<section class="hero"><div class="muted">Restricted Area</div><h1>Admin Login</h1><p class="muted">Authorized personnel only.</p></section>
 <section class="card kiosk">
   <div class="field"><label>USERNAME</label><input id="adminUsername" autocomplete="username" placeholder="Enter admin username"></div>
   <div class="field" style="margin-top:14px"><label>PASSWORD</label><input id="adminPassword" type="password" autocomplete="current-password" placeholder="Enter admin password" onkeydown="if(event.key==='Enter')adminLogin()"></div>
   <div id="loginError" class="status error" style="display:none">Invalid username or password.</div>
   <div class="actions">
     <button class="btn secondary" onclick="setPage('employee')">Back to Employee</button>
     <button class="btn primary" onclick="adminLogin()">Login</button>
   </div>
   <div class="status small">Are you sure you're and admin?<strong></strong><strong></strong>. Please go back to Employee page if you're not an admin.</div>
 </section>`;
}
function adminLogin(){
 const u=$("#adminUsername").value.trim();
 const p=$("#adminPassword").value;
 if(u===ADMIN_USERNAME && p===ADMIN_PASSWORD){
   state.adminLoggedIn=true;
   state.page="admin";
   render();
   toast("Admin login successful");
 }else{
   $("#loginError").style.display="block";
 }
}
function adminLogout(){
 state.adminLoggedIn=false;
 state.page="employee";
 state.employee=null;
 render();
 toast("Admin logged out");
}

function adminPage(){
 if(!state.adminLoggedIn){state.page="adminLogin";return adminLoginPage()}
 const r=records();
 const todayCount=r.filter(x=>x.date===today()).length;
 return `<section class="hero"><div class="muted">Administration</div><h1>Attendance Dashboard</h1><p class="muted">Local demo records stored in this browser.</p></section>
 <div class="grid"><div class="card"><div class="muted">Employees</div><div class="stat">${EMPLOYEES.length}</div></div><div class="card"><div class="muted">Today's Records</div><div class="stat">${todayCount}</div></div><div class="card"><div class="muted">All Records</div><div class="stat">${r.length}</div></div></div>
 <section class="card records"><div class="toolbar"><div class="field"><label>SEARCH</label><input id="adminSearch" oninput="renderTable()" placeholder="Employee ID or name"></div><div><button class="btn secondary" onclick="exportCSV()">Export CSV</button></div><div><button class="btn danger" onclick="clearAllRecords()">Clear Demo Data</button></div><div><button class="btn secondary" onclick="adminLogout()">Logout</button></div></div><div class="table-wrap"><div id="adminTable"></div></div></section>`;
}
function renderTable(){
 const q=($("#adminSearch")?.value||"").toLowerCase();
 const rows=records().map((record,index)=>({record,index})).filter(({record:x})=>{const e=EMPLOYEES.find(a=>a.id===x.employeeId);return !q||x.employeeId.toLowerCase().includes(q)||(e?.name||"").toLowerCase().includes(q)});
 if(!$("#adminTable"))return;
 $("#adminTable").innerHTML=rows.length?`<table class="table"><thead><tr><th>Employee / Captured Face</th><th>Date</th><th>Time In</th><th>Break Out</th><th>Break In</th><th>Time Out</th></tr></thead><tbody>${rows.sort((a,b)=>(b.record.date+b.record.timeIn).localeCompare(a.record.date+a.record.timeIn)).map(({record:x,index})=>{const e=EMPLOYEES.find(a=>a.id===x.employeeId);return `<tr><td><div class="employee-cell">${x.timeInSelfie?`<button class="face-preview-trigger" onclick="openFacePreview(${index})" aria-label="View captured photo for ${e?.name||x.employeeId}"><img class="face-thumb" src="${x.timeInSelfie}" alt="" loading="lazy"></button>`:`<div class="face-placeholder">No face</div>`}<div><strong>${e?.name||x.employeeId}</strong><br><span class="muted">${x.employeeId}</span></div></div></td><td>${x.date}</td><td>${x.timeIn||"—"}</td><td>${x.breakOut||"—"}</td><td>${x.breakIn||"—"}</td><td>${x.timeOut||"—"}</td></tr>`}).join("")}</tbody></table>`:`<div class="empty">No attendance records yet.</div>`;
}
function openFacePreview(recordIndex){
 const record=records()[recordIndex];
 if(!record?.timeInSelfie)return;
 const employee=EMPLOYEES.find(item=>item.id===record.employeeId);
 const modal=document.createElement("div");
 modal.className="modal show";
 modal.id="facePreviewModal";
 modal.innerHTML=`<section class="modal-card face-preview-card" role="dialog" aria-modal="true" aria-labelledby="facePreviewTitle"><div class="face-preview-header"><div><h2 id="facePreviewTitle">Captured Time In Photo</h2><p class="muted">${employee?.name||record.employeeId} · ${record.date}</p></div><button class="btn secondary" onclick="closeFacePreview()" aria-label="Close photo preview">Close</button></div><img class="face-preview-image" src="${record.timeInSelfie}" alt="Captured Time In photo for ${employee?.name||record.employeeId}"><p class="status small">For visual review only. This photo does not verify the employee's identity.</p></section>`;
 modal.addEventListener("click",event=>{if(event.target===modal)closeFacePreview()});
 document.body.appendChild(modal);
}
function closeFacePreview(){$("#facePreviewModal")?.remove()}
function exportCSV(){
 const rows=records();if(!rows.length){toast("No records to export");return}
 const head=["Employee ID","Date","Time In","Break Out","Break In","Time Out"];
 const body=rows.map(x=>[x.employeeId,x.date,x.timeIn||"",x.breakOut||"",x.breakIn||"",x.timeOut||""]);
 const csv=[head,...body].map(a=>a.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
 const blob=new Blob([csv],{type:"text/csv"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="dtr-records.csv";a.click();URL.revokeObjectURL(url);
}
function clearAllRecords(){if(confirm("Delete all demo attendance records from this browser?")){localStorage.removeItem("dtr_records");render();toast("Demo records cleared")}}
function toast(msg){const t=$("#toast");if(!t)return;t.textContent=msg;t.style.display="block";setTimeout(()=>t.style.display="none",2200)}
render();
if(state.page==="admin")renderTable();
const originalRender=render;
window.render=()=>{originalRender();if(state.page==="admin")renderTable()};
