const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ASSETS_DIR = path.resolve(__dirname, '../assets/images');
const BACKUP_DIR = path.resolve(__dirname, '../assets/images_backup');
const TEMP_DIR = process.env.TEMP || 'C:\\Windows\\Temp';

const CWEBP_PATH = path.join(TEMP_DIR, 'cwebp.exe');
const DWEBP_PATH = path.join(TEMP_DIR, 'dwebp.exe');

// Ensure cwebp and dwebp are copied to TEMP to avoid drive I execution/locking issues
function setupWebpBinaries() {
  const libwebpBinDir = path.resolve(__dirname, '../node_modules/webp-converter/bin/libwebp_win64/bin');
  const srcCwebp = path.join(libwebpBinDir, 'cwebp.exe');
  const srcDwebp = path.join(libwebpBinDir, 'dwebp.exe');

  if (fs.existsSync(srcCwebp) && (!fs.existsSync(CWEBP_PATH) || fs.statSync(CWEBP_PATH).size !== fs.statSync(srcCwebp).size)) {
    fs.copyFileSync(srcCwebp, CWEBP_PATH);
  }
  if (fs.existsSync(srcDwebp) && (!fs.existsSync(DWEBP_PATH) || fs.statSync(DWEBP_PATH).size !== fs.statSync(srcDwebp).size)) {
    fs.copyFileSync(srcDwebp, DWEBP_PATH);
  }
}

// Fast separable box blur for edge-preserving bilateral-like filter
function boxBlurHorizontal(src, dst, w, h, r) {
  const div = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w * 4;
    let rSum = 0, gSum = 0, bSum = 0;
    for (let i = -r; i <= r; i++) {
      const px = Math.min(Math.max(i, 0), w - 1);
      const idx = rowOffset + px * 4;
      rSum += src[idx];
      gSum += src[idx + 1];
      bSum += src[idx + 2];
    }
    for (let x = 0; x < w; x++) {
      const outIdx = rowOffset + x * 4;
      dst[outIdx] = (rSum / div) | 0;
      dst[outIdx + 1] = (gSum / div) | 0;
      dst[outIdx + 2] = (bSum / div) | 0;
      dst[outIdx + 3] = src[outIdx + 3];

      const xRemove = Math.max(x - r, 0);
      const xAdd = Math.min(x + r + 1, w - 1);
      const idxRemove = rowOffset + xRemove * 4;
      const idxAdd = rowOffset + xAdd * 4;
      rSum += src[idxAdd] - src[idxRemove];
      gSum += src[idxAdd + 1] - src[idxRemove + 1];
      bSum += src[idxAdd + 2] - src[idxRemove + 2];
    }
  }
}

function boxBlurVertical(src, dst, w, h, r) {
  const div = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    const colOffset = x * 4;
    let rSum = 0, gSum = 0, bSum = 0;
    for (let i = -r; i <= r; i++) {
      const py = Math.min(Math.max(i, 0), h - 1);
      const idx = py * w * 4 + colOffset;
      rSum += src[idx];
      gSum += src[idx + 1];
      bSum += src[idx + 2];
    }
    for (let y = 0; y < h; y++) {
      const outIdx = y * w * 4 + colOffset;
      dst[outIdx] = (rSum / div) | 0;
      dst[outIdx + 1] = (gSum / div) | 0;
      dst[outIdx + 2] = (bSum / div) | 0;
      dst[outIdx + 3] = src[outIdx + 3];

      const yRemove = Math.max(y - r, 0);
      const yAdd = Math.min(y + r + 1, h - 1);
      const idxRemove = yRemove * w * 4 + colOffset;
      const idxAdd = yAdd * w * 4 + colOffset;
      rSum += src[idxAdd] - src[idxRemove];
      gSum += src[idxAdd + 1] - src[idxRemove + 1];
      bSum += src[idxAdd + 2] - src[idxRemove + 2];
    }
  }
}

function fastBlur(data, w, h, r) {
  const temp = Buffer.alloc(w * h * 4);
  const out = Buffer.alloc(w * h * 4);
  boxBlurHorizontal(data, temp, w, h, r);
  boxBlurVertical(temp, out, w, h, r);
  return out;
}

// Enhance portrait / wedding photo
function enhanceWeddingPhoto(img, isPortrait = true) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;

  // Blur layers for skin smoothing and unsharp mask
  const skinBlurRadius = Math.max(2, Math.round(Math.min(w, h) / 280));
  const skinBlurred = fastBlur(data, w, h, skinBlurRadius);
  const sharpBlurred = fastBlur(data, w, h, 1);

  const cx = w / 2;
  const cy = h / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];

      let skinWeight = 0;
      if (isPortrait) {
        // RGB & HSV Skin Detection
        const maxVal = Math.max(r, g, b);
        const minVal = Math.min(r, g, b);
        const delta = maxVal - minVal;
        let hHue = 0;
        if (delta > 0.001) {
          if (maxVal === r) hHue = ((g - b) / delta) % 6;
          else if (maxVal === g) hHue = (b - r) / delta + 2;
          else hHue = (r - g) / delta + 4;
          hHue *= 60;
          if (hHue < 0) hHue += 360;
        }
        const sat = maxVal === 0 ? 0 : delta / maxVal;
        const val = maxVal / 255;

        const isHue = (hHue >= 0 && hHue <= 48) || (hHue >= 340 && hHue <= 360);
        const isSat = (sat >= 0.10 && sat <= 0.70);
        const isVal = (val >= 0.22);

        if (isHue && isSat && isVal && r > g && g >= b) {
          const hueDist = hHue > 180 ? Math.abs(hHue - 360) : hHue;
          const hueFactor = Math.max(0, 1 - Math.abs(hueDist - 22) / 26);
          const satFactor = Math.max(0, 1 - Math.abs(sat - 0.38) / 0.32);
          const valFactor = Math.min(1, (val - 0.20) / 0.25);
          skinWeight = Math.min(1, Math.max(0, hueFactor * satFactor * valFactor));
        }
      }

      // 1. Edge-preserving skin smoothing (Bilateral blend)
      if (skinWeight > 0.05) {
        const br = skinBlurred[idx];
        const bg = skinBlurred[idx + 1];
        const bb = skinBlurred[idx + 2];
        const colorDiff = (Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb)) / 3;
        const edgeWeight = Math.max(0, 1 - colorDiff / 38);
        const blend = skinWeight * edgeWeight * 0.75;
        r = r * (1 - blend) + br * blend;
        g = g * (1 - blend) + bg * blend;
        b = b * (1 - blend) + bb * blend;

        // 2. Skin tone whitening & brightening (Tone-up, porcelain fair skin)
        const skinBright = skinWeight * 0.16;
        r = r * (1 + skinBright * 0.90) + skinBright * 18;
        g = g * (1 + skinBright * 1.04) + skinBright * 17;
        b = b * (1 + skinBright * 1.25) + skinBright * 24;
      }

      // 3. Detail Sharpening (eyes, hair, clothes, background details)
      const sbr = sharpBlurred[idx];
      const sbg = sharpBlurred[idx + 1];
      const sbb = sharpBlurred[idx + 2];
      const sharpAmount = isPortrait ? 0.42 * (1 - skinWeight * 0.60) : 0.35;
      r = r + (r - sbr) * sharpAmount;
      g = g + (g - sbg) * sharpAmount;
      b = b + (b - sbb) * sharpAmount;

      // 4. Overall Brightness & Clarity (lift shadows/midtones gently)
      r = 255 * Math.pow(Math.max(0, Math.min(255, r)) / 255, 0.92);
      g = 255 * Math.pow(Math.max(0, Math.min(255, g)) / 255, 0.92);
      b = 255 * Math.pow(Math.max(0, Math.min(255, b)) / 255, 0.92);

      // 5. S-curve contrast for punch and depth
      const sc = (c) => {
        const norm = c / 255;
        return (norm < 0.5 ? 2 * norm * norm : 1 - 2 * (1 - norm) * (1 - norm)) * 0.16 + norm * 0.84;
      };
      r = sc(r) * 255;
      g = sc(g) * 255;
      b = sc(b) * 255;

      // 6. Wedding Romantic Color Grading (gentle warmth in highlights, deep clean shadows)
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      r += lum * 3.5;
      g += lum * 1.8;

      // 7. Subtle radial vignette for depth (draws focus to center)
      if (isPortrait) {
        const dx = (x - cx) / cx;
        const dy = (y - cy) / cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.60) {
          const vig = Math.min(0.12, (dist - 0.60) * 0.22);
          r *= (1 - vig);
          g *= (1 - vig);
          b *= (1 - vig);
        }
      }

      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
  }
}

async function processAll() {
  setupWebpBinaries();

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const files = fs.readdirSync(ASSETS_DIR);
  console.log(`Found ${files.length} items in ${ASSETS_DIR}`);

  const results = [];

  for (const file of files) {
    const filePath = path.join(ASSETS_DIR, file);
    let stat;
    try {
      stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;
    } catch (e) {
      console.warn(`  [Skip unreadable file]: ${file} (${e.message})`);
      results.push({ file, status: 'error', error: e.message });
      continue;
    }

    const ext = path.extname(file).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;

    console.log(`\n========================================`);
    console.log(`Processing: ${file}`);

    // Backup original
    const backupPath = path.join(BACKUP_DIR, file);
    if (!fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(filePath, backupPath);
        console.log(`  [Backup created]: ${file}`);
      } catch (err) {
        console.warn(`  [Backup warning]: Could not copy ${file} (${err.message})`);
      }
    }

    const baseName = path.basename(file, ext);
    const targetWebpName = `${baseName}.webp`;
    const targetWebpPath = path.join(ASSETS_DIR, targetWebpName);

    // Skip special files that shouldn't be altered
    if (file === 'placeholder.webp') {
      console.log(`  [Skip]: placeholder.webp is already a placeholder.`);
      results.push({ file, status: 'skipped', note: 'placeholder' });
      continue;
    }

    try {
      let sourceToRead = filePath;
      let tempPngFromWebp = null;

      // If source is webp, decode first with dwebp
      if (ext === '.webp') {
        tempPngFromWebp = path.join(TEMP_DIR, `temp_${baseName}_${Date.now()}.png`);
        execSync(`"${DWEBP_PATH}" "${filePath}" -o "${tempPngFromWebp}" -quiet`);
        sourceToRead = tempPngFromWebp;
      }

      console.log(`  Reading image data...`);
      const img = await Jimp.read(sourceToRead);
      const origW = img.bitmap.width;
      const origH = img.bitmap.height;
      console.log(`  Dimensions: ${origW} x ${origH}`);

      // Determine processing type
      const isIcon = file.startsWith('icon-');
      const isDonate = file.startsWith('donate');
      const isBgOrBanner = ['bg.webp', 'banner.webp'].includes(file);

      if (isIcon || isDonate) {
        console.log(`  Processing icon/graphic (clean conversion to webp)...`);
      } else if (isBgOrBanner) {
        console.log(`  Enhancing background/banner (depth, wedding tone, sharpness)...`);
        enhanceWeddingPhoto(img, false);
      } else {
        console.log(`  Enhancing wedding portrait (skin whitening, smoothing, sharpness, depth)...`);
        enhanceWeddingPhoto(img, true);
      }

      // Write enhanced temp jpg/png
      const tempOutImg = path.join(TEMP_DIR, `enhanced_${baseName}_${Date.now()}.png`);
      await img.write(tempOutImg);

      // Encode to high-quality webp
      console.log(`  Encoding to WebP...`);
      const tempTargetWebp = path.join(TEMP_DIR, `final_${baseName}_${Date.now()}.webp`);
      execSync(`"${CWEBP_PATH}" -q 88 -m 6 -sharp_yuv "${tempOutImg}" -o "${tempTargetWebp}" -quiet`);

      // Copy to final location
      fs.copyFileSync(tempTargetWebp, targetWebpPath);

      const finalSize = fs.statSync(targetWebpPath).size;
      const origSize = stat.size;
      const pct = ((finalSize / origSize) * 100).toFixed(1);

      console.log(`  SUCCESS -> Saved ${targetWebpName} (${(finalSize / 1024).toFixed(1)} KB, ${pct}% of original)`);

      results.push({
        file,
        target: targetWebpName,
        status: 'success',
        origSize,
        finalSize,
        dimensions: `${origW}x${origH}`
      });

      // Cleanup temp files
      try {
        if (tempPngFromWebp && fs.existsSync(tempPngFromWebp)) fs.unlinkSync(tempPngFromWebp);
        if (fs.existsSync(tempOutImg)) fs.unlinkSync(tempOutImg);
        if (fs.existsSync(tempTargetWebp)) fs.unlinkSync(tempTargetWebp);
      } catch (cleanErr) {
        // ignore
      }

    } catch (err) {
      console.error(`  ERROR processing ${file}: ${err.message}`);
      results.push({
        file,
        status: 'error',
        error: err.message
      });
    }
  }

  console.log(`\n========================================`);
  console.log(`PROCESSING COMPLETE SUMMARY:`);
  console.table(results);
}

processAll().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
