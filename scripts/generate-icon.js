/**
 * Majordhome App Icon Generator
 * Design: Deep purple gradient background with a stylized house + crown silhouette
 * Uses SVG → Sharp for pixel-perfect rendering at all sizes
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// ─── Icon SVG (1024×1024 master) ─────────────────────────
const ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <!-- Background gradient: deep purple to violet -->
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3A1F8C"/>
      <stop offset="50%" stop-color="#5B3FD4"/>
      <stop offset="100%" stop-color="#7C5CFC"/>
    </linearGradient>
    <!-- House body gradient -->
    <linearGradient id="house" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E8E0FF"/>
    </linearGradient>
    <!-- Gold accent -->
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFD700"/>
      <stop offset="100%" stop-color="#FFA726"/>
    </linearGradient>
    <!-- Soft glow behind house -->
    <radialGradient id="glow" cx="0.5" cy="0.48" r="0.35">
      <stop offset="0%" stop-color="rgba(167,139,250,0.4)"/>
      <stop offset="100%" stop-color="rgba(167,139,250,0)"/>
    </radialGradient>
    <!-- Door gradient -->
    <linearGradient id="door" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#5B3FD4"/>
      <stop offset="100%" stop-color="#3A1F8C"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" rx="224" fill="url(#bg)"/>

  <!-- Subtle grid pattern overlay -->
  <g opacity="0.04">
    <line x1="256" y1="0" x2="256" y2="1024" stroke="white" stroke-width="1"/>
    <line x1="512" y1="0" x2="512" y2="1024" stroke="white" stroke-width="1"/>
    <line x1="768" y1="0" x2="768" y2="1024" stroke="white" stroke-width="1"/>
    <line x1="0" y1="256" x2="1024" y2="256" stroke="white" stroke-width="1"/>
    <line x1="0" y1="512" x2="1024" y2="512" stroke="white" stroke-width="1"/>
    <line x1="0" y1="768" x2="1024" y2="768" stroke="white" stroke-width="1"/>
  </g>

  <!-- Glow behind house -->
  <rect width="1024" height="1024" fill="url(#glow)"/>

  <!-- House body (main rectangle) -->
  <rect x="310" y="460" width="404" height="300" rx="20" fill="url(#house)" opacity="0.95"/>

  <!-- Roof (triangle) -->
  <path d="M 512 240 L 260 480 L 764 480 Z" fill="url(#house)" opacity="0.95"/>

  <!-- Roof accent line -->
  <path d="M 512 260 L 280 480 L 744 480 Z" fill="none" stroke="url(#gold)" stroke-width="6" opacity="0.7"/>

  <!-- Chimney -->
  <rect x="620" y="300" width="50" height="120" rx="8" fill="url(#house)" opacity="0.9"/>

  <!-- Door -->
  <rect x="455" y="560" width="114" height="200" rx="57" fill="url(#door)"/>

  <!-- Door knob -->
  <circle cx="540" cy="665" r="10" fill="url(#gold)"/>

  <!-- Left window -->
  <rect x="335" y="510" width="85" height="75" rx="12" fill="url(#door)" opacity="0.8"/>
  <!-- Window cross -->
  <line x1="377.5" y1="510" x2="377.5" y2="585" stroke="rgba(255,255,255,0.4)" stroke-width="3"/>
  <line x1="335" y1="547.5" x2="420" y2="547.5" stroke="rgba(255,255,255,0.4)" stroke-width="3"/>
  <!-- Window glow -->
  <rect x="339" y="514" width="77" height="67" rx="10" fill="#FFBE0B" opacity="0.3"/>

  <!-- Right window -->
  <rect x="604" y="510" width="85" height="75" rx="12" fill="url(#door)" opacity="0.8"/>
  <!-- Window cross -->
  <line x1="646.5" y1="510" x2="646.5" y2="585" stroke="rgba(255,255,255,0.4)" stroke-width="3"/>
  <line x1="604" y1="547.5" x2="689" y2="547.5" stroke="rgba(255,255,255,0.4)" stroke-width="3"/>
  <!-- Window glow -->
  <rect x="608" y="514" width="77" height="67" rx="10" fill="#FFBE0B" opacity="0.3"/>

  <!-- Crown above the roof (majordome symbol) -->
  <g transform="translate(512, 205)" opacity="0.95">
    <!-- Crown body -->
    <path d="M -50 0 L -65 -55 L -30 -30 L 0 -65 L 30 -30 L 65 -55 L 50 0 Z"
          fill="url(#gold)" stroke="#FFD700" stroke-width="2"/>
    <!-- Crown gems -->
    <circle cx="0" cy="-42" r="7" fill="#FF6B6B"/>
    <circle cx="-35" cy="-28" r="5" fill="#7C5CFC"/>
    <circle cx="35" cy="-28" r="5" fill="#2ED47A"/>
    <!-- Crown base band -->
    <rect x="-50" y="-2" width="100" height="12" rx="3" fill="#FFD700"/>
  </g>

  <!-- Sparkle top-left -->
  <g transform="translate(190, 200)" opacity="0.6">
    <path d="M 0 -12 L 3 -3 L 12 0 L 3 3 L 0 12 L -3 3 L -12 0 L -3 -3 Z" fill="white"/>
  </g>

  <!-- Sparkle top-right -->
  <g transform="translate(830, 250)" opacity="0.5">
    <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill="white"/>
  </g>

  <!-- Sparkle bottom-left -->
  <g transform="translate(220, 700)" opacity="0.4">
    <path d="M 0 -6 L 1.5 -1.5 L 6 0 L 1.5 1.5 L 0 6 L -1.5 1.5 L -6 0 L -1.5 -1.5 Z" fill="white"/>
  </g>

  <!-- Sparkle bottom-right -->
  <g transform="translate(810, 650)" opacity="0.5">
    <path d="M 0 -10 L 2.5 -2.5 L 10 0 L 2.5 2.5 L 0 10 L -2.5 2.5 L -10 0 L -2.5 -2.5 Z" fill="white"/>
  </g>
</svg>
`;

// ─── Android adaptive icon (foreground only, with padding) ─
const ADAPTIVE_FG_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108">
  <defs>
    <linearGradient id="house" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E8E0FF"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFD700"/>
      <stop offset="100%" stop-color="#FFA726"/>
    </linearGradient>
    <linearGradient id="door" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#5B3FD4"/>
      <stop offset="100%" stop-color="#3A1F8C"/>
    </linearGradient>
  </defs>

  <!-- House body -->
  <rect x="35" y="52" width="38" height="28" rx="2" fill="url(#house)" opacity="0.95"/>

  <!-- Roof -->
  <path d="M 54 28 L 30 54 L 78 54 Z" fill="url(#house)" opacity="0.95"/>
  <path d="M 54 30 L 32 54 L 76 54 Z" fill="none" stroke="url(#gold)" stroke-width="0.8" opacity="0.7"/>

  <!-- Chimney -->
  <rect x="65" y="34" width="5" height="12" rx="1" fill="url(#house)" opacity="0.9"/>

  <!-- Door -->
  <rect x="48.5" y="62" width="11" height="18" rx="5.5" fill="url(#door)"/>
  <circle cx="56.5" cy="72" r="1" fill="url(#gold)"/>

  <!-- Windows -->
  <rect x="37" y="57" width="8" height="7" rx="1.2" fill="url(#door)" opacity="0.8"/>
  <rect x="37.4" y="57.4" width="7.2" height="6.2" rx="1" fill="#FFBE0B" opacity="0.3"/>
  <rect x="63" y="57" width="8" height="7" rx="1.2" fill="url(#door)" opacity="0.8"/>
  <rect x="63.4" y="57.4" width="7.2" height="6.2" rx="1" fill="#FFBE0B" opacity="0.3"/>

  <!-- Crown -->
  <g transform="translate(54, 24)" opacity="0.95">
    <path d="M -5 0 L -6.5 -5.5 L -3 -3 L 0 -6.5 L 3 -3 L 6.5 -5.5 L 5 0 Z"
          fill="url(#gold)" stroke="#FFD700" stroke-width="0.3"/>
    <circle cx="0" cy="-4.2" r="0.8" fill="#FF6B6B"/>
    <rect x="-5" y="-0.2" width="10" height="1.2" rx="0.3" fill="#FFD700"/>
  </g>
</svg>
`;

const ADAPTIVE_BG_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3A1F8C"/>
      <stop offset="50%" stop-color="#5B3FD4"/>
      <stop offset="100%" stop-color="#7C5CFC"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.4">
      <stop offset="0%" stop-color="rgba(167,139,250,0.35)"/>
      <stop offset="100%" stop-color="rgba(167,139,250,0)"/>
    </radialGradient>
  </defs>
  <rect width="108" height="108" fill="url(#bg)"/>
  <rect width="108" height="108" fill="url(#glow)"/>
</svg>
`;

// ─── Icon sizes ──────────────────────────────────────────
const ANDROID_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const IOS_SIZES = [
  { name: 'icon-20@2x.png', size: 40 },
  { name: 'icon-20@3x.png', size: 60 },
  { name: 'icon-29@2x.png', size: 58 },
  { name: 'icon-29@3x.png', size: 87 },
  { name: 'icon-40@2x.png', size: 80 },
  { name: 'icon-40@3x.png', size: 120 },
  { name: 'icon-60@2x.png', size: 120 },
  { name: 'icon-60@3x.png', size: 180 },
  { name: 'icon-1024.png', size: 1024 },
];

async function generate() {
  const androidResDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  const iosIconDir = path.join(__dirname, '..', 'ios', 'Majordhome', 'Images.xcassets', 'AppIcon.appiconset');

  // ─── Android: classic launcher icons ─────────────────
  for (const [folder, size] of Object.entries(ANDROID_SIZES)) {
    const outDir = path.join(androidResDir, folder);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // Square icon
    await sharp(Buffer.from(ICON_SVG))
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, 'ic_launcher.png'));

    // Round icon (circle mask)
    const roundMask = Buffer.from(
      `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`
    );

    const base = await sharp(Buffer.from(ICON_SVG)).resize(size, size).png().toBuffer();
    const mask = await sharp(roundMask).resize(size, size).png().toBuffer();

    await sharp(base)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(outDir, 'ic_launcher_round.png'));

    console.log(`  ✓ Android ${folder}: ${size}×${size}`);
  }

  // ─── Android: adaptive icon layers at all densities ──
  const ADAPTIVE_SIZES = {
    'mipmap-mdpi': 108,
    'mipmap-hdpi': 162,
    'mipmap-xhdpi': 216,
    'mipmap-xxhdpi': 324,
    'mipmap-xxxhdpi': 432,
  };

  for (const [folder, size] of Object.entries(ADAPTIVE_SIZES)) {
    const outDir = path.join(androidResDir, folder);

    await sharp(Buffer.from(ADAPTIVE_FG_SVG))
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, 'ic_launcher_foreground.png'));

    await sharp(Buffer.from(ADAPTIVE_BG_SVG))
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, 'ic_launcher_background.png'));

    console.log(`  ✓ Android adaptive ${folder}: ${size}×${size}`);
  }

  // ─── iOS icons ───────────────────────────────────────
  if (!fs.existsSync(iosIconDir)) fs.mkdirSync(iosIconDir, { recursive: true });

  // iOS icon: same SVG but with no rounded corners (iOS rounds automatically)
  const IOS_SVG = ICON_SVG.replace('rx="224"', 'rx="0"');

  for (const { name, size } of IOS_SIZES) {
    await sharp(Buffer.from(IOS_SVG))
      .resize(size, size)
      .png()
      .toFile(path.join(iosIconDir, name));

    console.log(`  ✓ iOS ${name}: ${size}×${size}`);
  }

  // ─── iOS Contents.json ───────────────────────────────
  const contents = {
    images: [
      { idiom: 'iphone', scale: '2x', size: '20x20', filename: 'icon-20@2x.png' },
      { idiom: 'iphone', scale: '3x', size: '20x20', filename: 'icon-20@3x.png' },
      { idiom: 'iphone', scale: '2x', size: '29x29', filename: 'icon-29@2x.png' },
      { idiom: 'iphone', scale: '3x', size: '29x29', filename: 'icon-29@3x.png' },
      { idiom: 'iphone', scale: '2x', size: '40x40', filename: 'icon-40@2x.png' },
      { idiom: 'iphone', scale: '3x', size: '40x40', filename: 'icon-40@3x.png' },
      { idiom: 'iphone', scale: '2x', size: '60x60', filename: 'icon-60@2x.png' },
      { idiom: 'iphone', scale: '3x', size: '60x60', filename: 'icon-60@3x.png' },
      { idiom: 'ios-marketing', scale: '1x', size: '1024x1024', filename: 'icon-1024.png' },
    ],
    info: { author: 'xcode', version: 1 },
  };

  fs.writeFileSync(
    path.join(iosIconDir, 'Contents.json'),
    JSON.stringify(contents, null, 2),
  );

  console.log('\n🎉 Tous les icônes ont été générés !');
}

generate().catch(console.error);
