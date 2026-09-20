const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async function buildPublic() {
  await fs.ensureDir('public');

  if (process.platform === 'win32') {
    const syncDir = (src, dest) => {
      try {
        execSync(`robocopy "${src}" "${dest}" /E /XO /NP /NFL /NDL /NJH /NJS`, { stdio: 'ignore' });
      } catch (e) {
        // Robocopy returns exit code 1 if files were copied, 0 if nothing copied. Codes < 8 are considered success.
        if (e.status > 7) throw e;
      }
    };

    ['assets', 'css', 'dist'].forEach(dir => {
      if (fs.existsSync(dir)) syncDir(dir, path.join('public', dir));
    });

    ['index.html', 'dashboard.html', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'site.webmanifest'].forEach(file => {
      if (fs.existsSync(file)) fs.copyFileSync(file, path.join('public', file));
    });
  } else {
    const items = ['assets', 'css', 'dist', 'index.html', 'dashboard.html', 'robots.txt', 'sitemap.xml', 'site.webmanifest', 'favicon.ico'];
    for (const item of items) {
      if (fs.existsSync(item)) {
        await fs.copy(item, path.join('public', item), { overwrite: true });
      }
    }
  }

  console.log('✅ Public build completed successfully!');
}

buildPublic().catch((err) => {
  console.error(err);
  process.exit(1);
});
