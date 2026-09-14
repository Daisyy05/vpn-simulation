// ================= Real-data helpers =================
// These call public, keyless, CORS-enabled APIs directly from the browser,
// so the machine running the demo needs internet access for these bits.

const VPN_SERVERS = [
    { city: "Chennai", country: "India", flag: "🇮🇳", ip: "185.65.135.42", lat: 52.37, lon: 4.90 },
    { city: "Singapore", country: "Singapore", flag: "🇸🇬", ip: "103.28.54.118", lat: 1.35, lon: 103.82 },
    { city: "New York", country: "United States", flag: "🇺🇸", ip: "64.185.227.97", lat: 40.71, lon: -74.01 },
    { city: "Frankfurt", country: "Germany", flag: "🇩🇪", ip: "185.220.101.53", lat: 50.11, lon: 8.68 },
    { city: "Tokyo", country: "Japan", flag: "🇯🇵", ip: "133.242.155.10", lat: 35.68, lon: 139.69 },
];

async function fetchRealIP() {
    try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        return data.ip || null;
    } catch (e) {
        return null;
    }
}

async function fetchGeo(ip) {
    try {
        const res = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!res.ok) throw new Error("geo lookup failed");
        const data = await res.json();
        if (data.error) return null;
        return data;
    } catch (e) {
        return null;
    }
}

// Genuine AES-256-GCM encryption using the browser's Web Crypto API.
// Generates a fresh random key + IV every call, so the ciphertext is real
// and different every time — not a hardcoded string.
async function encryptDemo(plainText) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plainText));
    const cipherBytes = new Uint8Array(cipherBuf);
    let binary = "";
    cipherBytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
}

function projectToMap(lat, lon, w, h) {
    const x = ((lon + 180) / 360) * w;
    const y = ((90 - lat) / 180) * h;
    return { x, y };
}

function isValidIPv4(ip) {
    const parts = ip.trim().split(".");
    if (parts.length !== 4) return false;
    return parts.every((part) => {
        if (!/^\d{1,3}$/.test(part)) return false;
        const n = Number(part);
        return n >= 0 && n <= 255 && String(n) === part.replace(/^0+(?=\d)/, "");
    });
}

function populateServerSelects() {
    document.querySelectorAll(".server-select").forEach((select) => {
        select.innerHTML = VPN_SERVERS
            .map((s, i) => `<option value="${i}">${s.flag} ${s.city}, ${s.country}</option>`)
            .join("");
    });
}

function getSelectedServer(selectId) {
    const select = document.getElementById(selectId);
    if (!select || select.value === "") {
        return VPN_SERVERS[Math.floor(Math.random() * VPN_SERVERS.length)];
    }
    return VPN_SERVERS[Number(select.value)];
}

// ---------- Simulation page ----------
async function fillMyIP() {
    const input = document.getElementById("user-ip");
    if (!input) return;
    input.value = "Detecting…";
    const ip = await fetchRealIP();
    input.value = ip || "";
    await validateIP();
}

function validateIP() {
    const input = document.getElementById("user-ip");
    const status = document.getElementById("ip-check-status");
    if (!input || !status) return true;

    const ip = input.value.trim();
    status.textContent = "🔎 Checking…";
    status.className = "status-msg checking";

    return new Promise((resolve) => {
        setTimeout(() => {
            if (ip === "") {
                status.textContent = "❌ Enter an IP address first.";
                status.className = "status-msg bad";
                resolve(false);
            } else if (isValidIPv4(ip)) {
                status.textContent = "✅ Valid IPv4 address.";
                status.className = "status-msg ok";
                resolve(true);
            } else {
                status.textContent = "❌ Not a valid IPv4 address (expected e.g. 192.168.1.1).";
                status.className = "status-msg bad";
                resolve(false);
            }
        }, 500);
    });
}

async function connectToVPN() {
    let userIP = document.getElementById("user-ip").value;
    let vpnStatus = document.getElementById("vpn-status");
    let cipherOutput = document.getElementById("cipher-output");

    const isValid = await validateIP();
    if (!isValid) {
        vpnStatus.innerHTML = `❌ Fix the IP address above before connecting.`;
        return;
    }

    const server = getSelectedServer("sim-server-select");

    vpnStatus.innerHTML = `🔗 Connecting to ${server.flag} ${server.city} VPN server...`;

    // Run the real encryption while the "connection" animates.
    const cipherPromise = encryptDemo(`GET /session HTTP/1.1\nX-Forwarded-For: ${userIP}`);

    setTimeout(async () => {
        vpnStatus.innerHTML = `✅ Connected via ${server.flag} <strong>${server.city}, ${server.country}</strong>! Your IP is now protected — new IP: <strong>${server.ip}</strong> (Original: <del>${userIP}</del>)`;
        startVPNSimulation();

        const cipher = await cipherPromise;
        if (cipherOutput) {
            cipherOutput.textContent = `AES-256-GCM ciphertext (real, generated live): ${cipher}`;
        }
    }, 2000);
}

function startVPNSimulation() {
    let normalData = document.querySelector(".data.normal");
    let encryptedData = document.querySelector(".data.encrypted");
    if (!normalData || !encryptedData) return;

    normalData.style.transition = "transform 2s ease-in-out";
    normalData.style.transform = "translateX(150px)";

    setTimeout(() => {
        normalData.style.display = "none";
        encryptedData.style.display = "inline-block";
        encryptedData.style.transition = "transform 2s ease-in-out";
        encryptedData.style.transform = "translateX(150px)";
    }, 2000);
}

// ---------- Security page ----------
async function showFeature(feature) {
    const details = document.getElementById("feature-details");

    if (feature === "encryption") {
        details.innerHTML = `<h2>🔐 Running a live AES-256-GCM encryption…</h2>`;
        const cipher = await encryptDemo("user=alice&password=hunter2&session=active");
        details.innerHTML = `
            <h2>🔐 Encryption, demonstrated live</h2>
            <p style="font-size:0.95rem; color:var(--text-dim); margin-bottom:10px;">Plaintext: <code>user=alice&password=hunter2&session=active</code></p>
            <p class="cipher-text" style="margin:0 auto;">Real AES-256-GCM ciphertext: ${cipher}</p>
        `;
        return;
    }

    const details_map = {
        "ip-masking": "🌍 IP Masking hides your real IP address, making it impossible to track your online activity.",
        "no-logs": "🚫 No-Log Policy means your online activity is never stored, ensuring full privacy.",
        "kill-switch": "⚡ Kill Switch cuts off your internet connection if the VPN fails, preventing data leaks."
    };

    details.innerHTML = `<h2>${details_map[feature]}</h2>`;
}

async function startHackerAttack() {
    let normalData = document.querySelector(".data.normal");
    let hacker = document.querySelector(".hacker");
    let vpnServer = document.querySelector(".vpn-server");
    let encryptedData = document.querySelector(".data.encrypted");
    let packetOutput = document.getElementById("packet-output");
    if (!normalData || !hacker || !vpnServer || !encryptedData) return;

    const plainPacket = "GET /login?user=alice&pass=hunter2 HTTP/1.1";
    if (packetOutput) {
        packetOutput.textContent = `Packet on the wire (no VPN): ${plainPacket}`;
    }

    normalData.style.transition = "transform 2s ease-in-out";
    normalData.style.transform = "translateX(150px)";

    const cipherPromise = encryptDemo(plainPacket);

    setTimeout(() => {
        hacker.innerHTML = "Hacker (Stealing Data!)";
        hacker.style.color = "red";
    }, 1500);

    setTimeout(async () => {
        normalData.style.display = "none";
        vpnServer.classList.remove("hidden");
        encryptedData.classList.remove("hidden");

        encryptedData.style.transition = "transform 2s ease-in-out";
        encryptedData.style.transform = "translateX(150px)";

        hacker.innerHTML = "Hacker Blocked!";
        hacker.style.color = "green";

        const cipher = await cipherPromise;
        if (packetOutput) {
            packetOutput.textContent = `Packet on the wire (with VPN, real AES-256-GCM output): ${cipher}`;
        }
    }, 3000);
}

// ---------- Home dashboard ----------
let mapDotsCache = null;
function getMapDots(w, h) {
    if (mapDotsCache) return mapDotsCache;
    let dots = "";
    for (let x = 6; x < w; x += 9) {
        for (let y = 10; y < h - 10; y += 9) {
            if (Math.random() > 0.55) {
                dots += `<circle cx="${x}" cy="${y}" r="1" fill="rgba(155,123,255,0.35)" />`;
            }
        }
    }
    mapDotsCache = dots;
    return dots;
}

function drawWorldMap(server) {
    const svg = document.getElementById("world-dots");
    if (!svg) return;
    const w = 260, h = 160;
    let markers = "";
    const userGeo = window.__userGeo;

    const userPoint = userGeo ? projectToMap(userGeo.lat, userGeo.lon, w, h) : { x: 40, y: 90 };
    markers += `<circle cx="${userPoint.x}" cy="${userPoint.y}" r="4" fill="#2fd66a" />`;
    markers += `<text x="${userPoint.x}" y="${userPoint.y - 8}" font-size="8" fill="#2fd66a" text-anchor="middle">You</text>`;

    if (server) {
        const sp = projectToMap(server.lat, server.lon, w, h);
        markers += `<line x1="${userPoint.x}" y1="${userPoint.y}" x2="${sp.x}" y2="${sp.y}" stroke="rgba(79,140,255,0.6)" stroke-dasharray="4 4" />`;
        markers += `<circle cx="${sp.x}" cy="${sp.y}" r="7" fill="rgba(79,140,255,0.2)" stroke="#4f8cff" />`;
        markers += `<text x="${sp.x}" y="${sp.y + 3}" font-size="8" text-anchor="middle">${server.flag}</text>`;
    } else {
        markers += `<circle cx="220" cy="80" r="18" fill="rgba(79,140,255,0.12)" stroke="rgba(79,140,255,0.5)" />`;
        markers += `<text x="220" y="85" text-anchor="middle" font-size="14">🌐</text>`;
    }

    svg.innerHTML = getMapDots(w, h) + markers;
}

async function initHomeDashboard() {
    const ipField = document.getElementById("home-user-ip");
    const originalIpField = document.getElementById("home-original-ip");
    const geoSub = document.getElementById("home-ip-geo");
    const ipStatus = document.getElementById("home-ip-status");
    if (!ipField) {
        // Not on the homepage — nothing else to init here.
        return;
    }

    ipField.textContent = "Detecting…";
    originalIpField.textContent = "Detecting…";
    if (ipStatus) { ipStatus.textContent = "🔎 Checking…"; ipStatus.className = "status-msg checking"; }
    drawWorldMap();

    const ip = await fetchRealIP();
    if (!ip) {
        ipField.textContent = "Unavailable (offline?)";
        originalIpField.textContent = "Unavailable (offline?)";
        if (ipStatus) { ipStatus.textContent = "❌ Could not detect your IP — check internet access."; ipStatus.className = "status-msg bad"; }
        return;
    }

    ipField.textContent = ip;
    originalIpField.textContent = ip;
    if (ipStatus) { ipStatus.textContent = "✅ Live public IP detected successfully."; ipStatus.className = "status-msg ok"; }

    const geo = await fetchGeo(ip);
    if (geo && geo.city) {
        if (geoSub) geoSub.textContent = `${geo.city}, ${geo.country_name}`;
        window.__userGeo = { lat: geo.latitude, lon: geo.longitude };
        drawWorldMap();
    }
}

async function connectHomeVPN() {
    const btn = document.getElementById("home-connect-btn");
    const statusTitle = document.getElementById("home-status-title");
    const statusSub = document.getElementById("home-status-sub");
    const vpnIp = document.getElementById("home-vpn-ip");
    const vpnIpSub = document.getElementById("home-vpn-ip-sub");
    const dataStatusCard = document.getElementById("home-data-status");
    const dataTitle = document.getElementById("home-data-title");
    const dataSub = document.getElementById("home-data-sub");
    const headerStatus = document.getElementById("header-status");
    const headerStatusText = document.getElementById("header-status-text");
    const connectStatus = document.getElementById("home-connect-status");
    if (!btn) return;

    const server = getSelectedServer("home-server-select");

    btn.textContent = "🔗 Connecting...";
    btn.disabled = true;
    if (connectStatus) { connectStatus.textContent = `🔎 Establishing tunnel to ${server.flag} ${server.city}…`; connectStatus.className = "status-msg checking"; }

    const cipherPromise = encryptDemo("live-session-token-demo");

    setTimeout(async () => {
        statusTitle.textContent = "Connected";
        statusTitle.classList.remove("status-bad");
        statusTitle.classList.add("status-ok");
        statusSub.textContent = `Routed through ${server.flag} ${server.city}`;

        vpnIp.textContent = server.ip;
        vpnIpSub.textContent = `(${server.city}, ${server.country})`;

        dataStatusCard.classList.add("secure");
        dataTitle.textContent = "Secured";
        dataTitle.classList.remove("status-bad");
        dataTitle.classList.add("status-ok");
        dataStatusCard.querySelector(".icon-badge").textContent = "🔒";

        const cipher = await cipherPromise;
        if (dataSub) dataSub.textContent = `AES-256-GCM active — sample: ${cipher.slice(0, 22)}…`;

        headerStatus.classList.add("connected");
        headerStatusText.textContent = "Connected";

        drawWorldMap(server);

        btn.textContent = "✅ Connected";
        if (connectStatus) { connectStatus.textContent = `✅ Success — your IP is now protected behind ${server.city}.`; connectStatus.className = "status-msg ok"; }
    }, 1800);
}

// ---------- Dark mode toggle (shared across pages) ----------
const darkModeToggle = document.getElementById("darkModeToggle");
const body = document.body;

if (darkModeToggle) {
    if (localStorage.getItem("dark-mode") === "disabled") {
        body.classList.remove("dark-mode");
        darkModeToggle.checked = false;
    } else {
        // Defaults to dark mode, matching the site's primary theme.
        body.classList.add("dark-mode");
        darkModeToggle.checked = true;
    }

    darkModeToggle.addEventListener("change", () => {
        if (darkModeToggle.checked) {
            body.classList.add("dark-mode");
            localStorage.setItem("dark-mode", "enabled");
        } else {
            body.classList.remove("dark-mode");
            localStorage.setItem("dark-mode", "disabled");
        }
    });
}

// ---------- Contact form (contact page only) ----------
const contactForm = document.getElementById("contactForm");
if (contactForm) {
    contactForm.addEventListener("submit", function (event) {
        event.preventDefault();

        let name = document.getElementById("name").value;
        let email = document.getElementById("email").value;
        let message = document.getElementById("message").value;

        if (name && email && message) {
            alert("Thank you, " + name + "! Your message has been sent.");
            contactForm.reset();
        } else {
            alert("Please fill in all fields.");
        }
    });
}

// ---------- Home page init ----------
const checkIpBtn = document.getElementById("check-ip-btn");
if (checkIpBtn) {
    checkIpBtn.addEventListener("click", initHomeDashboard);
}
populateServerSelects();
initHomeDashboard();

// ---------- Security report timestamp ----------
const reportTimestamp = document.getElementById("report-timestamp");
if (reportTimestamp) {
    const now = new Date();
    reportTimestamp.textContent = `Last scanned: ${now.toLocaleString()}`;
}