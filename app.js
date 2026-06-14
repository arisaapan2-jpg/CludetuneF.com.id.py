// ===== CONFIG =====
const OWNER_USERNAME = "owner"; // Ganti username owner kamu di sini
const API_KEY = ""; // Kosongkan, pakai proxy Anthropic otomatis

// ===== STORAGE HELPERS =====
function getUsers() { return JSON.parse(localStorage.getItem("cnf_users") || "{}"); }
function saveUsers(u) { localStorage.setItem("cnf_users", JSON.stringify(u)); }
function getLogs() { return JSON.parse(localStorage.getItem("cnf_logs") || "[]"); }
function saveLogs(l) { localStorage.setItem("cnf_logs", JSON.stringify(l)); }
function getBanned() { return JSON.parse(localStorage.getItem("cnf_banned") || "[]"); }
function saveBanned(b) { localStorage.setItem("cnf_banned", JSON.stringify(b)); }
function getHistory(user) { return JSON.parse(localStorage.getItem("cnf_hist_" + user) || "[]"); }
function saveHistory(user, h) { localStorage.setItem("cnf_hist_" + user, JSON.stringify(h)); }
function getKicked() { return JSON.parse(localStorage.getItem("cnf_kicked") || "[]"); }
function saveKicked(k) { localStorage.setItem("cnf_kicked", JSON.stringify(k)); }

// ===== STATE =====
let currentUser = null;
let chatHistory = []; // [{role, content}]
let pendingFile = null;
let pendingFileType = null;
let pendingFileName = null;

// ===== AUTH =====
function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");
  document.getElementById("loginForm").classList.toggle("hidden", tab !== "login");
  document.getElementById("registerForm").classList.toggle("hidden", tab !== "register");
}

function register() {
  const u = document.getElementById("regUser").value.trim();
  const p = document.getElementById("regPass").value;
  const p2 = document.getElementById("regPass2").value;
  const err = document.getElementById("regError");

  if (!u || !p) return err.textContent = "Username dan password wajib diisi!";
  if (u.length < 3) return err.textContent = "Username minimal 3 karakter!";
  if (p.length < 4) return err.textContent = "Password minimal 4 karakter!";
  if (p !== p2) return err.textContent = "Password tidak cocok!";

  const users = getUsers();
  if (users[u]) return err.textContent = "Username sudah dipakai!";

  users[u] = { password: btoa(p), joined: new Date().toISOString(), msgCount: 0 };
  saveUsers(users);
  err.textContent = "";
  err.style.color = "#22c55e";
  err.textContent = "Berhasil daftar! Silakan masuk.";
  setTimeout(() => {
    err.style.color = "";
    err.textContent = "";
    document.querySelector(".tab-btn").click();
  }, 1200);
}

function login() {
  const u = document.getElementById("loginUser").value.trim();
  const p = document.getElementById("loginPass").value;
  const err = document.getElementById("loginError");

  if (!u || !p) return err.textContent = "Isi username dan password!";

  const users = getUsers();
  if (!users[u]) return err.textContent = "Username tidak ditemukan!";
  if (users[u].password !== btoa(p)) return err.textContent = "Password salah!";

  const banned = getBanned();
  if (banned.includes(u)) return err.textContent = "Akun kamu telah dibanned permanen!";

  const kicked = getKicked();
  const kickIdx = kicked.findIndex(k => k.user === u);
  if (kickIdx !== -1) {
    const kickTime = new Date(kicked[kickIdx].until);
    if (new Date() < kickTime) {
      return err.textContent = `Kamu di-kick sampai ${kickTime.toLocaleString("id-ID")}`;
    } else {
      kicked.splice(kickIdx, 1);
      saveKicked(kicked);
    }
  }

  // Log activity
  const logs = getLogs();
  logs.unshift({ user: u, action: "login", time: new Date().toISOString() });
  if (logs.length > 200) logs.splice(200);
  saveLogs(logs);

  // Update last seen
  users[u].lastSeen = new Date().toISOString();
  saveUsers(users);

  currentUser = u;
  chatHistory = getHistory(u);

  document.getElementById("usernameDisplay").textContent = u;
  document.getElementById("authScreen").classList.remove("active");
  document.getElementById("chatScreen").classList.add("active");

  loadChatHistory();
}

function logout() {
  if (!confirm("Yakin mau keluar?")) return;
  currentUser = null;
  chatHistory = [];
  pendingFile = null;
  document.getElementById("chatMessages").innerHTML = `
    <div class="msg ai-msg">
      <div class="msg-bubble">
        Halo! Aku <b>CludenateF</b> 🤖<br>
        AI super cerdas yang bisa bantu kamu di semua bidang:<br>
        📚 Pelajaran sekolah/kuliah<br>
        💻 Coding JS, Python, dan lainnya<br>
        🎯 Analisa, esai, matematika, sains<br><br>
        Ketik apa saja, aku siap membantu!
      </div>
      <div class="msg-time">CludenateF</div>
    </div>`;
  document.getElementById("msgInput").value = "";
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
  document.getElementById("loginError").textContent = "";
  document.getElementById("chatScreen").classList.remove("active");
  document.getElementById("authScreen").classList.add("active");
}

// ===== LOAD HISTORY =====
function loadChatHistory() {
  const box = document.getElementById("chatMessages");
  box.innerHTML = `
    <div class="msg ai-msg">
      <div class="msg-bubble">
        Halo <b>${currentUser}</b>! Selamat datang kembali 👋<br>
        Aku <b>CludenateF</b>, siap membantu kamu!<br>
        Ketik <code>/help</code> untuk daftar perintah.
      </div>
      <div class="msg-time">CludenateF</div>
    </div>`;
  // Don't re-render old messages to keep it clean; history is for API context only
}

// ===== OWNER COMMANDS =====
function handleOwnerCommand(text) {
  const lower = text.toLowerCase().trim();

  if (lower === "/ownertolls" || lower === "/owner") {
    openOwnerPanel();
    return true;
  }

  if (lower === "/riwayat") {
    showRiwayat();
    return true;
  }

  if (lower === "/help") {
    appendMsg("ai", `📋 <b>Daftar Perintah:</b><br>
<code>/riwayat</code> — Lihat riwayat pengguna<br>
<code>/ownertolls</code> — Buka panel owner (khusus owner)<br>
<code>/kick [username]</code> — Kick user sementara (owner)<br>
<code>/kickban [username]</code> — Kick permanen (owner)<br>
<code>/stats</code> — Statistik penggunaan<br><br>
Atau tanya apa saja ke aku! 😊`);
    return true;
  }

  if (lower.startsWith("/kick ") && currentUser === OWNER_USERNAME) {
    const target = text.slice(6).trim();
    doKick(target, false);
    return true;
  }

  if (lower.startsWith("/kickban ") && currentUser === OWNER_USERNAME) {
    const target = text.slice(9).trim();
    doKick(target, true);
    return true;
  }

  if (lower === "/stats") {
    const users = getUsers();
    const logs = getLogs();
    const banned = getBanned();
    const count = Object.keys(users).length;
    const todayLogs = logs.filter(l => new Date(l.time).toDateString() === new Date().toDateString());
    appendMsg("system", `📊 <b>Statistik CludenateF:</b><br>
👤 Total pengguna: ${count}<br>
🚫 Dibanned: ${banned.length}<br>
📅 Login hari ini: ${todayLogs.length}<br>
💬 Riwayat aktivitas: ${logs.length}`);
    return true;
  }

  return false;
}

function showRiwayat() {
  const logs = getLogs();
  const users = getUsers();

  if (logs.length === 0) {
    appendMsg("system", "📋 Belum ada riwayat pengguna.");
    return;
  }

  let html = "📋 <b>Riwayat Pengguna Terbaru:</b><br><br>";
  const shown = logs.slice(0, 15);
  shown.forEach(l => {
    const u = users[l.user];
    const time = new Date(l.time).toLocaleString("id-ID");
    html += `• <b>${l.user}</b> — ${l.action} — ${time}<br>`;
  });

  if (currentUser !== OWNER_USERNAME) {
    // Non-owner only sees public info
    html += "<br><i>💡 Login sebagai owner untuk info lebih lengkap.</i>";
  } else {
    html += `<br><b>Detail semua user (hanya owner):</b><br>`;
    Object.entries(users).forEach(([uname, data]) => {
      const lastSeen = data.lastSeen ? new Date(data.lastSeen).toLocaleString("id-ID") : "-";
      const joined = new Date(data.joined).toLocaleString("id-ID");
      html += `<br>👤 <b>${uname}</b><br>`;
      html += `&nbsp;&nbsp;Bergabung: ${joined}<br>`;
      html += `&nbsp;&nbsp;Terakhir aktif: ${lastSeen}<br>`;
      html += `&nbsp;&nbsp;Jumlah pesan: ${data.msgCount || 0}<br>`;
    });
  }

  appendMsg("system", html);
}

function doKick(target, permanent) {
  if (currentUser !== OWNER_USERNAME) {
    appendMsg("system", "⛔ Hanya owner yang bisa kick user!");
    return;
  }
  const users = getUsers();
  if (!users[target]) {
    appendMsg("system", `❌ User <b>${target}</b> tidak ditemukan!`);
    return;
  }
  if (target === OWNER_USERNAME) {
    appendMsg("system", "❌ Tidak bisa kick diri sendiri!");
    return;
  }

  if (permanent) {
    const banned = getBanned();
    if (!banned.includes(target)) banned.push(target);
    saveBanned(banned);
    appendMsg("system", `🚫 User <b>${target}</b> telah di-ban permanen!`);
  } else {
    const kicked = getKicked();
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 jam
    const idx = kicked.findIndex(k => k.user === target);
    if (idx !== -1) kicked[idx].until = until;
    else kicked.push({ user: target, until });
    saveKicked(kicked);
    appendMsg("system", `⏳ User <b>${target}</b> di-kick selama 24 jam!`);
  }

  // Log action
  const logs = getLogs();
  logs.unshift({ user: target, action: permanent ? "banned" : "kicked", time: new Date().toISOString(), by: OWNER_USERNAME });
  saveLogs(logs);
}

// ===== OWNER PANEL =====
function openOwnerPanel() {
  if (currentUser !== OWNER_USERNAME) {
    appendMsg("system", "⛔ Panel owner hanya bisa diakses oleh owner!");
    return;
  }
  const panel = document.getElementById("ownerPanel");
  const overlay = document.getElementById("overlay");
  panel.classList.remove("hidden");
  overlay.classList.remove("hidden");
  renderOwnerPanel();
}

function closeOwnerPanel() {
  document.getElementById("ownerPanel").classList.add("hidden");
  document.getElementById("overlay").classList.add("hidden");
}

function renderOwnerPanel() {
  const users = getUsers();
  const logs = getLogs();
  const banned = getBanned();

  // User list
  const ul = document.getElementById("userList");
  ul.innerHTML = "";
  Object.entries(users).forEach(([uname, data]) => {
    const isBanned = banned.includes(uname);
    const lastSeen = data.lastSeen ? new Date(data.lastSeen).toLocaleString("id-ID") : "Belum pernah";
    const div = document.createElement("div");
    div.className = "user-item" + (isBanned ? " banned" : "");
    div.innerHTML = `<div class="uname">${uname} ${isBanned ? "🚫" : "✅"}</div>
<div class="uinfo">Bergabung: ${new Date(data.joined).toLocaleDateString("id-ID")} • Aktif: ${lastSeen} • Pesan: ${data.msgCount || 0}</div>`;
    ul.appendChild(div);
  });

  // Stats
  const todayLogs = logs.filter(l => new Date(l.time).toDateString() === new Date().toDateString());
  document.getElementById("statsPanel").innerHTML = `
    <div class="stat-card"><div class="stat-num">${Object.keys(users).length}</div><div class="stat-label">Total User</div></div>
    <div class="stat-card"><div class="stat-num">${banned.length}</div><div class="stat-label">Dibanned</div></div>
    <div class="stat-card"><div class="stat-num">${todayLogs.length}</div><div class="stat-label">Login Hari Ini</div></div>
    <div class="stat-card"><div class="stat-num">${logs.length}</div><div class="stat-label">Total Aktivitas</div></div>`;
}

function kickUser(permanent) {
  const target = document.getElementById("kickUser").value.trim();
  if (!target) return alert("Masukkan username!");
  doKick(target, permanent);
  closeOwnerPanel();
}

// ===== FILE HANDLING =====
function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  pendingFileName = file.name;

  const reader = new FileReader();
  if (file.type.startsWith("image/")) {
    pendingFileType = "image";
    reader.onload = ev => {
      pendingFile = ev.target.result.split(",")[1];
      showFilePreview(`🖼 ${file.name}`);
    };
    reader.readAsDataURL(file);
  } else {
    pendingFileType = "text";
    reader.onload = ev => {
      pendingFile = ev.target.result;
      showFilePreview(`📄 ${file.name}`);
    };
    reader.readAsText(file);
  }
  e.target.value = "";
}

function showFilePreview(label) {
  const fp = document.getElementById("filePreview");
  fp.classList.remove("hidden");
  fp.innerHTML = `<span>${label}</span><span class="remove-file" onclick="removeFile()">✕</span>`;
}

function removeFile() {
  pendingFile = null;
  pendingFileType = null;
  pendingFileName = null;
  const fp = document.getElementById("filePreview");
  fp.classList.add("hidden");
  fp.innerHTML = "";
}

// ===== CHAT =====
function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

async function sendMessage() {
  const input = document.getElementById("msgInput");
  const text = input.value.trim();
  if (!text && !pendingFile) return;

  const msgText = text || (pendingFileName ? `[File: ${pendingFileName}]` : "");

  // Handle commands
  if (text && handleOwnerCommand(text)) {
    input.value = "";
    autoResize(input);
    return;
  }

  // Show user message
  if (pendingFileType === "image" && pendingFile) {
    appendMsg("user", text || "Tolong analisa gambar ini:", null, `data:image/jpeg;base64,${pendingFile}`);
  } else {
    appendMsg("user", msgText);
  }

  input.value = "";
  autoResize(input);

  // Update msg count
  const users = getUsers();
  if (users[currentUser]) {
    users[currentUser].msgCount = (users[currentUser].msgCount || 0) + 1;
    saveUsers(users);
  }

  // Log message activity
  const logs = getLogs();
  logs.unshift({ user: currentUser, action: "message", time: new Date().toISOString() });
  if (logs.length > 500) logs.splice(500);
  saveLogs(logs);

  // Build message for API
  let userContent;
  if (pendingFileType === "image" && pendingFile) {
    userContent = [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: pendingFile } },
      { type: "text", text: text || "Tolong analisa dan jelaskan gambar ini secara detail." }
    ];
  } else if (pendingFileType === "text" && pendingFile) {
    userContent = `[File: ${pendingFileName}]\n\n${pendingFile}\n\n${text || "Tolong analisa file ini."}`;
  } else {
    userContent = text;
  }

  // Add to history
  chatHistory.push({ role: "user", content: userContent });
  if (chatHistory.length > 30) chatHistory = chatHistory.slice(-30); // Keep last 30

  // Clear file
  const hadFile = !!pendingFile;
  removeFile();

  // Show typing
  const typingId = showTyping();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: `Kamu adalah CludenateF, AI asisten super cerdas dan ramah. Kamu sangat pintar dalam:
- Semua mata pelajaran: matematika, fisika, kimia, biologi, sejarah, geografi, ekonomi, dll
- Programming: JavaScript, Python, HTML, CSS, Java, C++, PHP, React, Node.js, dll
- Bahasa: Indonesia, Inggris, dan bahasa lainnya
- Analisa teks, esai, laporan, tugas sekolah/kuliah
- Logika, teka-teki, dan pemecahan masalah
- Penjelasan gambar, foto, dan dokumen

Kepribadianmu: cerdas, ramah, sabar, dan selalu berusaha memberikan jawaban yang lengkap dan mudah dipahami. Gunakan bahasa Indonesia yang baik dan santai. Kalau ada kode program, selalu tulis dalam blok kode yang rapi. Nama kamu adalah CludenateF dan jangan pernah menyebut nama model AI lain.`,
        messages: chatHistory
      })
    });

    removeTyping(typingId);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "API Error");
    }

    const data = await response.json();
    const reply = data.content.map(c => c.text || "").join("");

    chatHistory.push({ role: "assistant", content: reply });
    saveHistory(currentUser, chatHistory);

    appendMsg("ai", formatAIResponse(reply));

  } catch (err) {
    removeTyping(typingId);
    console.error(err);
    appendMsg("ai", `❌ Terjadi kesalahan: ${err.message}<br><br>Kemungkinan penyebab:<br>• Koneksi internet bermasalah<br>• API key belum dikonfigurasi di <code>app.js</code><br><br>Coba lagi sebentar ya! 🙏`);
  }
}

// ===== FORMAT AI RESPONSE =====
function formatAIResponse(text) {
  // Code blocks
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<pre><code class="lang-${lang}">${escaped}</code></pre>`;
  });

  // Inline code
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  // Italic
  text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");

  // Line breaks
  text = text.replace(/\n/g, "<br>");

  return text;
}

// ===== APPEND MESSAGE =====
function appendMsg(type, html, extra = null, imgSrc = null) {
  const box = document.getElementById("chatMessages");
  const div = document.createElement("div");
  const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  if (type === "system") {
    div.className = "msg system-msg";
    div.innerHTML = `<div class="msg-bubble">${html}</div>`;
  } else if (type === "user") {
    div.className = "msg user-msg";
    let content = `<div class="msg-bubble">${html}</div>`;
    if (imgSrc) content = `<img src="${imgSrc}" class="msg-img" onclick="window.open(this.src)">${content}`;
    content += `<div class="msg-time">${now}</div>`;
    content += `<button class="copy-btn" onclick="copyMsg(this, '${escapeForAttr(html)}')">📋 Salin</button>`;
    div.innerHTML = content;
  } else {
    div.className = "msg ai-msg";
    div.innerHTML = `<div class="msg-bubble">${html}</div>
<div class="msg-time">${now} • CludenateF</div>
<button class="copy-btn" onclick="copyMsgRaw(this)">📋 Salin</button>`;
  }

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function copyMsg(btn, html) {
  const text = html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "✅ Tersalin!";
    setTimeout(() => btn.textContent = "📋 Salin", 1500);
  });
}

function copyMsgRaw(btn) {
  const bubble = btn.previousElementSibling.previousElementSibling;
  const text = bubble.innerText;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "✅ Tersalin!";
    setTimeout(() => btn.textContent = "📋 Salin", 1500);
  });
}

function escapeForAttr(str) {
  return str.replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/\n/g, " ");
}

// ===== TYPING INDICATOR =====
let typingCounter = 0;
function showTyping() {
  const id = "typing_" + (++typingCounter);
  const box = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "msg ai-msg";
  div.id = id;
  div.innerHTML = `<div class="msg-bubble typing-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ===== INIT =====
// Register owner account if not exists
(function initOwner() {
  const users = getUsers();
  if (!users[OWNER_USERNAME]) {
    users[OWNER_USERNAME] = {
      password: btoa("owner123"), // Password default owner, ganti segera!
      joined: new Date().toISOString(),
      msgCount: 0,
      isOwner: true
    };
    saveUsers(users);
  }
})();
