const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const puppeteer = require('puppeteer');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '3aad678704eaa88aa9234d93d827f256';
const PROJECT_NAME = 'meteosat-najd';
const STEP_MINUTES = 10;
const RETENTION_HOURS = 12;

const DIRS = {
    sat1: path.join(__dirname, 'public', 'satellite_images'),
    sat2: path.join(__dirname, 'public', 'sat2_images'),
    sat3: path.join(__dirname, 'public', 'sat3_images'),
    sat4: path.join(__dirname, 'public', 'sat4_images'),
    sat5: path.join(__dirname, 'public', 'sat5_images'),
    sat6: path.join(__dirname, 'public', 'sat6_images'),
    sat7: path.join(__dirname, 'public', 'sat7_images'),
    sat8: path.join(__dirname, 'public', 'sat8_images'),
    sat9: path.join(__dirname, 'public', 'sat9_images')
};

Object.values(DIRS).forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

async function getValidToken() {
    let token = process.env.CLOUDFLARE_OAUTH_TOKEN;
    const refreshToken = process.env.CLOUDFLARE_REFRESH_TOKEN;
    
    try {
        const testRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/upload-token`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const testData = await testRes.json();
        if (testData.success) return token;
    } catch(e) {}

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
        return rData.access_token;
    }
    return token;
}

async function runCloudSync() {
    console.log(`🚀 [GitHub Actions Cloud] بدء دورة الرصد السحابي 24/7...`);

    // 1. تنزيل المانيفست الحالي من Cloudflare
    let existingFiles = new Set();
    try {
        const mRes = await fetch(`https://${PROJECT_NAME}.pages.dev/nona_manifest.json?t=` + Date.now());
        if (mRes.ok) {
            const onlineManifest = await mRes.json();
            fs.writeFileSync(path.join(__dirname, 'nona_manifest.json'), JSON.stringify(onlineManifest, null, 2));
            Object.values(onlineManifest).forEach(arr => {
                arr.forEach(item => existingFiles.add(path.basename(item.file)));
            });
        }
    } catch(e) {}

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    try {
        await page.goto('https://meteologix.com/sa/satellite/ar-riyad/satellite-hd-10m-superhd.html', {
            waitUntil: 'networkidle2',
            timeout: 35000
        });
    } catch(e) {}

    const now = new Date();
    const currentUtcMinute = Math.floor(now.getUTCMinutes() / STEP_MINUTES) * STEP_MINUTES;
    const latestUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), currentUtcMinute, 0));

    const targets = [
        { key: 'sat1', code: '1427', domain: 'img5', dir: DIRS.sat1 },
        { key: 'sat2', code: '1432', domain: 'img2', dir: DIRS.sat2 },
        { key: 'sat3', code: '1515', domain: 'img6', dir: DIRS.sat3 },
        { key: 'sat4', code: '1514', domain: 'img2', dir: DIRS.sat4 },
        { key: 'sat5', code: '1428', domain: 'img6', dir: DIRS.sat5 },
        { key: 'sat6', code: '1426', domain: 'img6', dir: DIRS.sat6 },
        { key: 'sat7', code: '1430', domain: 'img6', dir: DIRS.sat7 },
        { key: 'sat8', code: '1433', domain: 'img5', dir: DIRS.sat8 },
        { key: 'sat9', code: '1431-1437', domain: 'img3', dir: DIRS.sat9 }
    ];

    let downloaded = 0;
    // فحص ذكي سريع لآخر 6 فريمات (الساعة الماضية) لاقتناص الجديد بسرعة فائقة
    for (let i = 0; i < 6; i++) {
        const slot = new Date(latestUtc.getTime() - (i * STEP_MINUTES * 60 * 1000));
        const yyyy = slot.getUTCFullYear();
        const mm = String(slot.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(slot.getUTCDate()).padStart(2, '0');
        const hh = String(slot.getUTCHours()).padStart(2, '0');
        const min = String(slot.getUTCMinutes()).padStart(2, '0');

        for (const t of targets) {
            const filename = `sat_${yyyy}_${mm}_${dd}_${hh}_${min}_15518_${t.code}.jpg`;
            const destPath = path.join(t.dir, filename);

            if (!fs.existsSync(destPath) && !existingFiles.has(filename)) {
                try {
                    const b64 = await page.evaluate(async (url) => {
                        try {
                            const r = await fetch(url);
                            if (r.status === 200) {
                                const blob = await r.blob();
                                if (blob.size > 8000) {
                                    return new Promise(res => {
                                        const fr = new FileReader();
                                        fr.onloadend = () => res(fr.result.split(',')[1]);
                                        fr.readAsDataURL(blob);
                                    });
                                }
                            }
                        } catch(e) {}
                        return null;
                    }, `https://${t.domain}.meteologix.com/images/data/cache/sat/${filename}`);

                    if (b64) {
                        fs.writeFileSync(destPath, Buffer.from(b64, 'base64'));
                        downloaded++;
                        console.log(`✅ [سحابي] تم سحب: ${filename}`);
                    }
                } catch(e) {}
            }
        }
    }

    await browser.close();
    console.log(`📥 [سحابي] تم سحب ${downloaded} فريمات جديدة.`);

    if (downloaded === 0) {
        console.log('✨ كل الفريمات محدثة، لا يلزم رفع.');
        return;
    }

    // تنظيف ما زاد عن 12 ساعة
    const cutoff = Date.now() - (RETENTION_HOURS * 60 * 60 * 1000);
    Object.values(DIRS).forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(file => {
                const fp = path.join(dir, file);
                try {
                    if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
                } catch(e) {}
            });
        }
    });

    const { execSync } = require('child_process');
    execSync(`node "${path.join(__dirname, 'build_najd_sat_viewer.js')}"`, { stdio: 'inherit' });
    fs.copyFileSync(path.join(__dirname, 'viewer.html'), path.join(__dirname, 'public', 'index.html'));

    // الرفع لكلاودفلير
    const token = await getValidToken();
    const publicDir = path.join(__dirname, 'public');

    function getAllFiles(dir, base = '') {
        let results = [];
        fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            const relativePath = '/' + path.join(base, file).replace(/\\/g, '/');
            if (fs.statSync(fullPath).isDirectory()) {
                results = results.concat(getAllFiles(fullPath, path.join(base, file)));
            } else {
                results.push({ fullPath, relativePath });
            }
        });
        return results;
    }

    const files = getAllFiles(publicDir);
    const manifest = {};
    const fileMap = {};
    for (const f of files) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(f.fullPath)).digest('hex').substring(0, 32);
        manifest[f.relativePath] = hash;
        fileMap[hash] = f.fullPath;
    }

    const checkRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/upload-token`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const checkData = await checkRes.json();
    const jwt = checkData.result.jwt;

    const missingRes = await fetch(`https://api.cloudflare.com/client/v4/pages/assets/check-missing`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashes: Object.values(manifest) })
    });
    const missingData = await missingRes.json();
    const missingHashes = missingData.result || [];

    if (missingHashes.length > 0) {
        console.log(`⚡ [سحابي] رفع ${missingHashes.length} ملف جديد...`);
        const payload = missingHashes.map(hash => ({
            key: hash,
            value: fs.readFileSync(fileMap[hash]).toString('base64'),
            metadata: { contentType: fileMap[hash].endsWith('.html') ? 'text/html' : (fileMap[hash].endsWith('.json') ? 'application/json' : 'image/jpeg') },
            base64: true
        }));

        const BATCH_SIZE = 50;
        for (let i = 0; i < payload.length; i += BATCH_SIZE) {
            await fetch(`https://api.cloudflare.com/client/v4/pages/assets/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload.slice(i, i + BATCH_SIZE))
            });
        }
    }

    const formData = new FormData();
    formData.append('manifest', JSON.stringify(manifest));
    const deployRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    const deployData = await deployRes.json();
    if (deployData.success) {
        console.log(`🎉 [سحابي 24/7] تم النشر وتحديث الموقع بنجاح تام! https://${PROJECT_NAME}.pages.dev`);
    }
}

runCloudSync().catch(e => console.error('خطأ سحابي:', e));
