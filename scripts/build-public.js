const fs = require('fs-extra');
const path = require('path');

async function buildPublic() {
  const out = path.resolve('public');
  await fs.emptyDir(out);

  const items = [
    'assets',
    'css',
    'dist',
    'index.html',
    'dashboard.html',
    'favicon.ico',
    'robots.txt',
    'sitemap.xml',
    'site.webmanifest',
  ];

  for (const item of items) {
    if (!fs.existsSync(item)) {
      console.warn('Skip missing:', item);
      continue;
    }

    const dest = path.join(out, item);

    if (item === 'assets') {
      await fs.ensureDir(dest);
      for (const entry of await fs.readdir(item)) {
        const srcPath = path.join(item, entry);
        const destPath = path.join(dest, entry);

        if (entry === 'music') {
          await fs.ensureDir(destPath);
          for (const track of await fs.readdir(srcPath)) {
            try {
              await fs.copy(path.join(srcPath, track), path.join(destPath, track), { overwrite: true });
            } catch (err) {
              console.warn(`Warning: could not copy assets/music/${track}:`, err.message);
            }
          }
          continue;
        }

        try {
          await fs.copy(srcPath, destPath, { overwrite: true });
        } catch (err) {
          console.warn(`Warning: could not copy assets/${entry}:`, err.message);
        }
      }
      continue;
    }

    try {
      await fs.copy(item, dest, { overwrite: true });
    } catch (err) {
      console.warn(`Warning: could not copy ${item}:`, err.message);
    }
  }

  const musicDir = path.join(out, 'assets', 'music');
  const pureLove = path.join(musicDir, 'pure-love-304010.mp3');
  const nhacCuoi = path.join(musicDir, 'nhac-cuoi-nhe-nhang.mp3');

  if (!fs.existsSync(pureLove)) {
    throw new Error('Required music file missing from build: assets/music/pure-love-304010.mp3');
  }

  if (!fs.existsSync(nhacCuoi)) {
    try {
      await fs.copy(pureLove, nhacCuoi);
      console.log('Created music alias:', nhacCuoi);
    } catch (err) {
      console.warn('Warning: could not create music alias:', err.message);
    }
  }

  if (!fs.existsSync(path.join(out, 'index.html'))) {
    throw new Error('public/index.html was not created — build failed');
  }

  console.log('Public build completed:', out);
}

buildPublic().catch((err) => {
  console.error(err);
  process.exit(1);
});
