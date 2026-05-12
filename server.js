const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_ID = "7968968395";   // ←←← YAHAN APNI ADMIN ID CHANGE KARO
const USERS_FILE = path.join(__dirname, 'users.json');

// Load users
let allowedUsers = [ADMIN_ID];
if (fs.existsSync(USERS_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        allowedUsers = data.allowedUsers || allowedUsers;
    } catch (e) {}
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ allowedUsers }, null, 2));
}

// ====================== USERNAME CHECK ======================
app.post('/check-username', async (req, res) => {
    let { username } = req.body;
    if (!username) return res.json({ exists: false });

    username = username.trim().toLowerCase().replace('@', '');

    let result = { exists: false, username, profile_pic: '', full_name: '' };

    try {
        const device = uuidv4();
        const family = uuidv4();
        const android = "android-" + Math.random().toString(36).substring(2, 12);

        const payload = {
            params: `{"client_input_params":{"aac":"{\\"aac_init_timestamp\\":${Math.floor(Date.now()/1000)},\\"aacjid\\":\\"${uuidv4()}\\",\\"aaccs\\":\\"${Math.random().toString(36).substring(2, 40)}\\"}","search_query":"${username}","search_screen_type":"email_or_username","ig_android_qe_device_id":"${device}"},"server_params":{"event_request_id":"${uuidv4()}","device_id":"${android}","family_device_id":"${family}","qe_device_id":"${device}"}}`,
            'bk_client_context': '{"bloks_version":"5e47baf35c5a270b44c8906c8b99063564b30ef69779f3dee0b828bee2e4ef5b","styles_id":"instagram"}',
            'bloks_versioning_id': "5e47baf35c5a270b44c8906c8b99063564b30ef69779f3dee0b828bee2e4ef5b"
        };

        const headers = {
            'User-Agent': "Instagram 370.1.0.43.96 Android (34/14; 450dpi; 1080x2207; samsung; SM-A235F; a23; qcom; en_IN; 704872281)",
            'accept-language': "en-IN, en-US",
            'x-ig-app-id': "567067343352427",
            'x-ig-device-id': device,
            'x-ig-family-device-id': family,
            'x-ig-android-id': android,
            'x-mid': Buffer.from(Math.random().toString(36).substring(2, 20)).toString('base64').replace(/=/g, ''),
        };

        const response = await axios.post(
            "https://i.instagram.com/api/v1/bloks/async_action/com.bloks.www.caa.ar.search.async/",
            payload, { headers, timeout: 15000 }
        );

        const text = response.data.toString().toLowerCase();
        if (text.includes(`"${username}"`) && !text.includes('"not_found"')) {
            result.exists = true;
        }
    } catch (e) {}

    // Fallback
    try {
        const { data } = await axios.get(`https://www.instagram.com/${username}/`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        if (data.includes(`"username":"${username}"`)) result.exists = true;
    } catch (e) {}

    res.json(result);
});

// ====================== FULL PROFILE SCREENSHOT ======================
app.post('/screenshot', async (req, res) => {
    let { username } = req.body;
    if (!username) return res.json({ success: false });

    username = username.trim().toLowerCase().replace('@', '');

    try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 2400 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        await page.goto(`https://www.instagram.com/${username}/`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await page.waitForSelector('header', { timeout: 10000 }).catch(() => {});

        const screenshotDir = path.join(__dirname, 'public', 'screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

        const filename = `${username}-${Date.now()}.jpg`;
        const filepath = path.join(screenshotDir, filename);

        await page.screenshot({
            path: filepath,
            fullPage: false,
            quality: 90,
            type: 'jpeg'
        });

        await browser.close();

        res.json({
            success: true,
            imageUrl: `/screenshots/${filename}`
        });

    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Screenshot failed" });
    }
});

// ====================== AUTH & ADMIN ======================
app.post('/api/login', (req, res) => {
    const { userId } = req.body;
    if (allowedUsers.includes(userId.toUpperCase())) {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.get('/api/allowed-users', (req, res) => res.json({ allowedUsers }));

app.post('/api/add-user', (req, res) => {
    const { userId, adminId } = req.body;
    if (adminId !== ADMIN_ID) return res.json({ success: false });

    const upperId = userId.toUpperCase().trim();
    if (!allowedUsers.includes(upperId)) {
        allowedUsers.push(upperId);
        saveUsers();
    }
    res.json({ success: true });
});

app.post('/api/remove-user', (req, res) => {
    const { userId, adminId } = req.body;
    if (adminId !== ADMIN_ID) return res.json({ success: false });
    if (userId === ADMIN_ID) return res.json({ success: false });

    allowedUsers = allowedUsers.filter(id => id !== userId);
    saveUsers();
    res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
