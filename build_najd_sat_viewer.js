const fs = require('fs');
const path = require('path');

const DIRS = {
    sat1: { folder: 'satellite_images', code: '1427' },
    sat2: { folder: 'sat2_images', code: '1432' },
    sat3: { folder: 'sat3_images', code: '1515' },
    sat4: { folder: 'sat4_images', code: '1514' },
    sat5: { folder: 'sat5_images', code: '1428' },
    sat6: { folder: 'sat6_images', code: '1426' },
    sat7: { folder: 'sat7_images', code: '1430' },
    sat8: { folder: 'sat8_images', code: '1433' },
    sat9: { folder: 'sat9_images', code: '1431-1437' }
};

const mapFrames = (folder, code) => {
    let fullPath = path.join(__dirname, folder);
    if (!fs.existsSync(fullPath)) {
        fullPath = path.join(__dirname, 'public', folder);
    }
    if (!fs.existsSync(fullPath)) return [];
    const files = fs.readdirSync(fullPath).filter(f => f.startsWith('sat_') && f.endsWith(`_15518_${code}.jpg`)).sort();
    return files.map(file => {
        const parts = file.split('_');
        // تحويل التوقيت من غرينتش (UTC) إلى توقيت السعودية الرسمي (KSA = UTC+3)
        const utcDate = new Date(Date.UTC(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]), parseInt(parts[4]), parseInt(parts[5])));
        const ksaDate = new Date(utcDate.getTime() + (3 * 60 * 60 * 1000));
        
        const ksaY = ksaDate.getUTCFullYear();
        const ksaM = String(ksaDate.getUTCMonth() + 1).padStart(2, '0');
        const ksaD = String(ksaDate.getUTCDate()).padStart(2, '0');
        const ksaH = String(ksaDate.getUTCHours()).padStart(2, '0');
        const ksaMin = String(ksaDate.getUTCMinutes()).padStart(2, '0');

        return {
            file: `${folder}/${file}`,
            time: `${ksaH}:${ksaMin} KSA`,
            date: `${ksaY}/${ksaM}/${ksaD}`
        };
    });
};

let existingManifest = null;
try {
    if (fs.existsSync(path.join(__dirname, 'nona_manifest.json'))) {
        existingManifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'nona_manifest.json'), 'utf8'));
    }
} catch(e) {}

const scannedData = {
    sat1: mapFrames(DIRS.sat1.folder, DIRS.sat1.code),
    sat2: mapFrames(DIRS.sat2.folder, DIRS.sat2.code),
    sat3: mapFrames(DIRS.sat3.folder, DIRS.sat3.code),
    sat4: mapFrames(DIRS.sat4.folder, DIRS.sat4.code),
    sat5: mapFrames(DIRS.sat5.folder, DIRS.sat5.code),
    sat6: mapFrames(DIRS.sat6.folder, DIRS.sat6.code),
    sat7: mapFrames(DIRS.sat7.folder, DIRS.sat7.code),
    sat8: mapFrames(DIRS.sat8.folder, DIRS.sat8.code),
    sat9: mapFrames(DIRS.sat9.folder, DIRS.sat9.code)
};

const nonaData = {};
Object.keys(DIRS).forEach(k => {
    const map = new Map();
    if (existingManifest && existingManifest[k]) {
        existingManifest[k].forEach(item => map.set(item.file, item));
    }
    if (scannedData[k]) {
        scannedData[k].forEach(item => map.set(item.file, item));
    }
    const sorted = Array.from(map.values()).sort((a, b) => a.file.localeCompare(b.file));
    nonaData[k] = sorted.slice(-72);
});

fs.writeFileSync(path.join(__dirname, 'nona_manifest.json'), JSON.stringify(nonaData, null, 2));
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'nona_manifest.json'), JSON.stringify(nonaData));

const initialImage = (nonaData.sat1 && nonaData.sat1.length > 0) ? nonaData.sat1[nonaData.sat1.length - 1].file : '';
const initialDate = (nonaData.sat1 && nonaData.sat1.length > 0) ? `${nonaData.sat1[nonaData.sat1.length - 1].date} ${nonaData.sat1[nonaData.sat1.length - 1].time}` : '--';
const initialTime = (nonaData.sat1 && nonaData.sat1.length > 0) ? nonaData.sat1[nonaData.sat1.length - 1].time.replace(' KSA', '') : '--';
const maxIdx = (nonaData.sat1 && nonaData.sat1.length > 0) ? nonaData.sat1.length - 1 : 0;

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>Najd Sat - Advanced Satellite Weather</title>
    <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <style>
        html { width: 100%; height: 100%; }
        body { 
            margin: 0; padding: 0; 
            width: 100%; height: 100%;
            overflow: hidden;
            font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            background: #090d16;
            color: #f8fafc;
            user-select: none;
            -webkit-user-select: none;
        }

        /* ==========================================
           TOP NAVIGATION (BaroClinic Style -> Najd Sat)
           ========================================== */
        #top-nav {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 52px;
            background: #11151e;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            z-index: 40;
            border-bottom: 1px solid #1e2634;
            color: #f8fafc;
            gap: 12px;
        }

        .nav-left {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
        }

        .logo {
            background: none;
            border: none;
            font-family: 'Roboto', sans-serif;
            cursor: pointer;
            padding: 0;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .sat-icon-wrap {
            position: relative;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .sat-icon-svg {
            width: 20px;
            height: 20px;
            fill: none;
            stroke: #38bdf8;
            stroke-width: 1.8;
            stroke-linecap: round;
            stroke-linejoin: round;
            animation: satFloat 4s ease-in-out infinite;
            filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.6));
        }

        .sat-beam {
            position: absolute;
            top: 2px;
            right: 2px;
            width: 5px;
            height: 5px;
            background: #22c55e;
            border-radius: 50%;
            animation: satPulse 1.8s infinite;
        }

        @keyframes satFloat {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-3px) rotate(4deg); }
        }

        @keyframes satPulse {
            0% { transform: scale(0.8); opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
            70% { transform: scale(1.6); opacity: 0; box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
            100% { transform: scale(0.8); opacity: 0; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }

        .logo-badge {
            background: rgba(56, 189, 248, 0.12);
            border: 1px solid rgba(56, 189, 248, 0.35);
            color: #38bdf8;
            font-size: 13px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 6px;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.15);
        }

        /* ECMWF-IFS Style Satellite Selector Dropdown */
        .model-select-wrapper {
            position: relative;
            display: flex;
            align-items: center;
        }

        .model-dropdown-btn {
            background: #1a2232;
            border: 1px solid #2b384e;
            color: #e2e8f0;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .model-dropdown-btn:hover {
            background: #222c40;
            border-color: #3b82f6;
            color: #ffffff;
        }

        .model-dropdown-btn .pill-tag {
            background: #2563eb;
            color: #fff;
            font-size: 10px;
            padding: 1px 5px;
            border-radius: 3px;
            font-weight: 700;
        }

        .dropdown-menu {
            position: absolute;
            top: calc(100% + 6px);
            right: 0;
            width: 290px;
            background: #131924;
            border: 1px solid #232f42;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
            display: none;
            flex-direction: column;
            padding: 6px 0;
            z-index: 100;
        }

        .dropdown-menu.show {
            display: flex;
        }

        .dropdown-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 14px;
            color: #94a3b8;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s ease, color 0.15s ease;
        }

        .dropdown-item:hover {
            background: #1e293b;
            color: #ffffff;
        }

        .dropdown-item.active {
            background: rgba(37, 99, 235, 0.15);
            color: #38bdf8;
            font-weight: 600;
        }

        .dropdown-item .item-meta {
            font-size: 11px;
            color: #64748b;
        }

        .dropdown-divider {
            height: 1px;
            background: #1e2634;
            margin: 4px 0;
        }

        /* ==========================================
           MAIN SATELLITE CANVAS / SCREEN
           ========================================== */
        #map-container {
            position: absolute;
            top: 52px;
            bottom: 58px;
            left: 0;
            right: 0;
            width: 100%;
            background: #070a12;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        .image-stage {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            max-width: 100%;
            max-height: 100%;
        }

        #satellite-image {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            object-fit: scale-down;
            display: block;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: high-quality;
            image-rendering: crisp-edges;
            border: 1px solid rgba(56, 189, 248, 0.28);
            border-radius: 8px;
            box-shadow: 0 0 25px rgba(0, 0, 0, 0.9), 0 0 15px rgba(56, 189, 248, 0.12);
            transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        /* Top-Left Weather HUD (BaroClinic Style) */
        #layer-hud {
            position: absolute;
            top: 14px;
            left: 16px;
            background: rgba(15, 23, 42, 0.88);
            border: 1px solid rgba(255, 255, 255, 0.12);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            padding: 8px 14px;
            border-radius: 8px;
            color: #ffffff;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
            pointer-events: none;
            z-index: 10;
        }

        #hud-product-title {
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.3px;
            color: #ffffff;
            margin-bottom: 3px;
        }

        .hud-sub {
            font-size: 11px;
            font-weight: 500;
            color: #94a3b8;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .hud-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #22c55e;
            box-shadow: 0 0 8px #22c55e;
        }

        /* Top-Right Time HUD (داخل حدود صورة القمر دائماً) - نسخة الكمبيوتر */
        #time-hud {
            position: absolute;
            top: 8px;
            right: 10px;
            background: rgba(15, 23, 42, 0.78);
            border: 1px solid rgba(255, 255, 255, 0.12);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            padding: 3px 7px;
            border-radius: 5px;
            font-family: 'Roboto', monospace;
            font-size: 10px;
            font-weight: 700;
            color: #38bdf8;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
            pointer-events: none;
            z-index: 10;
            white-space: nowrap;
        }

        /* ==========================================
           BOTTOM TIMELINE & CONTROLS (BaroClinic)
           ========================================== */
        #bottom-panel {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 58px;
            background: #11151e;
            border-top: 1px solid #1e2634;
            display: flex;
            align-items: center;
            padding: 0 16px;
            gap: 16px;
            z-index: 30;
        }

        .controls-group {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
        }

        .ctrl-btn {
            background: #181d28;
            border: 1px solid #262f3f;
            color: #f8fafc;
            width: 36px;
            height: 36px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .ctrl-btn:hover {
            background: #2563eb;
            border-color: #3b82f6;
            color: #ffffff;
        }

        .ctrl-btn svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
        }

        .speed-btn {
            background: #181d28;
            border: 1px solid #262f3f;
            color: #94a3b8;
            height: 36px;
            padding: 0 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .speed-btn:hover {
            color: #ffffff;
            border-color: #3b82f6;
        }

        .live-btn {
            background: rgba(34, 197, 94, 0.15);
            border: 1px solid rgba(34, 197, 94, 0.35);
            color: #4ade80;
            height: 36px;
            padding: 0 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.15s ease;
        }

        .live-btn:hover {
            background: rgba(34, 197, 94, 0.25);
            border-color: #22c55e;
            color: #ffffff;
        }

        .live-btn-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #22c55e;
            box-shadow: 0 0 6px #22c55e;
        }

        /* Timeline Slider Container */
        .timeline-container {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        #time-label {
            font-family: 'Roboto', monospace;
            font-size: 10px;
            font-weight: 700;
            color: #38bdf8;
            background: #141922;
            border: 1px solid #1f2735;
            padding: 2px 6px;
            border-radius: 4px;
            flex-shrink: 0;
            min-width: 36px;
            height: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            letter-spacing: 0.3px;
        }

        /* Custom BaroClinic Range Slider */
        input[type=range] {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            background: transparent;
            touch-action: pan-x;
            user-select: none;
            -webkit-user-select: none;
        }

        input[type=range]:focus {
            outline: none;
        }

        input[type=range]::-webkit-slider-runnable-track {
            width: 100%;
            height: 6px;
            cursor: pointer;
            background: #232b3c;
            border-radius: 3px;
            border: none;
        }

        input[type=range]::-webkit-slider-thumb {
            height: 18px;
            width: 18px;
            border-radius: 50%;
            background: #38bdf8;
            cursor: pointer;
            -webkit-appearance: none;
            margin-top: -6px;
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.6);
            transition: transform 0.1s ease, background 0.1s ease;
        }

        input[type=range]::-webkit-slider-thumb:hover {
            transform: scale(1.2);
            background: #60a5fa;
        }

        input[type=range]::-moz-range-track {
            width: 100%;
            height: 6px;
            cursor: pointer;
            background: #232b3c;
            border-radius: 3px;
            border: none;
        }

        input[type=range]::-moz-range-thumb {
            height: 18px;
            width: 18px;
            border-radius: 50%;
            background: #38bdf8;
            cursor: pointer;
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.6);
        }

        /* شريط التاريخ في نسخة الموبايل */
        #mobile-date-banner {
            display: none;
        }

        /* ==========================================
           RESPONSIVE MOBILE VIEW (شاشات الهواتف)
           تحويل الشريط السفلي إلى شريط زجاجي عائم (Floating Glassmorphism Bar)
           مع الحفاظ على نسخة الكمبيوتر كاملة وكافة السرعات والآليات
           ========================================== */
        @media (max-width: 768px) {
            html, body {
                overflow-x: hidden;
                overflow-y: auto;
                overscroll-behavior-y: auto;
                -webkit-overflow-scrolling: touch;
            }

            #top-nav {
                height: 48px;
                padding: 0 12px;
            }

            body {
                overflow-x: hidden;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-height: 100vh;
            }

            #map-container {
                position: relative;
                top: 0;
                margin-top: 52px;
                padding: 6px 12px 0 12px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
                box-sizing: border-box;
                width: 100%;
                flex-shrink: 0;
            }

            #mobile-date-banner {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                background: rgba(17, 24, 39, 0.72);
                border: 1px solid rgba(56, 189, 248, 0.25);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border-radius: 20px;
                padding: 4px 12px;
                margin: 4px auto 8px auto;
                font-size: 10.5px;
                font-weight: 500;
                color: #e0f2fe;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 10px rgba(56, 189, 248, 0.1);
                direction: rtl;
                letter-spacing: 0.1px;
                z-index: 20;
            }

            #mobile-date-banner .cal-icon {
                font-size: 11px;
                filter: drop-shadow(0 0 3px rgba(56, 189, 248, 0.5));
            }

            .image-stage {
                display: inline-block;
                position: relative;
                overflow: hidden;
                border: 1px solid rgba(56, 189, 248, 0.28) !important;
                border-radius: 8px;
                box-shadow: 0 0 25px rgba(0, 0, 0, 0.9), 0 0 15px rgba(56, 189, 248, 0.12) !important;
                background: #070a12;
                line-height: 0;
            }

            #satellite-image {
                max-width: 100%;
                max-height: calc(100vh - 240px);
                width: auto;
                height: auto;
                object-fit: scale-down;
                border-radius: 0 !important;
                border: none !important;
                box-shadow: none !important;
                outline: none !important;
                box-sizing: border-box;
                display: block;
                transition: transform 0.28s cubic-bezier(0.25, 1, 0.5, 1);
                cursor: zoom-in;
                -webkit-tap-highlight-color: transparent;
            }

            #satellite-image.is-zoomed {
                cursor: zoom-out;
            }

            /* الشريط الزجاجي أسفل صورة القمر بمسافة سطرين واضحة ومستقلة */
            #bottom-panel {
                position: relative;
                margin: 22px 12px 28px 12px; /* مسافة سطرين (22px) تفصله بوضوح عن أسفل الصورة */
                height: auto;
                background: rgba(17, 21, 30, 0.85);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(56, 189, 248, 0.25);
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.75), 0 0 15px rgba(56, 189, 248, 0.1);
                flex-direction: column;
                justify-content: center;
                align-items: stretch;
                padding: 10px 14px;
                gap: 8px;
                z-index: 40;
                width: calc(100% - 24px);
                max-width: 440px;
                box-sizing: border-box;
                flex-shrink: 0;
            }

            .controls-group {
                justify-content: space-between;
                width: 100%;
            }

            .ctrl-btn {
                width: 36px;
                height: 36px;
            }

            .timeline-container {
                width: 100%;
                gap: 8px;
            }

            /* تصغير بوكس التوقيت للجوال ليكون ملموماً وناعماً جداً داخل الصورة */
            #time-hud {
                top: 5px;
                right: 5px;
                padding: 1.5px 4.5px;
                font-size: 7.5px;
                border-radius: 3px;
                letter-spacing: 0.1px;
                background: rgba(15, 23, 42, 0.75);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            /* تحسين زر قائمة الأقمار في الجوال ليظل ثابتاً ولا يرتفع أو يشوه الهيدر */
            .model-dropdown-btn {
                padding: 4px 8px;
                font-size: 11px;
                gap: 5px;
                max-width: 165px;
            }

            #current-model-name {
                display: inline-block;
                max-width: 105px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                vertical-align: middle;
            }

            .logo-badge {
                font-size: 11px;
                padding: 3px 6px;
                letter-spacing: 0.8px;
            }
        }
    </style>
</head>
<body>

    <!-- TOP NAVIGATION -->
    <header id="top-nav">
        <div class="nav-left">
            <div class="logo">
                <div class="sat-icon-wrap" title="Orbiting Satellite">
                    <svg class="sat-icon-svg" viewBox="0 0 24 24">
                        <!-- Satellite body & solar wings -->
                        <path d="M13 7l4-4 4 4-4 4"/>
                        <path d="M7 13l-4 4 4 4 4-4"/>
                        <rect x="8.5" y="8.5" width="7" height="7" rx="1.5" transform="rotate(45 12 12)" fill="rgba(56,189,248,0.2)"/>
                        <circle cx="12" cy="12" r="1.5" fill="#38bdf8"/>
                    </svg>
                    <span class="sat-beam"></span>
                </div>
                <span class="logo-badge">METEOSAT NAJD</span>
            </div>
        </div>

        <!-- ECMWF-IFS Style Satellite Product Switcher -->
        <div class="model-select-wrapper">
            <button id="model-select-btn" class="model-dropdown-btn">
                <span class="pill-tag">SAT</span>
                <span id="current-model-name">قائمة الأقمار</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 10l5 5 5-5z"/>
                </svg>
            </button>

            <div id="satellite-dropdown" class="dropdown-menu">
                <div class="dropdown-item active" data-sat="sat1" data-label="Super HD (Day Visible)">
                    <span>1. Super HD (Day Visible)</span>
                </div>
                <div class="dropdown-item" data-sat="sat2" data-label="Color Super HD">
                    <span>2. Color Super HD</span>
                </div>
                <div class="dropdown-item" data-sat="sat3" data-label="Sandwich IR + VIS">
                    <span>3. Sandwich IR + VIS</span>
                </div>
                <div class="dropdown-item" data-sat="sat4" data-label="Cloud Phase">
                    <span>4. Cloud Phase (Thermodynamics)</span>
                </div>
                <div class="dropdown-item" data-sat="sat5" data-label="Infrared 24h">
                    <span>5. Infrared 10.8µm (24H Thermal)</span>
                </div>
                <div class="dropdown-item" data-sat="sat6" data-label="Cloud Tops Alert">
                    <span>6. Cloud Tops Alert (Severe)</span>
                </div>
                <div class="dropdown-item" data-sat="sat7" data-label="Dust & Sand">
                    <span>7. Dust & Sand Tracking</span>
                </div>
                <div class="dropdown-item" data-sat="sat8" data-label="Air Mass Dynamics">
                    <span>8. Air Mass & Jet Dynamics</span>
                </div>
                <div class="dropdown-item" data-sat="sat9" data-label="Fog-Check Stratus">
                    <span>9. Fog-Check & Low Stratus</span>
                </div>
            </div>
        </div>
    </header>

    <!-- SATELLITE VIEWER CANVAS -->
    <main id="map-container">
        <!-- شريط التاريخ المحدث الهجري والميلادي في نسخة الموبايل -->
        <div id="mobile-date-banner">
            <span class="cal-icon">📅</span>
            <span id="mobile-date-text"></span>
        </div>

        <div class="image-stage">
            <!-- Frame Time Indicator (داخل حدود صورة القمر دائماً) -->
            <div id="time-hud">${initialDate}</div>

            <!-- The Image Element -->
            <img id="satellite-image" src="${initialImage}" alt="Najd Sat Feed">
        </div>
    </main>

    <!-- BOTTOM CONTROLS & TIMELINE -->
    <footer id="bottom-panel">
        <div class="controls-group">
            <button id="btn-play" class="ctrl-btn" title="Play/Pause">
                <svg id="play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                <svg id="pause-icon" viewBox="0 0 24 24" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <button id="btn-prev" class="ctrl-btn" title="Previous Frame">
                <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button id="btn-next" class="ctrl-btn" title="Next Frame">
                <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
            <button id="btn-speed" class="speed-btn" title="Change Playback Speed">1.0X</button>
            <button id="btn-latest" class="live-btn" title="Jump to Latest">
                <span class="live-btn-dot"></span>
                LIVE
            </button>
        </div>

        <div class="timeline-container">
            <span id="time-label">${initialTime}</span>
            <input id="timeline-slider" type="range" min="0" max="${maxIdx}" value="${maxIdx}">
        </div>
    </footer>

<script>
    const nonaData = ${JSON.stringify(nonaData)};
    let currentSat = 'sat1';
    let currentIndex = (nonaData.sat1 && nonaData.sat1.length > 0) ? nonaData.sat1.length - 1 : 0;
    let isPlaying = false; // الوضع الافتراضي متوقف عند آخر تحديث حي
    let playInterval = null;
    let speeds = [400, 200, 100];
    let speedLabels = ['1.0X', '2.0X', '3.0X'];
    let speedIndex = 0; // default 1.0X

    const satTitles = {
        sat1: "Meteosat Super HD (10m)",
        sat2: "Meteosat Color Super HD",
        sat3: "Sandwich IR + VIS Composite",
        sat4: "Cloud Phase Thermodynamics",
        sat5: "Infrared 10.8 µm (24H Thermal)",
        sat6: "Cloud Tops Alert & Severe Weather",
        sat7: "Dust & Aerosol Tracking",
        sat8: "Air Mass & Jet Dynamics",
        sat9: "Fog-Check & Low Stratus"
    };

    const satImg = document.getElementById('satellite-image');
    const timeHud = document.getElementById('time-hud');
    const timeLabel = document.getElementById('time-label');
    const timelineSlider = document.getElementById('timeline-slider');
    const btnPlay = document.getElementById('btn-play');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnLatest = document.getElementById('btn-latest');
    const btnSpeed = document.getElementById('btn-speed');
    const modelBtn = document.getElementById('model-select-btn');
    const dropdown = document.getElementById('satellite-dropdown');
    const currentModelName = document.getElementById('current-model-name');

    // Toggle Dropdown
    modelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        dropdown.classList.remove('show');
    });

    // Switch Satellite via Dropdown with exact Time Synchronization
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const prevSat = currentSat;
            const prevList = nonaData[prevSat] || [];
            const currentTimeStr = (prevList[currentIndex]) ? (prevList[currentIndex].date + ' ' + prevList[currentIndex].time) : null;

            currentSat = item.getAttribute('data-sat');
            currentModelName.textContent = item.getAttribute('data-label');
            
            const list = nonaData[currentSat] || [];
            timelineSlider.max = Math.max(0, list.length - 1);

            // مطابقة الفريم الجديد بنفس التوقيت الدقيق الذي كان يقف عنده المستخدم
            let targetIndex = -1;
            if (currentTimeStr) {
                targetIndex = list.findIndex(f => (f.date + ' ' + f.time) === currentTimeStr);
            }

            // إذا تطابق نفس التوقيت ننتقل له فوراً، وإلا نحافظ على نفس رقم المؤشر الحالي
            if (targetIndex !== -1) {
                currentIndex = targetIndex;
            } else {
                currentIndex = Math.min(currentIndex, Math.max(0, list.length - 1));
            }

            showFrame(currentIndex);
            preloadSatImages(currentSat); // تفعيل الكاش الفوري للقمر الجديد
            dropdown.classList.remove('show');
        });
    });

    // ==========================================
    // محرك التحميل المسبق الصامت الفائق (Instant Cache Engine)
    // ==========================================
    const imageCache = {};

    function preloadSatImages(satKey) {
        const list = nonaData[satKey] || [];
        if (!list || list.length === 0) return;
        if (!imageCache[satKey]) imageCache[satKey] = {};

        // الأولوية 1: تحميل أحدث 15 صورة فوراً لتكون الحركة سلسة كالبرق
        for (let i = list.length - 1; i >= Math.max(0, list.length - 15); i--) {
            const f = list[i].file;
            if (!imageCache[satKey][f]) {
                const img = new Image();
                img.src = f;
                imageCache[satKey][f] = img;
            }
        }

        // الأولوية 2: تحميل باقي صور الـ 12 ساعة في الخفاء بتتابع هادئ
        let remainingIdx = list.length - 16;
        const bgTimer = setInterval(() => {
            if (remainingIdx < 0) {
                clearInterval(bgTimer);
                return;
            }
            const f = list[remainingIdx].file;
            if (!imageCache[satKey][f]) {
                const img = new Image();
                img.src = f;
                imageCache[satKey][f] = img;
            }
            remainingIdx--;
        }, 150);
    }

    function showFrame(index) {
        const list = nonaData[currentSat] || [];
        if (!list || list.length === 0) return;
        currentIndex = Math.max(0, Math.min(index, list.length - 1));

        const frame = list[currentIndex];
        satImg.src = frame.file;
        timeHud.textContent = frame.date + ' ' + frame.time;
        timeLabel.textContent = frame.time.replace(' KSA', '');
        timelineSlider.value = currentIndex;
    }

    function togglePlay() {
        if (isPlaying) {
            clearInterval(playInterval);
            isPlaying = false;
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        } else {
            isPlaying = true;
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
            startLoop();
        }
    }

    function startLoop() {
        clearInterval(playInterval);
        playInterval = setInterval(() => {
            const list = nonaData[currentSat] || [];
            if (!list || list.length === 0) return;
            let nextIndex = currentIndex + 1;
            if (nextIndex >= list.length) {
                nextIndex = 0;
            }
            showFrame(nextIndex);
        }, speeds[speedIndex]);
    }

    btnPlay.addEventListener('click', togglePlay);
    btnPrev.addEventListener('click', () => { if (isPlaying) togglePlay(); showFrame(currentIndex - 1); });
    btnNext.addEventListener('click', () => { if (isPlaying) togglePlay(); showFrame(currentIndex + 1); });
    btnLatest.addEventListener('click', () => {
        if (isPlaying) {
            togglePlay(); // إيقاف الحركة المؤقتة للتثبيت عند البث المباشر
        }
        const list = nonaData[currentSat] || [];
        showFrame(list.length - 1);
    });

    timelineSlider.addEventListener('input', (e) => {
        if (isPlaying) togglePlay();
        showFrame(parseInt(e.target.value));
    });

    timelineSlider.addEventListener('change', (e) => {
        if (isPlaying) togglePlay();
        showFrame(parseInt(e.target.value));
    });

    // تحسين استجابة اللمس على الجوال لمنع تعليق أو تداخل السحب
    timelineSlider.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        if (isPlaying) togglePlay();
    }, { passive: true });

    timelineSlider.addEventListener('touchmove', (e) => {
        e.stopPropagation();
    }, { passive: true });

    btnSpeed.addEventListener('click', () => {
        speedIndex = (speedIndex + 1) % speeds.length;
        btnSpeed.textContent = speedLabels[speedIndex];
        if (isPlaying) startLoop();
    });

    // ==========================================
    // حماية الخصوصية: تعطيل كليك يمين واختصارات الفحص لمنع معرفة مسارات الصور
    // ==========================================
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('dragstart', (e) => e.preventDefault());
    document.addEventListener('keydown', (e) => {
        // منع F12 واختصارات فحص العناصر وعرض السورس (Ctrl+U, Ctrl+Shift+I, Cmd+Opt+I)
        if (e.key === 'F12' || 
            ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S')) ||
            ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
            (e.metaKey && e.altKey && (e.key === 'i' || e.key === 'I' || e.key === 'u' || e.key === 'U' || e.key === 'c' || e.key === 'C'))) {
            e.preventDefault();
            return false;
        }
    });

    // ميزة التكبير الذكي مع إمكانية السحب المحكوم بدقة داخل الإطار بدون كشف أي سواد للجوال فقط
    let isZoomed = false;
    let panStartX = 0, panStartY = 0;
    let currentPanX = 0, currentPanY = 0;
    let startPanX = 0, startPanY = 0;
    let isPanning = false;
    let hasMoved = false;

    function applyBoundedPan() {
        const stage = satImg.parentElement;
        const stageW = stage.clientWidth;
        const stageH = stage.clientHeight;
        const maxPanX = (stageW * (2.0 - 1)) / 2; // أقصى حد للسحب يميناً ويساراً بدون خروج الصورة عن الإطار
        const maxPanY = (stageH * (2.0 - 1)) / 2; // أقصى حد للسحب أعلى وأسفل بدون خروج الصورة عن الإطار

        if (currentPanX > maxPanX) currentPanX = maxPanX;
        if (currentPanX < -maxPanX) currentPanX = -maxPanX;
        if (currentPanY > maxPanY) currentPanY = maxPanY;
        if (currentPanY < -maxPanY) currentPanY = -maxPanY;

        satImg.style.transform = "scale(2.0) translate(" + (currentPanX / 2.0) + "px, " + (currentPanY / 2.0) + "px)";
    }

    satImg.addEventListener("touchstart", (e) => {
        if (window.innerWidth > 768 || !isZoomed) return;
        if (e.touches.length === 1) {
            isPanning = true;
            hasMoved = false;
            panStartX = e.touches[0].clientX;
            panStartY = e.touches[0].clientY;
            startPanX = currentPanX;
            startPanY = currentPanY;
            satImg.style.transition = "none";
        }
    }, { passive: false });

    window.addEventListener("touchmove", (e) => {
        if (!isPanning || !isZoomed) return;
        if (e.touches.length === 1) {
            const dx = e.touches[0].clientX - panStartX;
            const dy = e.touches[0].clientY - panStartY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasMoved = true;
                if (e.cancelable) e.preventDefault();
            }
            currentPanX = startPanX + dx;
            currentPanY = startPanY + dy;
            applyBoundedPan();
        }
    }, { passive: false });

    window.addEventListener("touchend", () => {
        if (!isPanning) return;
        isPanning = false;
        satImg.style.transition = "transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)";
    });

    satImg.addEventListener("click", (e) => {
        if (window.innerWidth > 768) return;
        if (hasMoved) return;

        if (!isZoomed) {
            const stage = satImg.parentElement;
            const stageRect = stage.getBoundingClientRect();
            // مركز التقريب يتم حسابه نسبة لنقطة لمس المستخدم ليكون سلس ومحكوم
            const touchRelX = e.clientX - (stageRect.left + stageRect.width / 2);
            const touchRelY = e.clientY - (stageRect.top + stageRect.height / 2);
            satImg.style.transformOrigin = "center center";
            currentPanX = -touchRelX;
            currentPanY = -touchRelY;
            satImg.style.transition = "transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)";
            applyBoundedPan();
            satImg.classList.add("is-zoomed");
            isZoomed = true;
        } else {
            satImg.style.transition = "transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)";
            satImg.style.transform = "scale(1.0) translate(0px, 0px)";
            satImg.classList.remove("is-zoomed");
            setTimeout(() => {
                satImg.style.transformOrigin = "center center";
                satImg.style.transform = "";
                currentPanX = 0;
                currentPanY = 0;
            }, 280);
            isZoomed = false;
        }
    });

    // دعم سحب الشاشة للأسفل للتحديث (Native & Smooth Pull-to-Refresh)
    let touchStartY = 0;
    let touchStartX = 0;
    let isPulling = false;

    window.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1 && window.scrollY <= 5) {
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
            isPulling = true;
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isPulling || e.touches.length !== 1) return;
        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        const deltaY = currentY - touchStartY;
        const deltaX = Math.abs(currentX - touchStartX);

        // إذا كانت الحركة سحباً عمودياً واضحاً للأسفل من أعلى الصفحة بأكثر من 130 بكسل
        if (deltaY > 130 && deltaX < 60 && window.scrollY <= 0) {
            isPulling = false;
            // وميض خفيف ينبّه المستخدم بالتحديث الفوري
            document.body.style.opacity = '0.6';
            document.body.style.transition = 'opacity 0.2s ease';
            setTimeout(() => {
                window.location.reload();
            }, 150);
        }
    }, { passive: true });

    window.addEventListener('touchend', () => {
        isPulling = false;
    }, { passive: true });

    // تحديث التاريخ الهجري والميلادي لنسخة الموبايل تلقائياً
    function updateMobileDate() {
        try {
            const now = new Date();
            const hijriFmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            const gregFmt = new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            const dateStr = (hijriFmt.format(now) + ' الموافق ' + gregFmt.format(now) + ' م').replace('،', '');
            const el = document.getElementById('mobile-date-text');
            if (el) el.textContent = dateStr;
        } catch(e) {}
    }
    updateMobileDate();

    // Start at latest frame without auto-play
    showFrame(currentIndex);
    preloadSatImages(currentSat); // بدء التحميل المسبق الصامت للقمر الافتراضي فور فتح الصفحة

    // ==========================================
    // AUTO-POLLING: فحص وتحديث الفريمات الجديدة تلقائياً بسرعة فائقة كل 15 ثانية
    // ==========================================
    setInterval(async () => {
        try {
            const res = await fetch('nona_manifest.json?t=' + Date.now());
            if (res.ok) {
                const freshData = await res.json();
                let hasUpdate = false;
                
                // التحقق مما إذا كان هناك فريمات أحدث
                for (const satKey of Object.keys(freshData)) {
                    const currentLen = (nonaData[satKey] || []).length;
                    const freshLen = (freshData[satKey] || []).length;
                    if (freshLen !== currentLen || (freshLen > 0 && currentLen > 0 && freshData[satKey][freshLen - 1].file !== nonaData[satKey][currentLen - 1].file)) {
                        hasUpdate = true;
                        nonaData[satKey] = freshData[satKey];
                    }
                }

                if (hasUpdate) {
                    console.log('⚡ تم التقاط تحديث جديد للأقمار ودمجه في التايم لاين تلقائياً!');
                    const list = nonaData[currentSat] || [];
                    timelineSlider.max = Math.max(0, list.length - 1);

                    // وميض أخضر خفيف على زر LIVE لإعلام المستخدم بوصول فريم رصدي جديد
                    btnLatest.style.boxShadow = '0 0 15px #22c55e';
                    btnLatest.style.borderColor = '#22c55e';
                    setTimeout(() => {
                        btnLatest.style.boxShadow = '';
                        btnLatest.style.borderColor = '';
                    }, 3500);

                    // إذا كان المشاهد في وضع التوقف التام عند آخر صورة، نحدثها له مباشرة
                    if (!isPlaying && currentIndex >= list.length - 2) {
                        currentIndex = list.length - 1;
                        showFrame(currentIndex);
                    }
                }
            }
        } catch (e) {}
    }, 15000); // فحص راداري سريع كل 15 ثانية فقط لاقتناص أي تحديث فوراً!
</script>

</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'viewer.html'), htmlContent);
console.log('Najd Sat ECMWF-style viewer.html built successfully!');
