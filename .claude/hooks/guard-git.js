// Penjaga git sesuai CLAUDE.md §5 (GitHub, main + feature branch + PR).
//
// PreToolUse (Bash|PowerShell). Claude BOLEH commit dan push ke branch kerja (izin tetap dari user),
// tetapi SELALU diblokir:
//  - git add . / -A / --all; git add berkas rahasia (.env*, kunci privat, service account, settings.local.json)
//  - commit/push di atau ke main/master/development; push --force (hanya --force-with-lease ke branch kerja); --mirror/--all/--prune/--delete
//  - --no-verify / --no-gpg-sign, git config yang melemahkan pengaman, rewrite riwayat (filter-branch, reset --hard origin)
//  - git commit saat diff staged berisi pola rahasia (kunci privat, token, URL DB berpassword)
//  - gh pr merge/close, gh repo delete/edit, gh secret/variable, gh api dengan metode tulis destruktif
//  - prisma migrate reset / db push --accept-data-loss / migrate deploy / db execute, npm publish
//
// Gagal-terbuka hanya untuk error internal hook (input rusak); aturan di atas gagal-tertutup.
const path = require('path');
const { execFileSync } = require('child_process');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const PROTECTED = /^(main|master|development)$/;

// Berkas yang tidak boleh masuk git. .env.example / .env.sample / .env.template diizinkan.
const SECRET_FILE = new RegExp(
  '(^|[\\s/\\\\])(' +
    '\\.env(?!\\.(example|sample|template)\\b)(\\.[\\w.-]+)?' +
    '|[^\\s/\\\\]*\\.(pem|key|p12|pfx|jks|keystore|kdbx)' +
    '|id_(rsa|ed25519|ecdsa|dsa)' +
    '|[^\\s/\\\\]*service[-_]?account[^\\s/\\\\]*\\.json' +
    '|settings\\.local\\.json' +
    '|\\.vercel(/[^\\s]*)?' +
    '|\\.npmrc' +
  ')(?=\\s|$|["\'])',
  'i'
);

// Pola rahasia pada diff staged.
const SECRET_CONTENT = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'kunci privat'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bghp_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/, 'token GitHub'],
  [/\bsk_live_[A-Za-z0-9]{16,}/, 'Stripe live key'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'token Slack'],
  [/\bpostgres(?:ql)?:\/\/[^:\s'"@/]+:(?!\$|\{|%|<|\*|password|your|xxx|changeme|user|pass\b)[^@\s'"]{4,}@/i, 'URL database berpassword'],
  [/\b(?:R2|S3)?_?SECRET_ACCESS_KEY\s*[=:]\s*['"]?[A-Za-z0-9/+]{30,}/i, 'secret access key'],
  [/\b(?:AUTH_SECRET|NEXTAUTH_SECRET)\s*[=:]\s*['"]?[A-Za-z0-9/+=_-]{20,}/, 'AUTH_SECRET terisi'],
];

function git(args) {
  return execFileSync('git', args, { cwd: root, maxBuffer: 20 * 1024 * 1024 }).toString();
}
function currentBranch() {
  try { return git(['rev-parse', '--abbrev-ref', 'HEAD']).trim(); } catch (e) { return ''; }
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
  process.exit(0);
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch (e) { process.exit(0); }
  main(input);
  process.exit(0);
});

// Pecah perintah majemuk (; && || | newline) supaya tiap segmen dinilai sendiri.
const segments = (cmd) => cmd.split(/&&|\|\||[;|\n]/).map((s) => s.trim()).filter(Boolean);

function main(input) {
  const cmd = (input.tool_input || {}).command || '';
  if (!cmd) return;

  for (const seg of segments(cmd)) {
    // ---- git add ----
    if (/\bgit\s+(?:-[^\s]+\s+)*add\b/.test(seg)) {
      if (/\s(\.|\*|-A|--all|-u|--update)(?=\s|$)/.test(seg.replace(/^.*?\badd\b/, ' ') + ' ') ) {
        deny('CLAUDE.md §5: dilarang git add . / * / -A / -u — stage per nama berkas.');
      }
      if (SECRET_FILE.test(seg.replace(/^.*?\badd\b/, ' '))) {
        deny('CLAUDE.md §3/§5: berkas rahasia (.env*, kunci/sertifikat, service account, settings.local.json, .vercel, .npmrc) tidak boleh di-stage.');
      }
    }

    // ---- gh ----
    if (/\bgh\s+pr\s+(merge|close)\b/.test(seg)) deny('CLAUDE.md §5: merge/close PR dilakukan user, bukan Claude.');
    if (/\bgh\s+repo\s+(delete|edit|archive|rename|transfer)\b/.test(seg)) deny('CLAUDE.md §5: operasi gh repo yang mengubah repositori dilarang.');
    if (/\bgh\s+(secret|variable|ruleset)\b/.test(seg) && /\b(set|delete|remove|create|edit)\b/.test(seg)) deny('CLAUDE.md §5: gh secret/variable/ruleset tidak boleh diubah Claude.');
    if (/\bgh\s+api\b/.test(seg) && /(-X|--method)\s*(DELETE|PUT|PATCH|POST)\b/i.test(seg)) deny('CLAUDE.md §5: gh api dengan metode tulis dilarang; pakai perintah gh yang spesifik.');
    if (/\bgh\s+release\s+delete\b/.test(seg)) deny('CLAUDE.md §5: gh release delete dilarang.');

    // ---- Prisma / npm destruktif ----
    if (/\bprisma\s+migrate\s+reset\b/.test(seg) || /\bprisma\s+db\s+push\b[^\n]*(--accept-data-loss|--force-reset)/.test(seg)) {
      deny('CLAUDE.md §4 / RULES_DB: prisma migrate reset dan db push --accept-data-loss/--force-reset dilarang. Minta user bila memang perlu.');
    }
    if (/\bprisma\s+(migrate\s+deploy|db\s+execute)\b/.test(seg)) {
      deny('CLAUDE.md §4 / RULES_DB: prisma migrate deploy dan db execute menyentuh DB nyata; hanya user yang menjalankan.');
    }
    if (/\bnpm\s+publish\b|\bnpm\s+unpublish\b/.test(seg)) deny('npm publish/unpublish dilarang.');
    if (/\b(curl|wget)\b[^\n]*\|\s*(sudo\s+)?(ba)?sh\b/.test(cmd)) deny('Dilarang menjalankan skrip unduhan langsung (curl | sh).');

    // ---- git config / rewrite ----
    if (/\bgit\s+config\b/.test(seg) && /(core\.hooksPath|commit\.gpgsign|http\.sslVerify|credential\.helper|--global|--system)/i.test(seg)) {
      deny('CLAUDE.md §5: git config yang melemahkan pengaman atau bersifat global dilarang.');
    }
    if (/\bgit\s+(filter-branch|filter-repo|update-ref\s+-d)\b/.test(seg) || /\bgit\s+reset\s+--hard\s+\S*origin/.test(seg)) {
      deny('CLAUDE.md §5: rewrite riwayat / reset keras ke remote dilarang tanpa permintaan user.');
    }
    if (/\bgit\s+(clean)\b/.test(seg) && /-[a-z]*f/.test(seg)) deny('git clean -f dilarang karena menghapus berkas untracked (mungkin .env milik user).');

    // ---- commit / push ----
    const m = seg.match(/\bgit\s+(?:-[^\s]+\s+(?:[^\s-][^\s]*\s+)?)*(commit|push)\b/);
    if (!m) continue;
    const sub = m[1];
    const after = seg.slice(m.index);

    if (sub === 'commit' && /--no-verify|\s-[a-zA-Z]*n[a-zA-Z]*(?=\s)|--no-gpg-sign/.test(after.replace(/(-m|--message)\s+("[^"]*"|'[^']*')/g, ''))) deny('CLAUDE.md §5: --no-verify / --no-gpg-sign dilarang. Perbaiki penyebab hook gagal.');
    if (sub === 'push' && /--no-verify/.test(after)) deny('CLAUDE.md §5: --no-verify dilarang.');

    const branch = currentBranch();
    if (PROTECTED.test(branch)) deny(`CLAUDE.md §5: git ${sub} di branch ${branch} dilarang. Buat branch kerja (feature/, fix/, chore/) dan PR.`);

    if (sub === 'commit') {
      try {
        const staged = git(['diff', '--cached', '-U0', '--no-color']);
        const added = staged.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
        for (const [re, label] of SECRET_CONTENT) {
          if (re.test(added)) deny(`CLAUDE.md §3: diff staged berisi ${label}. Keluarkan dari commit (git restore --staged <berkas>), pindahkan ke .env.local, dan rotasi bila sudah pernah tersimpan.`);
        }
        const names = git(['diff', '--cached', '--name-only']).split('\n').filter(Boolean).join(' ');
        if (SECRET_FILE.test(' ' + names + ' ')) deny('CLAUDE.md §3: berkas rahasia ikut ter-stage. Keluarkan dengan git restore --staged.');
      } catch (e) { /* gagal-terbuka untuk error git internal */ }
      continue;
    }

    // push
    if (/(?:^|[\s:+/])(main|master|development)(?=\s|$)/.test(after.replace(/^git\s+push/, ''))) deny('CLAUDE.md §5: push ke main/master/development dilarang. Gunakan branch kerja dan PR.');
    if (/--(all|mirror|tags|prune|delete)\b|\s-d\b/.test(after)) deny('CLAUDE.md §5: push --all/--mirror/--tags/--prune/--delete dilarang.');
    if (/\s-f\b|--force(?!-with-lease)/.test(after)) deny('CLAUDE.md §5: push --force dilarang. Gunakan --force-with-lease hanya pada branch kerja milik sendiri.');
    if (/\s\+\S/.test(after.replace(/^git\s+push/, ''))) deny('CLAUDE.md §5: refspec "+" (force terselubung) dilarang.');
    if (!/\bpush\s+(?:-[-\w=]+\s+)*origin\s+[^\s-]\S*/.test(after)) {
      deny('CLAUDE.md §5: push harus eksplisit: git push -u origin <nama-branch-kerja>.');
    }
  }
}
