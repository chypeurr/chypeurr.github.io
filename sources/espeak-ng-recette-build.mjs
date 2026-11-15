// eSpeak NG 1.52 pour Windows (prononciation des voix naturelles Kokoro) : code source officiel (archive Ubuntu,
// SHA-256 vérifié), compilé avec MinGW-w64, langues utiles seulement -> vendor/espeak-ng/win64.
// Licence GPL v3 : programme séparé (comme FFmpeg), livré avec sa licence et l'adresse de son code source.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const VERSION = '1.52.0';
const URL = `http://archive.ubuntu.com/ubuntu/pool/main/e/espeak-ng/espeak-ng_${VERSION}+dfsg.orig.tar.gz`;
const SHA256 = 'd2a886bae3547a15c52801cb37e415230834a7ee7f9a57352b98d60454d97cea';
const LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt'];
const dest = 'vendor/espeak-ng/win64';
const work = resolve('vendor/espeak-ng/build');

if (existsSync(join(dest, 'espeak-ng.exe')) && !process.argv.includes('--force')) { console.log(`eSpeak NG déjà présent dans ${dest}`); process.exit(0); }
mkdirSync(work, { recursive: true });
const tgz = join(work, 'source.tar.gz');
if (!existsSync(tgz)) {
  console.log(`Téléchargement du code source d'eSpeak NG ${VERSION}…`);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Téléchargement impossible : ${res.status}`);
  writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));
}
const actual = createHash('sha256').update(readFileSync(tgz)).digest('hex');
if (actual !== SHA256) { rmSync(tgz); throw new Error(`SHA-256 invalide (${actual} ≠ ${SHA256})`); }
const src = join(work, `espeak-ng-${VERSION}+dfsg`);
if (!existsSync(src)) execFileSync('tar', ['xzf', tgz, '-C', work]);

const opts = ['-DUSE_MBROLA=OFF', '-DUSE_LIBSONIC=OFF', '-DUSE_LIBPCAUDIO=OFF', '-DUSE_KLATT=OFF', '-DUSE_SPEECHPLAYER=OFF', '-DUSE_ASYNC=OFF', '-DESPEAK_BUILD_MANPAGES=OFF', '-DCMAKE_BUILD_TYPE=Release'];
const run = (args) => execFileSync('cmake', args, { stdio: ['ignore', 'ignore', 'inherit'] });
// 1) Version Linux : compile les données (dictionnaires, phonèmes), identiques sous Windows.
console.log('Compilation des données…');
run(['-S', src, '-B', join(work, 'native'), ...opts]);
run(['--build', join(work, 'native'), '-j4']);
// 2) Programme Windows (statique : aucune DLL à fournir).
console.log('Compilation du programme Windows…');
const tc = join(work, 'mingw.cmake');
writeFileSync(tc, ['set(CMAKE_SYSTEM_NAME Windows)', 'set(CMAKE_C_COMPILER x86_64-w64-mingw32-gcc)', 'set(CMAKE_CXX_COMPILER x86_64-w64-mingw32-g++)',
  'set(CMAKE_RC_COMPILER x86_64-w64-mingw32-windres)', 'set(CMAKE_FIND_ROOT_PATH /usr/x86_64-w64-mingw32)', 'set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)',
  'set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)', 'set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)', ''].join('\n'));
run(['-S', src, '-B', join(work, 'win'), `-DCMAKE_TOOLCHAIN_FILE=${tc}`, '-DCMAKE_EXE_LINKER_FLAGS=-static -static-libgcc', ...opts]);
run(['--build', join(work, 'win'), '-j4', '--target', 'espeak-ng-bin']);

rmSync(dest, { recursive: true, force: true });
const data = join(dest, 'espeak-ng-data');
mkdirSync(join(data, 'lang'), { recursive: true });
cpSync(join(work, 'win', 'src', 'espeak-ng.exe'), join(dest, 'espeak-ng.exe'));
const nd = join(work, 'native', 'espeak-ng-data');
for (const f of ['phondata', 'phonindex', 'phontab', 'intonations', ...LANGS.map((l) => `${l}_dict`)]) cpSync(join(nd, f), join(data, f));
// Définitions des langues : romanes (fr, es, it, pt) et germaniques de l'Ouest (en, de).
for (const g of ['roa', 'gmw']) cpSync(join(nd, 'lang', g), join(data, 'lang', g), { recursive: true });
cpSync(join(src, 'COPYING'), join(dest, 'LICENCE-eSpeak-NG.txt'));
writeFileSync(join(dest, 'SOURCE.txt'), [
  `eSpeak NG ${VERSION} (https://github.com/espeak-ng/espeak-ng), licence GNU GPL v3 ou ultérieure.`,
  'Utilisé comme programme séparé par Kakapoted Studio pour la prononciation des voix naturelles.',
  `Code source exact utilisé : ${URL}`,
  `SHA-256 : ${SHA256}`,
  'Compilé sans modification (MinGW-w64, options : sans MBROLA, sonic, pcaudio, Klatt, speech-player, asynchrone).',
  `Langues incluses : ${LANGS.join(', ')}.`, ''].join('\r\n'));
console.log(`eSpeak NG prêt dans ${dest}`);
