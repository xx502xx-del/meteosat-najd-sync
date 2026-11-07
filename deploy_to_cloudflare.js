const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNT_ID = '3aad678704eaa88aa9234d93d827f256';
const PROJECT_NAME = 'meteosat-najd';
const PUBLIC_DIR = path.join(__dirname, 'public');

function getOAuthToken() {
    const configPath = path.join(process.env.HOME, '.wrangler', 'config', 'default.toml');
    const content = fs.readFileSync(configPath, 'utf8');
    const match = content.match(/oauth_token\s*=\s*"([^"]+)"/);
    if (!match) throw new Error('Token not found');
    return match[1];
}

async function uploadDirect() {
    let token = process.env.CLOUDFLARE_API_TOKEN || getOAuthToken();

    function getAllFiles(dir, base = '') {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const relativePath = '/' + path.join(base, file).replace(/\\/g, '/');
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                results = results.concat(getAllFiles(fullPath, path.join(base, file)));
            } else {
                results.push({ fullPath, relativePath });
            }
        });
        return results;
    }

    const files = getAllFiles(PUBLIC_DIR);
    const manifest = {};
    const fileMap = {};

    for (const f of files) {
        const content = fs.readFileSync(f.fullPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
        manifest[f.relativePath] = hash;
        fileMap[hash] = f.fullPath;
    }

    let checkRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/upload-token`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    let checkData = await checkRes.json();
    if (!checkData.success) {
        // تجديد التوكن تلقائياً إذا انتهت الجلسة
        const toml = fs.readFileSync(path.join(process.env.HOME, '.wrangler', 'config', 'default.toml'), 'utf8');
        const refreshToken = toml.match(/refresh_token\s*=\s*"([^"]+)"/)[1];
        const refreshRes = await fetch('https://dash.cloudflare.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: '54d11594-84e4-41aa-b438-e81b8fa78ee7',
                refresh_token: refreshToken
            })
        });
        const rData = await refreshRes.json();
        if (rData.access_token) {
            token = rData.access_token;
            let updated = toml.replace(/oauth_token\s*=\s*"[^"]+"/, `oauth_token = "${token}"`);
            if (rData.refresh_token) {
                updated = updated.replace(/refresh_token\s*=\s*"[^"]+"/, `refresh_token = "${rData.refresh_token}"`);
            }
            fs.writeFileSync(path.join(process.env.HOME, '.wrangler', 'config', 'default.toml'), updated);
            
            checkRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/upload-token`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            checkData = await checkRes.json();
        }
    }

    if (!checkData.success) {
        throw new Error('فشل الحصول على رمز الرفع: ' + JSON.stringify(checkData.errors));
    }

    const jwt = checkData.result.jwt;

    const missingRes = await fetch(`https://api.cloudflare.com/client/v4/pages/assets/check-missing`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ hashes: Object.values(manifest) })
    });

    const missingData = await missingRes.json();
    const missingHashes = missingData.result || [];

    // رفع الملفات الناقصة فقط (Delta Upload السريع)
    if (missingHashes.length > 0) {
        console.log(`⚡ رفع فوري لـ ${missingHashes.length} ملف جديد فقط بسرعة فائقة...`);
        const payload = [];
        for (const hash of missingHashes) {
            const filePath = fileMap[hash];
            const content = fs.readFileSync(filePath);
            payload.push({
                key: hash,
                value: content.toString('base64'),
                metadata: { contentType: filePath.endsWith('.html') ? 'text/html' : (filePath.endsWith('.json') ? 'application/json' : 'image/jpeg') },
                base64: true
            });
        }

        const BATCH_SIZE = 50;
        for (let i = 0; i < payload.length; i += BATCH_SIZE) {
            const batch = payload.slice(i, i + BATCH_SIZE);
            await fetch(`https://api.cloudflare.com/client/v4/pages/assets/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(batch)
            });
        }
    }

    // إطلاق النشر فوراً
    const formData = new FormData();
    formData.append('manifest', JSON.stringify(manifest));

    const deployRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    const deployData = await deployRes.json();
    if (deployData.success) {
        console.log(`⚡ تم النشر في خوادم Cloudflare بسرعة البرق: https://${PROJECT_NAME}.pages.dev`);
    }
}

uploadDirect().catch(e => console.error('خطأ رفع:', e));
