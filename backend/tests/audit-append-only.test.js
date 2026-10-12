const fs = require('fs');
const path = require('path');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

test('مفيش أي كود في src أو scripts بيعدّل أو يمسح AuditLog', () => {
  const forbidden = [
    /AuditLog\s*\.\s*(update\w*|delete\w*|findOneAnd\w*|replace\w*|remove\w*|bulkWrite|collection)/,
    /collection\(\s*['"]auditlogs['"]\s*\)/i,
  ];
  const roots = ['../src', '../scripts'].map((p) => path.join(__dirname, p)).filter(fs.existsSync);
  const offenders = roots.flatMap(walk)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => { const code = fs.readFileSync(f, 'utf8'); return forbidden.some((re) => re.test(code)); });
  expect(offenders).toEqual([]);
});