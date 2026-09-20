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
    try {
      await fs.copy(item, path.join(out, item), { overwrite: true });
    } catch (err) {
      console.warn(`Warning: could not copy ${item}:`, err.message);
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
