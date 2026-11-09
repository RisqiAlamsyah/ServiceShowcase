// Pengunci Gate [A]-[D] CLAUDE.md: tidak boleh menulis kode sebelum tiket dimulai dan RULES dibaca.
//
//  - PostToolUse (Read)   : catat bahwa .docs/RULES.md sudah dibaca di sesi ini (Gate [D])
//  - PreToolUse (Edit|Write): untuk file di GUARDED pada branch {type}/{slug}, tolak jika
//      (1) tiket .docs/tickets/LOCAL-YYYYMMDD-<slug>.md tidak ada,
//      (2) Status bukan "In Progress" (dan tidak ada "Tanggal mulai perbaikan" hari ini),
//      (3) RULES.md dan RULES_SECURITY.md belum dibaca di sesi ini.
//
// Branch tanpa "/" (main, develop) tidak dijaga; commit di main sudah ditolak oleh guard-git.js.
// Gagal-terbuka: jika hook sendiri error (input aneh, git tidak ada), edit tidak diblokir.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const GUARDED = [
  'src/', 'app/', 'components/', 'lib/', 'prisma/', 'tests/', 'e2e/', 'public/',
  'middleware.ts', 'next.config.', 'auth.ts', 'auth.config.ts', 'tailwind.config.', 'package.json',
];
const REQUIRED_READS = ['.docs/RULES.md', '.docs/RULES_SECURITY.md'];
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateDir = path.join(root, '.claude', 'hooks', 'state');

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch (e) { process.exit(0); }
  try { main(input); } catch (e) { process.exit(0); }
});

const rel = (p) => path.relative(root, path.resolve(root, p || '')).split(path.sep).join('/');
const markerFile = (sid, doc) =>
  path.join(stateDir, String(sid || 'nosession').replace(/[^\w-]/g, '_') + '.' + path.basename(doc, '.md') + '.read');

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
  process.exit(0);
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function main(input) {
  const event = input.hook_event_name;
  const file = rel((input.tool_input || {}).file_path);

  if (event === 'PostToolUse') {
    if (REQUIRED_READS.includes(file)) {
      fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(markerFile(input.session_id, file), String(Date.now()));
    }
    process.exit(0);
  }

  if (!GUARDED.some((g) => file.startsWith(g))) process.exit(0);

  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root }).toString().trim();
  // Branch kerja = {type}/{slug}. Branch tanpa "/" tidak dijaga.
  const m = branch.match(/^[a-z][\w-]*\/(.+)$/i);
  if (!m) process.exit(0);
  const key = m[1];

  let found;
  try {
    found = fs.readdirSync(path.join(root, '.docs', 'tickets'))
      .find((f) => { const mm = f.match(/^LOCAL-\d{8}-(.+)\.md$/); return mm && mm[1] === key; });
  } catch (e) { found = undefined; }
  const ticketRel = found ? `.docs/tickets/${found}` : `.docs/tickets/LOCAL-YYYYMMDD-${key}.md`;
  const ticketPath = path.join(root, ticketRel);
  if (!fs.existsSync(ticketPath)) {
    deny(`Gate [A]: ${ticketRel} belum ada. Buat file tiket LOCAL-YYYYMMDD-<slug>.md (slug = nama branch setelah "/"). Lihat CLAUDE.md §1-§2 dan .docs/TICKET.md.`);
  }

  const ticket = fs.readFileSync(ticketPath, 'utf8');
  const status = (ticket.match(/^[>\s]*\*{0,2}Status:?\*{0,2}:?\s*(.+)$/im) || [])[1] || '';
  const inProgress = /^in progress/i.test(status.trim());
  const reworkToday = new RegExp(`^[>\\s]*\\*{0,2}Tanggal mulai perbaikan[^\\n]*${today()}`, 'im').test(ticket);
  if (!inProgress && !reworkToday) {
    deny(
      `Gate [C]: Status di ${ticketRel} masih "${status.trim() || '(tidak terbaca)'}". ` +
      `Ubah ke "In Progress" + tambah "Tanggal mulai", atau untuk perbaikan tambah baris "Tanggal mulai perbaikan ... ${today()}".`
    );
  }

  const unread = REQUIRED_READS.filter((d) => !fs.existsSync(markerFile(input.session_id, d)));
  if (unread.length) {
    deny(`Gate [D]: baca ${unread.join(' dan ')} dulu di sesi ini (plus RULES_TEMPLATES/FRONTEND/DB sesuai layer) sebelum menulis kode.`);
  }
  process.exit(0);
}
