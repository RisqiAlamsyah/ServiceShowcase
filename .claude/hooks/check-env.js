// SessionStart: cek kebersihan rahasia repo (CLAUDE.md §3).
//  - .gitignore harus memuat .env* (kecuali .env.example), .vercel, dan folder build
//  - tidak boleh ada berkas .env* (selain *.example) yang sudah tracked di git
// TIDAK memanggil jaringan dan TIDAK pernah mencetak isi berkas. Tidak ada masalah -> diam.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function problems() {
  const out = [];
  let gi = '';
  try { gi = fs.readFileSync(path.join(root, '.gitignore'), 'utf8'); } catch (e) { out.push('.gitignore tidak ada.'); }
  const need = [['.env', /^\.env\*?$|^\.env\.\*$|^\.env$/m], ['.vercel', /^\.vercel\/?$/m], ['node_modules', /^\/?node_modules\/?$/m], ['.next', /^\/?\.next\/?$/m]];
  for (const [name, re] of need) if (gi && !re.test(gi)) out.push(`.gitignore belum memuat ${name}.`);
  try {
    const tracked = execFileSync('git', ['ls-files'], { cwd: root }).toString().split('\n');
    const bad = tracked.filter((f) => /(^|\/)\.env(\.[\w.-]+)?$/.test(f) && !/\.(example|sample|template)$/.test(f));
    if (bad.length) out.push(`Berkas rahasia ter-track di git: ${bad.join(', ')} (hapus dari index dan rotasi nilainya).`);
  } catch (e) { /* bukan repo git / git tidak ada */ }
  return out;
}

process.stdin.resume();
process.stdin.on('end', () => {
  try {
    const p = problems();
    if (p.length) {
      process.stdout.write(JSON.stringify({
        systemMessage: `⚠ Keamanan repo: ${p.join(' ')}`,
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: `PERINGATAN KEAMANAN: ${p.join(' ')} Sesuai CLAUDE.md §3, beri tahu user dan tawarkan perbaikan sebelum pekerjaan lain.`,
        },
      }));
    }
  } catch (e) { /* gagal-terbuka */ }
  process.exit(0);
});
