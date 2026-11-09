// Penjaga keamanan kode (CLAUDE.md §3, RULES_SECURITY.md). PreToolUse (Edit|Write).
//
// Menolak penulisan isi yang memuat pola berbahaya, dan menolak penulisan berkas rahasia.
// Pengecualian satu baris: tambahkan komentar `sec-ok: <alasan>` pada baris yang sama (alasan wajib; akan muncul di review).
// Berkas dokumentasi (.md), hook, dan *.example tidak dipindai polanya.
// Gagal-terbuka untuk error internal hook.
const path = require('path');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const rel = (p) => path.relative(root, path.resolve(root, p || '')).split(path.sep).join('/');

// Berkas rahasia yang tidak boleh ditulis Claude. User mengisinya sendiri.
const SECRET_FILE = /(^|\/)(\.env(?!\.(example|sample|template)$)(\.[\w.-]+)?|[^/]*\.(pem|key|p12|pfx)|id_(rsa|ed25519)|settings\.local\.json)$/i;
const SCAN_SKIP = /(^|\/)(\.docs\/|\.claude\/|\.code-reviewer\/|node_modules\/|\.next\/)|\.(md|mdx|example|sample|template|lock)$|package-lock\.json$/i;
const SCAN_ONLY = /\.(ts|tsx|js|jsx|mjs|cjs|json|prisma|sql|css|env|yml|yaml)$/i;

const RULES = [
  // [regex, pesan]
  [/dangerouslySetInnerHTML/, 'dangerouslySetInnerHTML (XSS). Render sebagai teks, atau sanitasi dengan DOMPurify di server dan beri komentar sec-ok.'],
  [/\$(queryRaw|executeRaw)Unsafe\b/, '$queryRawUnsafe/$executeRawUnsafe (SQL injection). Pakai Prisma Client atau tagged template Prisma.sql.'],
  [/\beval\s*\(|new\s+Function\s*\(/, 'eval / new Function dilarang.'],
  [/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|PRIVATE|PASSWORD|PASSWD|TOKEN|DATABASE|DB_URL|SERVICE_ROLE|ACCESS_KEY|AUTH_SECRET|API_KEY)/, 'Variabel NEXT_PUBLIC_ ikut ke browser; jangan dipakai untuk rahasia.'],
  [/rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED/, 'Mematikan verifikasi TLS dilarang.'],
  [/allowDangerousEmailAccountLinking\s*:\s*true/, 'allowDangerousEmailAccountLinking: true memungkinkan pengambilalihan akun.'],
  [/ignoreBuildErrors\s*:\s*true|ignoreDuringBuilds\s*:\s*true/, 'Mengabaikan error build/typecheck/lint dilarang.'],
  [/ACL\s*:\s*['"]public-read(-write)?['"]/, 'ACL public-read dilarang; bucket R2 privat, akses lewat presigned URL.'],
  [/Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]/, 'CORS wildcard "*" dilarang; sebut origin eksplisit.'],
  [/\bcors\s*\(\s*\)/, 'cors() tanpa opsi (mengizinkan semua origin) dilarang.'],
  [/(?:cookies\(\)|cookie)[^\n]{0,80}(httpOnly|secure)\s*:\s*false/i, 'Cookie dengan httpOnly/secure false dilarang.'],
  [/\bjwt\.(decode)\s*\(/, 'jwt.decode tidak memverifikasi tanda tangan; pakai verify.'],
  [/\bMath\.random\s*\(\s*\)[^\n]{0,60}(token|secret|password|otp|nonce|code|key)|(token|secret|password|otp|nonce|key)[^\n]{0,60}\bMath\.random\s*\(/i, 'Math.random untuk token/rahasia dilarang; pakai crypto.randomBytes / crypto.randomUUID.'],
  [/\b(md5|sha1)\b\s*\(|createHash\(\s*['"](md5|sha1)['"]/i, 'MD5/SHA1 tidak aman untuk kredensial/token; pakai Argon2/bcrypt (password) atau SHA-256+ (integritas).'],
  [/(?:innerHTML|outerHTML)\s*=|document\.write\s*\(/, 'innerHTML/outerHTML/document.write dilarang; pakai React atau textContent.'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'Kunci privat tidak boleh ada di kode.'],
  [/\bAKIA[0-9A-Z]{16}\b|\bghp_[A-Za-z0-9]{36}\b|\bsk_live_[A-Za-z0-9]{16,}|\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'Token/kunci API literal di kode.'],
  [/\bpostgres(?:ql)?:\/\/[^:\s'"@/]+:(?!\$|\{|%|<|\*|password|your|xxx|changeme|user|pass\b)[^@\s'"]{4,}@/i, 'URL database berpassword literal; baca dari process.env lewat env.ts.'],
  [/(secret|password|passwd|api[_-]?key|private[_-]?key)\w*\s*[:=]\s*['"][A-Za-z0-9/+=_\-]{16,}['"]/i, 'Rahasia literal di kode; baca dari env tervalidasi (src/lib/env.ts).'],
  [/console\.(log|info|debug)\s*\([^)]*(password|token|secret|session|authorization|cookie|database_url)/i, 'Data sensitif dicetak ke log.'],
];

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    main(input);
  } catch (e) { /* gagal-terbuka */ }
  process.exit(0);
});

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
  process.exit(0);
}

function main(input) {
  const ti = input.tool_input || {};
  const file = rel(ti.file_path);
  if (!file || file.startsWith('..')) return;

  if (SECRET_FILE.test(file)) {
    deny(`CLAUDE.md §3: ${file} adalah berkas rahasia. Claude tidak menulisnya; user mengisi sendiri. Perbarui .env.example (tanpa nilai nyata) bila perlu.`);
  }
  if (SCAN_SKIP.test(file) || !SCAN_ONLY.test(file)) return;

  const text = String(ti.content != null ? ti.content : ti.new_string || '');
  if (!text) return;

  const lines = text.split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    if (/sec-ok:\s*\S{4,}/.test(line)) return;
    for (const [re, msg] of RULES) {
      if (re.test(line)) hits.push(`  baris ${i + 1}: ${msg}`);
    }
  });
  if (hits.length) {
    deny(`RULES_SECURITY.md: penulisan ${file} ditolak karena pola berbahaya:\n${hits.slice(0, 8).join('\n')}\nPerbaiki, atau bila memang aman tambahkan komentar "sec-ok: <alasan>" pada baris itu.`);
  }
}
