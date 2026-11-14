/* ============================================================================
   core/config.js — static configuration, score rules, UI strings, saved state.
   Loaded FIRST: every other module reads these globals at load time.
   No DOM access here (except localStorage, which is allowed before <body>).
   ========================================================================== */

/* Country record (inserted by build.py):
   {id:ISO2, n:fallback name, r:region, d:SVG path, c:[x,y] marker,
    a:bbox area deg2, b:[x0,y0,x1,y1] main-landmass bbox, s:UN sub-region} */
const MAPS = /*__DATA__*/{};   // {"110":[countries],"50":[countries]} — one entry per data/geojson/<key>.geojson
const FLAGS = /*__FLAGS__*/{}; // optional SVG data-URIs by ISO2; otherwise the flag emoji / font is used
const S_ = 4;                  // world units per degree (must match build.py)
const W_W = 360 + 12;         // world width in degrees: the Pacific is wrapped 12° past 180 so
                               // Samoa/Tonga/Kiribati (shifted east by build.py) are inside the view

/* Live map state (filled by core/map.js). Declared here because config-time
   expressions below (nm, inReg) close over them. */
let DATA = [], byId = {}, curMap = null;

const REGS = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania', 'World'];

// Hand-picked "zoom to region" boxes [lon0,lat0,lon1,lat1] — bounding boxes of countries with
// far-flung territories (Russia, USA, France) would be useless.
// The map is Pacific-centred: the far-west Pacific islands (Samoa, Tonga, Kiribati) are stored
// shifted east by a full turn, so the world spans -180…W_EAST and Oceania stays on the right.
const W_EAST = 205;   // must match SHIFT_EAST / the geometry produced by build.py: the widest
                      // shifted country is Kiribati on the 50m file, whose scattered islands reach ~203°
const VIEWS = {
  Europe: [-25, 34, 45, 72], Asia: [25, -11, 150, 55], Africa: [-20, -36, 52, 38],
  'North America': [-170, 5, -50, 75], 'South America': [-85, -57, -32, 14],
  Oceania: [110, -50, W_EAST, 12], World: [-180, -60, W_EAST, 85]
};

/* UI strings. Every key is looked up as t(key); `sub:<name>` keys rename UN sub-regions. */
const T = {
en: {title: 'Map Quiz', sub: 'Find the country on the map.', reg: 'Region', mode: 'Attempts', per: 'Per country', glob: 'Global', n: 'Attempts', show: 'Task shows', flag: 'Flag only', name: 'Name only', both: 'Both', map: 'Map detail', mapLow: 'Low', mapHigh: 'High', mapNote: 'A more detailed map may slow the game down and changes which countries are included.', count: 'Countries in region', sGame: 'What to play', tm: 'Stop timer when a country is lost', tmTip: 'Wrong tries while you can still continue never stop the timer.', lock: 'Lock camera', restart: 'Restart', sCtl: 'Controls', rk: 'Restart key', rkTip: 'Click, then press the key you want', smooth: 'Camera smoothness', off: 'Off', cam: 'Return camera after a correct answer', popSize: 'Mistake popup size', sizeS: 'Small', sizeM: 'Medium', sizeL: 'Large', subs: 'Sub-regions', subSub: 'Smaller parts of the world. They add up with the regions you picked.', subClear: 'Clear', subDone: 'Done', 'eq:N': 'Africa north of the Equator', 'eq:S': 'Africa south of the Equator', 'sub:Middle Africa': 'Central Africa', 'sub:Northern America': 'Northern America (US & Canada)', sRules: 'Rules', sShow: 'Display & hints', sSite: 'Site', reps: 'Repetitions (1–10)', swr: 'Show name of the wrongly clicked country', hard: 'Hard mode', hardTip: 'Found countries are not highlighted; clicking one again costs an attempt.', lang: 'Language', go: 'Start', score: 'Score', left: 'left', menu: 'Menu', res: 'Resume', rst: 'Restart', chg: 'Change region', paused: 'Paused', reset: 'Reset view', zreg: 'Zoom to region', itwas: 'It was', cont: 'Continue', done: 'Finished', time: 'Time', pts: 'Score', err: 'Mistakes', first: 'Found on first try', again: 'Play again', last: 'Last games', Europe: 'Europe', Asia: 'Asia', Africa: 'Africa', 'North America': 'North America', 'South America': 'South America', Oceania: 'Oceania', World: 'Whole World'},
ru: {title: 'Викторина по карте', sub: 'Найдите страну на карте.', reg: 'Регион', mode: 'Попытки', per: 'На страну', glob: 'Общие', n: 'Количество', show: 'Задание', flag: 'Только флаг', name: 'Только название', both: 'Флаг и название', map: 'Детализация карты', mapLow: 'Низкая', mapHigh: 'Высокая', mapNote: 'Более детальная карта может снижать производительность и меняет набор стран.', count: 'Стран в регионе', sGame: 'Что играем', tm: 'Останавливать таймер при проигрыше страны', tmTip: 'Неверные попытки, пока можно продолжать, таймер не останавливают.', lock: 'Заблокировать камеру', restart: 'Перезапуск', sCtl: 'Управление', rk: 'Клавиша перезапуска', rkTip: 'Нажмите, затем нужную клавишу', smooth: 'Плавность камеры', off: 'Выкл', cam: 'Возвращать камеру после верного ответа', popSize: 'Размер подсказки при ошибке', sizeS: 'Маленький', sizeM: 'Средний', sizeL: 'Большой', subs: 'Подрегионы', subSub: 'Части света поменьше. Они складываются с выбранными регионами.', subClear: 'Сбросить', subDone: 'Готово', 'eq:N': 'Африка севернее экватора', 'eq:S': 'Африка южнее экватора', 'sub:Northern Africa': 'Северная Африка', 'sub:Western Africa': 'Западная Африка', 'sub:Middle Africa': 'Центральная Африка', 'sub:Eastern Africa': 'Восточная Африка', 'sub:Southern Africa': 'Южная Африка', 'sub:Northern Europe': 'Северная Европа', 'sub:Western Europe': 'Западная Европа', 'sub:Southern Europe': 'Южная Европа', 'sub:Eastern Europe': 'Восточная Европа', 'sub:Central Asia': 'Центральная Азия', 'sub:Eastern Asia': 'Восточная Азия', 'sub:South-Eastern Asia': 'Юго-Восточная Азия', 'sub:Southern Asia': 'Южная Азия', 'sub:Western Asia': 'Западная Азия', 'sub:Northern America': 'США и Канада', 'sub:Central America': 'Центральная Америка', 'sub:Caribbean': 'Карибы', 'sub:Australia and New Zealand': 'Австралия и Новая Зеландия', 'sub:Melanesia': 'Меланезия', 'sub:Micronesia': 'Микронезия', 'sub:Polynesia': 'Полинезия', sRules: 'Правила', sShow: 'Отображение и подсказки', sSite: 'Сайт', reps: 'Повторения (1–10)', swr: 'Показывать название ошибочно выбранной страны', hard: 'Сложный режим', hardTip: 'Найденные страны не подсвечиваются; повторный клик по ним стоит попытки.', lang: 'Язык', go: 'Начать', score: 'Счёт', left: 'осталось', menu: 'Меню', res: 'Продолжить', rst: 'Заново', chg: 'Сменить регион', paused: 'Пауза', reset: 'Сбросить вид', zreg: 'К региону', itwas: 'Это была', cont: 'Дальше', done: 'Готово', time: 'Время', pts: 'Счёт', err: 'Ошибки', first: 'С первой попытки', again: 'Играть снова', last: 'Последние партии', Europe: 'Европа', Asia: 'Азия', Africa: 'Африка', 'North America': 'Северная Америка', 'South America': 'Южная Америка', Oceania: 'Океания', World: 'Весь мир'}
};

/* Scoring: 100 − 25 per wrong try on this country + up to 50 speed bonus (fades to 0 over 10 s).
   A country that runs out of tries is skipped and scores 0. */
const BASE = 100, PEN = 25, BONUS = 50, BTIME = 10000;

const $ = id => document.getElementById(id);
const KEY = 'mapquiz.v1';
const MKEYS = Object.keys(MAPS).sort((a, b) => b - a);   // detail levels, coarse (fast) first

let S = {lang: 'en', set: {rkey: 'KeyR', smooth: 3, regs: ['Europe'], reps: 1, swr: false, mode: 'per', n: 3, show: 'both', hard: false, map: null}, game: null, recent: []};
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')) } catch (e) {}
if (typeof S.set.smooth !== 'number') S.set.smooth = 3;
if (typeof S.set.rkey !== 'string') S.set.rkey = 'KeyR';
if (!Array.isArray(S.set.regs)) S.set.regs = [S.set.reg || 'Europe'];   // older saves had a single region
S.set.reps = Math.min(10, Math.max(1, Math.round(S.set.reps) || 1));
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) {} };

const t = k => T[S.lang][k] || k;

/* Country names come from the browser (Intl.DisplayNames, offline); GeoJSON name as fallback. */
const dn = {};
try { ['en', 'ru'].forEach(l => dn[l] = new Intl.DisplayNames([l], {type: 'region'})) } catch (e) {}
const nm = id => { try { const x = dn[S.lang].of(id); if (x && x !== id) return x } catch (e) {} return byId[id].n; };
const flag = id => FLAGS[id]
  ? `<img class="fl" src="${FLAGS[id]}" alt="">`
  : `<span class="fe">${String.fromCodePoint(...[...id].map(ch => 127397 + ch.charCodeAt(0)))}</span>`;

/* A region token is: a continent name, 'World', 'sub:<UN sub-region>' (GeoJSON SUBREGION field)
   or 'eq:N' / 'eq:S' (Africa north / south of the equator, by the centre of the main landmass).
   A country is in play if ANY selected token matches. */
const inRegMap = (c, regs) => regs.some(r => r === 'World' || r === c.r
  || (r.startsWith('sub:') && c.s === r.slice(4))
  || (c.r === 'Africa' && (r === 'eq:N' ? c.c[1] / S_ <= 90 : r === 'eq:S' && c.c[1] / S_ > 90)));
const inReg = (id, regs) => inRegMap(byId[id], regs);

/* Sub-region picker: one block per continent, in this order. */
const SUBS = [
  ['Africa', ['eq:N', 'eq:S', 'sub:Northern Africa', 'sub:Western Africa', 'sub:Middle Africa', 'sub:Eastern Africa', 'sub:Southern Africa']],
  ['Europe', ['sub:Northern Europe', 'sub:Western Europe', 'sub:Southern Europe', 'sub:Eastern Europe']],
  ['Asia', ['sub:Central Asia', 'sub:Eastern Asia', 'sub:South-Eastern Asia', 'sub:Southern Asia', 'sub:Western Asia']],
  ['North America', ['sub:Northern America', 'sub:Central America', 'sub:Caribbean']],
  ['Oceania', ['sub:Australia and New Zealand', 'sub:Melanesia', 'sub:Micronesia', 'sub:Polynesia']]
];
const lab = k => T[S.lang][k] || k.replace(/^sub:/, '');
const regLabel = a => a.length > 3 ? a.slice(0, 3).map(lab).join(' + ') + ' +' + (a.length - 3) : a.map(lab).join(' + ');

/* "Zoom to region" box for one or several selected regions (union of the hand-picked boxes). */
function viewFor(regs) {
  if (regs.includes('World')) return VIEWS.World;
  const bx = [];
  regs.forEach(r => {
    if (VIEWS[r]) return bx.push(VIEWS[r]);
    // sub-regions: union of the countries' main-landmass boxes (+2° margin)
    DATA.forEach(c => {
      if (!inRegMap(c, [r])) return;
      const b = c.b || [c.c[0] - 20, c.c[1] - 20, c.c[0] + 20, c.c[1] + 20];
      bx.push([b[0] / S_ - 182, 90 - b[3] / S_ - 2, b[2] / S_ - 178, 90 - b[1] / S_ + 2]);
    });
  });
  if (!bx.length) return VIEWS.World;
  return [Math.min(...bx.map(a => a[0])), Math.min(...bx.map(a => a[1])),
          Math.max(...bx.map(a => a[2])), Math.max(...bx.map(a => a[3]))];
}
