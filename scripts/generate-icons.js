const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Android adaptive icon sizes (background+foreground = 108dp each density)
const ANDROID_SIZES = {
  'mipmap-mdpi':    { icon: 48,  adaptive: 108 },
  'mipmap-hdpi':    { icon: 72,  adaptive: 162 },
  'mipmap-xhdpi':   { icon: 96,  adaptive: 216 },
  'mipmap-xxhdpi':  { icon: 144, adaptive: 324 },
  'mipmap-xxxhdpi': { icon: 192, adaptive: 432 },
};

const RES_DIR = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Generate SVG for background (dark amber gradient)
function makeBackground(size) {
  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#2E1A00"/>
      <stop offset="60%" stop-color="#1A0E00"/>
      <stop offset="100%" stop-color="#120900"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="45%">
      <stop offset="0%" stop-color="#F5A623" stop-opacity="0.18"/>
      <stop offset="70%" stop-color="#F5A623" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#F5A623" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" fill="url(#glow)"/>
</svg>`);
}

// Generate SVG for foreground (house icon centered in 108dp safe zone)
function makeForeground(size) {
  // Adaptive icon: 108dp total, 72dp safe zone centered (18dp padding each side)
  // So icon content should be within center 66.67% of the canvas
  const pad = size * 0.22; // ~18/108 padding
  const area = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2 - area * 0.02;

  // House proportions relative to area
  const houseW = area * 0.52;
  const houseH = area * 0.60;
  const houseL = cx - houseW / 2;
  const roofPeak = cy - houseH / 2;
  const roofBase = cy - houseH * 0.08;
  const bodyTop = roofBase;
  const bodyH = houseH * 0.48;
  const bodyBottom = bodyTop + bodyH;

  // Roof overhang
  const roofL = houseL - houseW * 0.12;
  const roofR = houseL + houseW + houseW * 0.12;

  // Door
  const doorW = houseW * 0.22;
  const doorH = bodyH * 0.56;
  const doorL = cx - doorW / 2;
  const doorT = bodyBottom - doorH;
  const doorR = doorW * 0.3;

  // Windows
  const winS = houseW * 0.17;
  const winY = bodyTop + bodyH * 0.18;
  const winL1 = houseL + houseW * 0.14;
  const winL2 = houseL + houseW - houseW * 0.14 - winS;
  const winR = winS * 0.2;

  // Chimney
  const chimW = houseW * 0.12;
  const chimH = houseH * 0.18;
  const chimL = houseL + houseW * 0.65;
  const chimT = roofPeak + (roofBase - roofPeak) * 0.2;

  // Sparkle
  const sparkX = cx;
  const sparkY = roofPeak - area * 0.06;
  const sparkR = area * 0.025;

  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="roofG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFD04A"/>
      <stop offset="100%" stop-color="#F5A623"/>
    </linearGradient>
    <linearGradient id="bodyG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3A2200"/>
      <stop offset="100%" stop-color="#2E1A00"/>
    </linearGradient>
    <linearGradient id="doorG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFD04A"/>
      <stop offset="100%" stop-color="#E8920A"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="${size * 0.015}" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="roofShadow">
      <feDropShadow dx="0" dy="${size * 0.005}" stdDeviation="${size * 0.008}" flood-color="#000" flood-opacity="0.4"/>
    </filter>
    <filter id="sparkGlow">
      <feGaussianBlur stdDeviation="${size * 0.01}"/>
    </filter>
  </defs>

  <!-- Chimney -->
  <rect x="${chimL}" y="${chimT}" width="${chimW}" height="${chimH}"
    rx="${chimW * 0.2}" fill="#C4720A"/>

  <!-- Roof -->
  <polygon points="${cx},${roofPeak} ${roofL},${roofBase} ${roofR},${roofBase}"
    fill="url(#roofG)" filter="url(#roofShadow)"/>

  <!-- Body -->
  <rect x="${houseL}" y="${bodyTop}" width="${houseW}" height="${bodyH}"
    rx="${houseW * 0.04}" fill="url(#bodyG)"
    stroke="rgba(245,166,35,0.30)" stroke-width="${size * 0.003}"/>

  <!-- Door -->
  <rect x="${doorL}" y="${doorT}" width="${doorW}" height="${doorH}"
    rx="${doorR}" fill="url(#doorG)"/>
  <!-- Door knob -->
  <circle cx="${doorL + doorW * 0.72}" cy="${doorT + doorH * 0.52}"
    r="${doorW * 0.08}" fill="#3A2200"/>

  <!-- Window left -->
  <rect x="${winL1}" y="${winY}" width="${winS}" height="${winS}" rx="${winR}"
    fill="rgba(245,166,35,0.15)" stroke="rgba(245,166,35,0.50)" stroke-width="${size * 0.003}"/>
  <line x1="${winL1 + winS/2}" y1="${winY}" x2="${winL1 + winS/2}" y2="${winY + winS}"
    stroke="rgba(245,166,35,0.30)" stroke-width="${size * 0.002}"/>
  <line x1="${winL1}" y1="${winY + winS/2}" x2="${winL1 + winS}" y2="${winY + winS/2}"
    stroke="rgba(245,166,35,0.30)" stroke-width="${size * 0.002}"/>

  <!-- Window right -->
  <rect x="${winL2}" y="${winY}" width="${winS}" height="${winS}" rx="${winR}"
    fill="rgba(245,166,35,0.15)" stroke="rgba(245,166,35,0.50)" stroke-width="${size * 0.003}"/>
  <line x1="${winL2 + winS/2}" y1="${winY}" x2="${winL2 + winS/2}" y2="${winY + winS}"
    stroke="rgba(245,166,35,0.30)" stroke-width="${size * 0.002}"/>
  <line x1="${winL2}" y1="${winY + winS/2}" x2="${winL2 + winS}" y2="${winY + winS/2}"
    stroke="rgba(245,166,35,0.30)" stroke-width="${size * 0.002}"/>

  <!-- Sparkle star -->
  <circle cx="${sparkX}" cy="${sparkY}" r="${sparkR * 3}" fill="#FFD700" opacity="0.25" filter="url(#sparkGlow)"/>
  <path d="M${sparkX} ${sparkY - sparkR} L${sparkX + sparkR * 0.3} ${sparkY - sparkR * 0.3}
    L${sparkX + sparkR} ${sparkY} L${sparkX + sparkR * 0.3} ${sparkY + sparkR * 0.3}
    L${sparkX} ${sparkY + sparkR} L${sparkX - sparkR * 0.3} ${sparkY + sparkR * 0.3}
    L${sparkX - sparkR} ${sparkY} L${sparkX - sparkR * 0.3} ${sparkY - sparkR * 0.3} Z"
    fill="#FFD700"/>

  <!-- Ambient glow under house -->
  <ellipse cx="${cx}" cy="${bodyBottom + area * 0.02}" rx="${houseW * 0.5}" ry="${area * 0.015}"
    fill="#F5A623" opacity="0.12"/>
</svg>`);
}

// Generate a combined (non-adaptive) icon
function makeFullIcon(size) {
  const r = size * 0.18; // corner radius
  const pad = size * 0.08;
  const area = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2 - area * 0.02;

  const houseW = area * 0.48;
  const houseH = area * 0.55;
  const houseL = cx - houseW / 2;
  const roofPeak = cy - houseH / 2;
  const roofBase = cy - houseH * 0.06;
  const bodyTop = roofBase;
  const bodyH = houseH * 0.48;
  const bodyBottom = bodyTop + bodyH;
  const roofL = houseL - houseW * 0.12;
  const roofR = houseL + houseW + houseW * 0.12;

  const doorW = houseW * 0.22;
  const doorH = bodyH * 0.56;
  const doorL = cx - doorW / 2;
  const doorT = bodyBottom - doorH;
  const doorR2 = doorW * 0.3;

  const winS = houseW * 0.17;
  const winY = bodyTop + bodyH * 0.18;
  const winL1 = houseL + houseW * 0.14;
  const winL2 = houseL + houseW - houseW * 0.14 - winS;
  const winRad = winS * 0.2;

  const chimW = houseW * 0.12;
  const chimH = houseH * 0.18;
  const chimL = houseL + houseW * 0.65;
  const chimT = roofPeak + (roofBase - roofPeak) * 0.2;

  const sparkX = cx;
  const sparkY = roofPeak - area * 0.05;
  const sr = area * 0.022;

  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgF" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#2E1A00"/>
      <stop offset="100%" stop-color="#1A0E00"/>
    </radialGradient>
    <radialGradient id="glowF" cx="50%" cy="40%" r="45%">
      <stop offset="0%" stop-color="#F5A623" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#F5A623" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="roofF" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFD04A"/>
      <stop offset="100%" stop-color="#F5A623"/>
    </linearGradient>
    <linearGradient id="bodyF" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3A2200"/>
      <stop offset="100%" stop-color="#2E1A00"/>
    </linearGradient>
    <linearGradient id="doorF" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFD04A"/>
      <stop offset="100%" stop-color="#E8920A"/>
    </linearGradient>
    <clipPath id="clip"><rect width="${size}" height="${size}" rx="${r}"/></clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect width="${size}" height="${size}" fill="url(#bgF)"/>
    <rect width="${size}" height="${size}" fill="url(#glowF)"/>
    <rect x="${chimL}" y="${chimT}" width="${chimW}" height="${chimH}" rx="${chimW*0.2}" fill="#C4720A"/>
    <polygon points="${cx},${roofPeak} ${roofL},${roofBase} ${roofR},${roofBase}" fill="url(#roofF)"/>
    <rect x="${houseL}" y="${bodyTop}" width="${houseW}" height="${bodyH}" rx="${houseW*0.04}" fill="url(#bodyF)" stroke="rgba(245,166,35,0.30)" stroke-width="${size*0.004}"/>
    <rect x="${doorL}" y="${doorT}" width="${doorW}" height="${doorH}" rx="${doorR2}" fill="url(#doorF)"/>
    <circle cx="${doorL + doorW*0.72}" cy="${doorT + doorH*0.52}" r="${doorW*0.08}" fill="#3A2200"/>
    <rect x="${winL1}" y="${winY}" width="${winS}" height="${winS}" rx="${winRad}" fill="rgba(245,166,35,0.15)" stroke="rgba(245,166,35,0.50)" stroke-width="${size*0.004}"/>
    <line x1="${winL1+winS/2}" y1="${winY}" x2="${winL1+winS/2}" y2="${winY+winS}" stroke="rgba(245,166,35,0.30)" stroke-width="${size*0.003}"/>
    <line x1="${winL1}" y1="${winY+winS/2}" x2="${winL1+winS}" y2="${winY+winS/2}" stroke="rgba(245,166,35,0.30)" stroke-width="${size*0.003}"/>
    <rect x="${winL2}" y="${winY}" width="${winS}" height="${winS}" rx="${winRad}" fill="rgba(245,166,35,0.15)" stroke="rgba(245,166,35,0.50)" stroke-width="${size*0.004}"/>
    <line x1="${winL2+winS/2}" y1="${winY}" x2="${winL2+winS/2}" y2="${winY+winS}" stroke="rgba(245,166,35,0.30)" stroke-width="${size*0.003}"/>
    <line x1="${winL2}" y1="${winY+winS/2}" x2="${winL2+winS}" y2="${winY+winS/2}" stroke="rgba(245,166,35,0.30)" stroke-width="${size*0.003}"/>
    <path d="M${sparkX} ${sparkY-sr} L${sparkX+sr*0.3} ${sparkY-sr*0.3} L${sparkX+sr} ${sparkY} L${sparkX+sr*0.3} ${sparkY+sr*0.3} L${sparkX} ${sparkY+sr} L${sparkX-sr*0.3} ${sparkY+sr*0.3} L${sparkX-sr} ${sparkY} L${sparkX-sr*0.3} ${sparkY-sr*0.3} Z" fill="#FFD700"/>
    <ellipse cx="${cx}" cy="${bodyBottom + area*0.02}" rx="${houseW*0.5}" ry="${area*0.012}" fill="#F5A623" opacity="0.12"/>
  </g>
</svg>`);
}

async function generate() {
  console.log('Generating Dark Amber app icons...');

  for (const [folder, sizes] of Object.entries(ANDROID_SIZES)) {
    const dir = path.join(RES_DIR, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Background
    await sharp(makeBackground(sizes.adaptive))
      .resize(sizes.adaptive, sizes.adaptive)
      .png()
      .toFile(path.join(dir, 'ic_launcher_background.png'));

    // Foreground
    await sharp(makeForeground(sizes.adaptive))
      .resize(sizes.adaptive, sizes.adaptive)
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    // Combined icon
    await sharp(makeFullIcon(sizes.icon))
      .resize(sizes.icon, sizes.icon)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // Round icon (same as combined but circular)
    await sharp(makeFullIcon(sizes.icon))
      .resize(sizes.icon, sizes.icon)
      .composite([{
        input: Buffer.from(`<svg width="${sizes.icon}" height="${sizes.icon}">
          <rect width="${sizes.icon}" height="${sizes.icon}" fill="white" rx="${sizes.icon / 2}"/>
        </svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    console.log(`  ✓ ${folder} (${sizes.icon}px icon, ${sizes.adaptive}px adaptive)`);
  }

  console.log('\nDone! All icons generated with Dark Amber theme.');
}

generate().catch(console.error);
