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

const USERS_FILE = path.join(__dirname, 'users.json');

// Load users
let allowedUsers = ["7145835109"]; // default admin
if (fs.existsSync(USERS_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        allowedUsers = data.allowedUsers || allowedUsers;
    } catch (e) {}
}

// Save users
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ allowedUsers }, null, 2));
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get allowed users (for admin)
app.get('/api/users', (req, res) => {
    res.json({ allowedUsers });
});

// Check username
app.post('/check-username', async (req, res) => {
    let { username } = req.body;
    if (!username) return res.json({ exists: false });

    username = username.trim().toLowerCase().replace('@', '');
    console.log(`Checking: ${username}`);

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
            payload,
            { headers, timeout: 15000 }
        );

        const text = response.data.toString().toLowerCase();

        if (text.includes(`"${username}"`) && !text.includes('"not_found"') && !text.includes('no_results')) {
            return res.json({ exists: true, username });
        }
    } catch (error) {
        console.log("Error in check:", error.message);
    }

    // Fallback
    try {
        const { data } = await axios.get(`https://www.instagram.com/${username}/`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        if (data.includes(`"username":"${username}"`)) {
            return res.json({ exists: true, username });
        }
    } catch (e) {}

    res.json({ exists: false });
});

// New API for auth
app.post('/api/login', (req, res) => {
    const { userId } = req.body;
    if (allowedUsers.includes(userId.toUpperCase())) {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.get('/api/allowed-users', (req, res) => {
    res.json({ allowedUsers });
});

app.post('/api/add-user', (req, res) => {
    const { userId, adminId } = req.body;
    if (adminId !== "7968968395") return res.json({ success: false });

    const upperId = userId.toUpperCase().trim();
    if (!allowedUsers.includes(upperId)) {
        allowedUsers.push(upperId);
        saveUsers();
    }
    res.json({ success: true, allowedUsers });
});

app.post('/api/remove-user', (req, res) => {
    const { userId, adminId } = req.body;
    if (adminId !== "7145835109") return res.json({ success: false });
    if (userId === "7968968395") return res.json({ success: false });

    allowedUsers = allowedUsers.filter(id => id !== userId);
    saveUsers();
    res.json({ success: true, allowedUsers });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`✅ Allowed Users: ${allowedUsers.length}`);
});
