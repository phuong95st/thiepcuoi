const fs = require('fs');

// Reverse UTF-8 misread as Windows-1252 (common mojibake pattern)
const WIN1252_UNDO = new Map([
    [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85],
    [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88], [0x2030, 0x89], [0x0160, 0x8A],
    [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92],
    [0x201C, 0x93], [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
    [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C],
    [0x017E, 0x9E], [0x0178, 0x9F],
]);

function fixMojibake(str, report = false) {
    const bytes = [];
    const unmapped = new Set();
    for (const ch of str) {
        const cp = ch.charCodeAt(0);
        if (cp <= 0xFF) {
            bytes.push(cp);
        } else if (WIN1252_UNDO.has(cp)) {
            bytes.push(WIN1252_UNDO.get(cp));
        } else {
            unmapped.add(`U+${cp.toString(16).toUpperCase().padStart(4, '0')} '${ch}'`);
            bytes.push(0x3f);
        }
    }
    if (report && unmapped.size) console.log('Unmapped:', [...unmapped].join(', '));
    return Buffer.from(bytes).toString('utf8');
}

const write = process.argv.includes('--write');
const path = process.argv.find((a) => a.endsWith('.html')) || 'index.html';
const content = fs.readFileSync(path, 'utf8');
const fixed = fixMojibake(content, !write);

const title = fixed.match(/<title>(.*?)<\/title>/)[1];
const desc = fixed.match(/name="description" content="(.*?)"/)[1];

console.log('Title:', title);
console.log('Desc:', desc.substring(0, 120));

if (write) {
    fs.writeFileSync(path, fixed, 'utf8');
    console.log('Written to', path);
}
