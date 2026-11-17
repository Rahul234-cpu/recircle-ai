const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
if (!fs.existsSync(path.join(ROOT, 'frontend')) || !fs.existsSync(path.join(ROOT, 'backend'))) {
  console.error('Run this from the project root (the folder containing frontend/ and backend/).');
  process.exit(1);
}

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}

const files = [
  path.join(ROOT, 'frontend', 'index.html'),
  ...walk(path.join(ROOT, 'frontend', 'src'), ['.js', '.jsx']),
  path.join(ROOT, 'backend', 'controllers', 'wasteController.js'),
  path.join(ROOT, 'ai-service', 'services', 'recommender.py'),
  path.join(ROOT, 'ai-service', 'services', 'chatbot.py'),
  path.join(ROOT, 'ai-service', 'data', 'knowledge_base.json'),
].filter((f) => fs.existsSync(f));

const RULES = [
  [/\/become-kabadiwala/g, '/become-ecopartner'],
  [/path="become-kabadiwala"(\s+element=\{<BecomeKabadiwala)/g, 'path="become-ecopartner"$1'],
  [/informal kabadiwala network/g, 'informal scrap-collector network'],
  [/e\.g\. Ramesh Kabadi Services/g, 'e.g. Ramesh Recycling Services'],
  [/Are you a kabadiwala\? Grow with ReCircle\./g, 'Are you a scrap collector? Become a ReCircle EcoPartner.'],
  [/\b([Aa]) ([Kk])abadiwala\b/g, (m, a) => (a === 'A' ? 'An' : 'an') + ' EcoPartner'],
  [/(?<![A-Za-z/-])[Kk]abadiwalas\b/g, 'EcoPartners'],
  [/(?<![A-Za-z/-])[Kk]abadiwala\b/g, 'EcoPartner'],
];

let changedFiles = 0;
let changes = 0;
for (const f of files) {
  const before = fs.readFileSync(f, 'utf8');
  let after = before;
  for (const [re, rep] of RULES) {
    const n = (after.match(re) || []).length;
    if (n) { changes += n; after = after.replace(re, rep); }
  }
  if (f.endsWith(path.join('src', 'App.jsx')) && !after.includes('path="become-kabadiwala"')) {
    after = after.replace(
      /(<Route path="become-ecopartner"[^\n]*\n)/,
      '$1        <Route path="become-kabadiwala" element={<Navigate to="/become-ecopartner" replace />} />\n',
    );
  }
  if (after !== before) {
    fs.writeFileSync(f, after);
    changedFiles += 1;
    console.log('updated', path.relative(ROOT, f));
  }
}

const textPy = path.join(ROOT, 'ai-service', 'utils', 'text.py');
if (fs.existsSync(textPy)) {
  const t = fs.readFileSync(textPy, 'utf8');
  if (!t.includes('"ecopartner"')) {
    fs.writeFileSync(textPy, t.replace('"kabadiwala": "collector",', '"kabadiwala": "collector", "ecopartner": "collector", "ecopartners": "collector",'));
    console.log('updated', path.relative(ROOT, textPy));
    changedFiles += 1;
  }
}

console.log(`\nDone: ${changes} replacement(s) in ${changedFiles} file(s).`);