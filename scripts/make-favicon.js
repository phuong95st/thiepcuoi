const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Resvg } = require(path.join(process.env.TEMP, 'og_maker/node_modules/@resvg/resvg-js'));

function createSvg(size) {
  const r = size / 2;
  const strokeW = Math.max(1.5, size * 0.04);
  const fontSize = Math.round(size * 0.38);
  const heartSize = Math.round(size * 0.16);

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#881337" />
        <stop offset="50%" stop-color="#4c0519" />
        <stop offset="100%" stop-color="#1f020a" />
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffe082" />
        <stop offset="35%" stop-color="#ffd54f" />
        <stop offset="70%" stop-color="#d4af37" />
        <stop offset="100%" stop-color="#aa7c11" />
      </linearGradient>
      <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="${Math.max(1, size * 0.02)}" flood-color="#ffd54f" flood-opacity="0.4"/>
      </filter>
    </defs>

    <!-- Background circle with smooth anti-aliased edge -->
    <circle cx="${r}" cy="${r}" r="${r - strokeW}" fill="url(#bgGrad)" stroke="url(#goldGrad)" stroke-width="${strokeW}" />

    <!-- Inner subtle ring -->
    <circle cx="${r}" cy="${r}" r="${r - strokeW * 2.5}" fill="none" stroke="url(#goldGrad)" stroke-width="${Math.max(1, strokeW * 0.35)}" stroke-dasharray="${size * 0.04}, ${size * 0.03}" opacity="0.6" />

    <!-- Decorative Top & Bottom Dots -->
    <circle cx="${r}" cy="${strokeW * 3.5}" r="${Math.max(1.5, size * 0.025)}" fill="url(#goldGrad)" />
    <circle cx="${r}" cy="${size - strokeW * 3.5}" r="${Math.max(1.5, size * 0.025)}" fill="url(#goldGrad)" />

    <!-- Central Monogram P & Q -->
    <g filter="url(#goldGlow)" text-anchor="middle" dominant-baseline="central">
      <!-- Letter P -->
      <text x="${r - size * 0.2}" y="${r + size * 0.02}" 
            font-family="'Playfair Display', Georgia, 'Times New Roman', serif" 
            font-size="${fontSize}" 
            font-weight="700" 
            font-style="italic" 
            fill="url(#goldGrad)">P</text>

      <!-- Center Heart Symbol -->
      <g transform="translate(${r - heartSize / 2}, ${r - heartSize / 2 - size * 0.01})">
        <path d="M ${heartSize * 0.5} ${heartSize * 0.85} 
                 C ${heartSize * 0.1} ${heartSize * 0.55} 0 ${heartSize * 0.35} 0 ${heartSize * 0.22} 
                 A ${heartSize * 0.25} ${heartSize * 0.25} 0 0 1 ${heartSize * 0.5} ${heartSize * 0.15} 
                 A ${heartSize * 0.25} ${heartSize * 0.25} 0 0 1 ${heartSize} ${heartSize * 0.22} 
                 C ${heartSize} ${heartSize * 0.35} ${heartSize * 0.9} ${heartSize * 0.55} ${heartSize * 0.5} ${heartSize * 0.85} Z" 
              fill="#fb7185" />
      </g>

      <!-- Letter Q -->
      <text x="${r + size * 0.2}" y="${r + size * 0.02}" 
            font-family="'Playfair Display', Georgia, 'Times New Roman', serif" 
            font-size="${fontSize}" 
            font-weight="700" 
            font-style="italic" 
            fill="url(#goldGrad)">Q</text>
    </g>
  </svg>`;
}

function renderPng(size) {
  const svg = createSvg(size);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size }
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

function generateIcons() {
  const imgDir = path.resolve('assets/images');
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'favicon.png', size: 64 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-192x192.png', size: 192 },
    { name: 'icon-512x512.png', size: 512 },
  ];

  const buffers = {};
  for (const s of sizes) {
    const pngBuf = renderPng(s.size);
    buffers[s.size] = pngBuf;
    const dest = path.join(imgDir, s.name);
    fs.writeFileSync(dest, pngBuf);
    console.log(`Generated ${s.name} (${s.size}x${s.size})`);
  }

  // Generate multi-resolution ICO file (16, 32, 48)
  const icoPath = path.resolve('favicon.ico');
  const icoInImg = path.join(imgDir, 'favicon.ico');
  const icoBuffer = buildIco([buffers[16], buffers[32], buffers[48]], [16, 32, 48]);
  fs.writeFileSync(icoPath, icoBuffer);
  fs.writeFileSync(icoInImg, icoBuffer);
  console.log(`Generated favicon.ico with 16, 32, 48 sizes`);

  // Also convert 192 and 512 to WebP
  const cwebp = process.env.TEMP + '\\cwebp.exe';
  if (fs.existsSync(cwebp)) {
    execSync(`"${cwebp}" -q 90 assets/images/icon-192x192.png -o assets/images/icon-192x192.webp`);
    execSync(`"${cwebp}" -q 90 assets/images/icon-512x512.png -o assets/images/icon-512x512.webp`);
    console.log('Converted icons to WebP');
  }
}

// Minimal binary ICO packager for PNG images
function buildIco(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  let offset = 6 + count * 16;
  const directoryEntries = [];

  for (let i = 0; i < count; i++) {
    const s = sizes[i];
    const buf = pngBuffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(s >= 256 ? 0 : s, 0); // Width
    entry.writeUInt8(s >= 256 ? 0 : s, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buf.length, 8); // Size of image data
    entry.writeUInt32LE(offset, 12); // Offset of image data
    directoryEntries.push(entry);
    offset += buf.length;
  }

  return Buffer.concat([header, ...directoryEntries, ...pngBuffers]);
}

generateIcons();
