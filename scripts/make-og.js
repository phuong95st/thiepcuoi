const fs = require('fs');
const path = require('path');
const { Resvg } = require(path.join(process.env.TEMP, 'og_maker/node_modules/@resvg/resvg-js'));

const bgBase64 = fs.readFileSync('C:/Users/phuon/.gemini/antigravity-cli/brain/015d1d2e-792a-47b1-8ac2-7f7324fd253f/wedding_background_1789887210303.jpg').toString('base64');
const coupleBase64 = fs.readFileSync(path.resolve('assets/images/anh-co-dau-chu-re.jpg')).toString('base64');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-opacity="0.35" flood-color="#000"/>
    </filter>
    <filter id="card-shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-opacity="0.4" flood-color="#000"/>
    </filter>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d4af37" />
      <stop offset="50%" stop-color="#f7e9a0" />
      <stop offset="100%" stop-color="#b8860b" />
    </linearGradient>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e91e63" />
      <stop offset="100%" stop-color="#ba68c8" />
    </linearGradient>
    <clipPath id="coupleClip">
      <rect x="80" y="85" width="360" height="460" rx="24" />
    </clipPath>
  </defs>

  <!-- Background Image -->
  <image href="data:image/jpeg;base64,${bgBase64}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice" />
  <rect x="0" y="0" width="1200" height="630" fill="rgba(0, 0, 0, 0.42)" />

  <!-- Main Luxury Glass Container -->
  <rect x="50" y="50" width="1100" height="530" rx="32" fill="rgba(255, 255, 255, 0.95)" stroke="url(#goldGrad)" stroke-width="4" filter="url(#card-shadow)" />

  <!-- Inner Delicate Border -->
  <rect x="62" y="62" width="1076" height="506" rx="26" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-dasharray="6 4" />

  <!-- Couple Photo with Frame -->
  <g filter="url(#shadow)">
    <rect x="75" y="80" width="370" height="470" rx="26" fill="#fff" stroke="url(#goldGrad)" stroke-width="3" />
    <image href="data:image/jpeg;base64,${coupleBase64}" x="80" y="85" width="360" height="460" clip-path="url(#coupleClip)" preserveAspectRatio="xMidYMid slice" />
  </g>

  <!-- Right Content Section -->
  <g transform="translate(480, 100)">
    <!-- Header Badge -->
    <rect x="0" y="0" width="280" height="38" rx="19" fill="#fce4ec" stroke="#f8bbd0" stroke-width="1" />
    <text x="140" y="25" font-family="'Segoe UI', Arial, sans-serif" font-size="15" font-weight="bold" fill="#c2185b" text-anchor="middle" letter-spacing="3">THIỆP CƯỚI BÁO HỶ</text>

    <!-- Couple Names -->
    <text x="0" y="95" font-family="Georgia, 'Times New Roman', serif" font-size="46" font-weight="bold" fill="#1a1a1a">Hữu Phương</text>
    <text x="310" y="92" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-style="italic" fill="#d63384">&amp;</text>
    <text x="0" y="155" font-family="Georgia, 'Times New Roman', serif" font-size="46" font-weight="bold" fill="#1a1a1a">Phương Quỳnh</text>

    <!-- Gold Accent Line -->
    <line x1="0" y1="185" x2="560" y2="185" stroke="url(#goldGrad)" stroke-width="2.5" stroke-linecap="round" />
    <circle cx="280" cy="185" r="7" fill="#d4af37" />

    <!-- Date & Schedule Details -->
    <g transform="translate(0, 210)">
      <rect x="0" y="0" width="560" height="62" rx="14" fill="#fff5f7" stroke="#f8bbd0" stroke-width="1.5" />
      <text x="24" y="26" font-family="'Segoe UI', Arial, sans-serif" font-size="16" font-weight="bold" fill="#b71c1c">LỄ ĂN HỎI: THỨ NĂM, 19/11/2026</text>
      <text x="24" y="48" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#555">Tư gia Nhà Gái: Đình làng Tiền Huân, Sơn Tây, Hà Nội</text>
    </g>

    <g transform="translate(0, 285)">
      <rect x="0" y="0" width="560" height="62" rx="14" fill="#f5f9ff" stroke="#bbdefb" stroke-width="1.5" />
      <text x="24" y="26" font-family="'Segoe UI', Arial, sans-serif" font-size="16" font-weight="bold" fill="#0d47a1">LỄ THÀNH HÔN: THỨ SÁU, 20/11/2026</text>
      <text x="24" y="48" font-family="'Segoe UI', Arial, sans-serif" font-size="14" fill="#555">Tiệc Cưới: Nhà hàng Lâm Ký, Phường Sơn Tây, Hà Nội</text>
    </g>

    <!-- Bottom Message -->
    <text x="280" y="385" font-family="Georgia, 'Times New Roman', serif" font-size="18" font-style="italic" fill="#666" text-anchor="middle">"Trân trọng kính mời quý khách đến chung vui cùng gia đình chúng tôi!"</text>
  </g>
</svg>
`;

async function render() {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  const outPng = path.resolve('assets/images/og-image.png');
  fs.writeFileSync(outPng, pngBuffer);
  console.log('Saved:', outPng, 'Size:', pngBuffer.length);

  // Convert to WebP and JPG using cwebp
  const { execSync } = require('child_process');
  const cwebpPath = path.join(process.env.TEMP, 'cwebp.exe');
  const outWebp = path.resolve('assets/images/og-image.webp');
  execSync(`"${cwebpPath}" -q 88 -m 6 -sharp_yuv "${outPng}" -o "${outWebp}" -quiet`);
  console.log('Saved:', outWebp, 'Size:', fs.statSync(outWebp).size);

  // Also create a JPG version for legacy crawlers
  const tempTool = path.join(process.env.TEMP, 'qr_decode/node_modules/jimp');
  const Jimp = require(tempTool);
  const img = await Jimp.read(outPng);
  const outJpg = path.resolve('assets/images/og-image.jpg');
  await img.quality(90).write(outJpg);
  console.log('Saved:', outJpg, 'Size:', fs.statSync(outJpg).size);
}

render().catch(console.error);
