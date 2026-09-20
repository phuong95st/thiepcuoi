const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const assetRefs = [...html.matchAll(/(?:data-src|src|href|poster)="(\.\/[^"]+)"/g)].map((m) => m[1]);
const unique = [...new Set(assetRefs)];
const missing = unique.filter((p) => !fs.existsSync(path.join(root, p.replace(/^\.\//, ''))));

const encodingBad = (html.match(/�|Ã|Æ°|á»/g) || []).length;

console.log(JSON.stringify({ assets: unique.length, missing, encodingBad }, null, 2));
