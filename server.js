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

const ADMIN_ID = "7968968395";   // ← Yahan apni Admin ID daal do
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

// ====================== IMPROVED PROFILE INFO ======================
app.post('/check-username', async (req, res) => {
    let { username } = req.body;
    if (!username) return res.json({ exists: false });

    username = username.trim().toLowerCase().replace('@', '');

    try {
        const response = await axios.get(`https://www.instagram.com/${username}/`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 15000
        });

        const html = response.data;

        // Extract Data
        const exists = html.includes(`"${username}"`) || html.includes('profile_pic_url');

        let full_name = "Instagram User";
        let followers = "0";
        let following = "0";
        let posts = "0";
        let bio = "";
        let profile_pic = `https://www.instagram.com/${username}/profilepic/?size=1080`;
        let is_private = false;

        // Full Name
        const nameMatch = html.match(/"full_name":"([^"]+)"/);
        if (nameMatch) full_name = nameMatch[1];

        // Bio
        const bioMatch = html.match(/"biography":"([^"]+)"/);
        if (bioMatch) bio = bioMatch[1];

        // Followers, Following, Posts
        const followersMatch = html.match(/"edge_followed_by":{"count":(\d+)}/);
        if (followersMatch) followers = parseInt(followersMatch[1]).toLocaleString();

        const followingMatch = html.match(/"edge_follow":{"count":(\d+)}/);
        if (followingMatch) following = parseInt(followingMatch[1]).toLocaleString();

        const postsMatch = html.match(/"edge_owner_to_timeline_media":{"count":(\d+)}/);
        if (postsMatch) posts = parseInt(postsMatch[1]).toLocaleString();

        // Private Account Check
        if (html.includes('"is_private":true')) is_private = true;

        res.json({
            exists: true,
            username,
            full_name,
            followers,
            following,
            posts,
            bio: bio || "No bio",
            profile_pic,
            is_private,
            message: is_private ? "This account is Private" : "Public Account"
        });

    } catch (error) {
        // Fallback
        res.json({
            exists: false,
            username,
            message: "Account not found or private"
        });
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
    if (adminId !== ADMIN_ID || userId === ADMIN_ID) return res.json({ success: false });

    allowedUsers = allowedUsers.filter(id => id !== userId);
    saveUsers();
    res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
