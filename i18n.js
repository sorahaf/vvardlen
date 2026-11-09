/* วาดเล่น: สลับภาษาไทย / อังกฤษ
   หน้าเว็บเขียนเป็นภาษาไทยตามปกติ ไฟล์นี้จะแปลข้อความบนหน้าให้เองเมื่อเลือก EN
   - คำแปลอยู่ใน EN ด้านล่าง (คำไทย: คำอังกฤษ)
   - {x} คือส่วนที่เปลี่ยนไปได้ เช่น ตัวเลขหรือชื่อ
   - ข้อความที่ไม่อยากให้แปล (เช่น ชื่อห้องที่คนตั้งเอง) ใส่ translate="no" ไว้ที่แท็ก */
(() => {
const EN = {
  // ---------- ทั้งสองหน้า ----------
  'วาดเล่น': 'Wadlen',
  'ปิด': 'Close',
  'ส่วนตัว': 'Private',
  'สาธารณะ': 'Public',
  'เข้าห้อง': 'Join',
  'รหัสห้อง': 'Room code',
  'รหัสห้องต้องมี 6 ตัว': 'Room codes have 6 characters',
  'หมดอายุแล้ว': 'Expired',
  'เชื่อมต่อไม่ได้ ลองเช็กอินเทอร์เน็ตแล้วลองใหม่': "Can't connect. Check your internet and try again",
  'ยังไม่ได้เปิดการเข้าใช้แบบไม่ระบุตัวตน (Anonymous) ใน Firebase': 'Anonymous sign-in is not turned on in Firebase yet',
  'โดเมนของเว็บนี้ยังไม่ได้รับอนุญาตใน Firebase (Authorized domains)': "This site's domain isn't allowed in Firebase yet (Authorized domains)",
  'รหัสผ่าน': 'Password',

  // ---------- หน้ารวมห้อง ----------
  'วาดเล่น สมุดวาดรูปออนไลน์ เส้นที่วาดจะขยับได้เอง วาดคนเดียวหรือเปิดห้องวาดกับเพื่อนก็ได้': 'Wadlen is an online sketchbook where every line wiggles on its own. Draw alone or open a room with a friend.',
  'วาดคนเดียว': 'Draw alone',
  'สมุดวาดออนไลน์ ฟรี ไม่ต้องสมัคร': 'Free online sketchbook, no sign-up',
  'ชวนเพื่อนมาวาดเล่นกันเถอะ': "Grab a friend and let's doodle!",
  'เส้นยุกเส้นยิก เจ้าก้อนปุ๊กปิ๊ก ดุ๊กดิ๊ก ขยับได้!!!': 'Wiggly lines, squishy blobs, everything jiggles!!!',
  'เริ่มวาดเลย': 'Start drawing',
  'สร้างห้องวาดกับเพื่อน': 'Draw with a friend',
  'ห้องที่เปิดอยู่': 'Open rooms',
  'มีรหัสห้อง?': 'Have a code?',
  'เข้า': 'Go',
  'ทั้งหมด': 'All',
  'ของฉัน': 'Mine',
  'สร้างห้องแรก': 'Create the first room',
  'ห้องละ 2 คน ทุกห้องจะหายเองเมื่อครบ 3 วันหลังสร้าง': '2 people per room. Rooms disappear 3 days after they are made.',
  'สร้างห้องใหม่': 'New room',
  'ชื่อห้อง': 'Room name',
  'เช่น ห้องวาดแมว': 'e.g. Cat doodles',
  'ทุกคนเห็นในรายการและกดเข้าได้ทันที': 'Everyone can see it in the list and join right away',
  'คนอื่นเห็นชื่อห้อง แต่ต้องมีรหัสผ่านถึงจะเข้าได้ ระบบสุ่มรหัสผ่านให้': 'Others can see the name but need the password to join. We make one for you.',
  'สร้างห้อง': 'Create room',
  'กำลังสร้างห้อง': 'Creating room',
  'สร้างห้องไม่สำเร็จ ลองใหม่อีกครั้ง': "Couldn't create the room. Please try again",
  'ยังไม่ได้ตั้งค่า Firebase จึงยังเปิดห้องไม่ได้ ดูวิธีตั้งค่าในไฟล์ README.md (วาดคนเดียวใช้ได้ตามปกติ)': "Firebase isn't set up yet, so rooms are off. See README.md (drawing alone still works)",
  'ฐานข้อมูลไม่อนุญาต ลองเช็กว่าใส่ Security Rules ชุดล่าสุดแล้วหรือยัง': 'The database said no. Check that the latest Security Rules are published',
  'ห้องไม่มีชื่อ': 'Untitled room',
  'ห้องของคุณ': 'Your room',
  'รหัส {c}': 'Code {c}',
  'เต็มแล้ว': 'Full',
  'ใส่รหัสผ่าน': 'Enter password',
  'รหัสผ่าน 6 ตัว': '6-character password',
  'รหัสผ่านต้องมี 6 ตัว': 'Passwords have 6 characters',
  'ยืนยันลบ': 'Sure? Delete',
  'ลบห้อง': 'Delete',
  'กำลังลบ': 'Deleting',
  'ยังไม่มีห้องที่เปิดอยู่': 'No open rooms yet',
  'ไม่มีห้องในหมวดนี้': 'No rooms here',
  'ห้องวาดเล่น': 'Doodle room',
  'ยังดูรายการห้องไม่ได้ ระหว่างนี้กด “เริ่มวาดเลย” ได้ก่อน': "Can't load rooms right now. You can still tap “Start drawing”",
  'หายในอีก {d} วัน {h} ชม.': 'Gone in {d}d {h}h',
  'หายในอีก {h} ชม.': 'Gone in {h}h',
  'หายในอีก {m} นาที': 'Gone in {m} min',

  // ---------- กระดานวาด ----------
  'กระดานวาด | วาดเล่น': 'Board | Wadlen',
  'สมุดวาดรูปออนไลน์ เส้นที่วาดจะขยับได้เอง มีดินสอ เส้นพิกเซล และเส้นหยัก เลือกกระดาษได้หลายแบบ': 'An online sketchbook where lines wiggle on their own. Pencil, pixel and wavy brushes, plus lots of papers.',
  'เครื่องมือ': 'Tools',
  'กลับหน้าแรก': 'Back to home',
  'สีเส้น': 'Color',
  'วงล้อสี': 'Color wheel',
  'รหัสสี': 'Color code',
  'คัดลอกรหัสสี': 'Copy color code',
  'หลอดดูดสี (I)': 'Eyedropper (I)',
  'หลอดดูดสี': 'Eyedropper',
  'วิธีคิดความสว่าง': 'Brightness mode',
  'ปกติ': 'Standard',
  'ตามสายตา': 'Perceptual',
  'ความสว่าง': 'Brightness',
  'สีด่วน': 'Quick colors',
  'สีที่เพิ่งใช้': 'Recent',
  'วาดแล้วสีจะมาอยู่ตรงนี้': 'Colors you use show up here',
  'สีที่บันทึกไว้': 'Saved',
  '+ เก็บสีนี้': '+ Save color',
  'กด “+ เก็บสีนี้” เพื่อเก็บสีไว้ใช้': 'Tap “+ Save color” to keep a color',
  'ลบ': 'Remove',
  'เสร็จ': 'Done',
  'มีสีนี้อยู่แล้ว': 'Already saved',
  'เก็บได้สูงสุด 24 สี ลบสีเก่าก่อนนะ': 'Up to 24 colors. Remove one first',
  'คัดลอก {c}': 'Copied {c}',
  'กดค้างที่รหัสสีแล้วเลือกคัดลอกได้เลย': 'Press and hold the color code to copy it',
  'แตะที่ภาพเพื่อดูดสี': 'Tap the picture to pick a color',
  'เลือกแปรง': 'Brushes',
  'ดินสอยุกยิก (1)': 'Wiggle pencil (1)',
  'ดินสอยุกยิก': 'Wiggle pencil',
  'เส้นพิกเซล (2)': 'Pixel line (2)',
  'เส้นพิกเซล': 'Pixel line',
  'เส้นหยัก (3)': 'Wavy line (3)',
  'เส้นหยัก': 'Wavy line',
  'สีน้ำมัน (4)': 'Oil paint (4)',
  'สีน้ำมัน': 'Oil paint',
  'ยางลบ (5)': 'Eraser (5)',
  'ยางลบ': 'Eraser',
  'ปรับเส้น': 'Line settings',
  'ความหนาของเส้น': 'Size',
  'ความเข้มสี': 'Paint amount',
  'เส้นสั่นมากแค่ไหน': 'Wiggle amount',
  'ขนาดเม็ดพิกเซล': 'Pixel size',
  'ลายหยัก': 'Wave shape',
  'ฟันเลื่อย': 'Zigzag',
  'คลื่น': 'Wave',
  'ขดสปริง': 'Coil',
  'หยักสูงแค่ไหน': 'Wave height',
  'หยักถี่หรือห่าง': 'Wave spacing',
  'เส้นขยับเร็วแค่ไหน': 'Wiggle speed',
  'เลือกกระดาษ': 'Paper',
  'ขาว': 'White',
  'สมุด': 'Lined',
  'ตาราง': 'Grid',
  'จุด': 'Dots',
  'คราฟท์': 'Kraft',
  'กระดาษเก่า': 'Old paper',
  'กระดานดำ': 'Chalkboard',
  'พิมพ์เขียว': 'Blueprint',
  'ล้างกระดาษ': 'Clear',
  'บันทึกรูป': 'Save',
  'ปุ่มลัดบนคีย์บอร์ด': 'Keyboard shortcuts',
  'ถึง': 'to',
  'เปลี่ยนแปรง': 'Switch brush',
  'เส้นบางลง หรือหนาขึ้น': 'Thinner or thicker',
  'หยุดหรือเล่นเส้น': 'Pause or play lines',
  '+ ลูกกลิ้ง ซูมเข้าออก': '+ scroll to zoom',
  'ลูกกลิ้ง หรือปุ่มลูกศร เลื่อนกระดาษ': 'Scroll wheel or arrow keys to move around',
  'กลับขนาดพอดีจอ': 'Fit to screen',
  'หลอดดูดสี หรือกด': 'Eyedropper, or hold',
  'ค้างแล้วคลิก': 'and click',
  'ดูภาพขาวดำ': 'Grayscale view',
  'ลองลากวาดดูเลย': 'Drag to draw',
  'เส้นที่วาดจะขยับได้เอง': 'Your lines will wiggle on their own',
  'ดูภาพขาวดำ (G)': 'Grayscale view (G)',
  'ขาวดำ': 'Grayscale',
  'วาดกับเพื่อน': 'Draw together',
  'เลเยอร์': 'Layers',
  'แปรงด่วน': 'Quick brushes',
  'เลือกสี': 'Pick color',
  'เครื่องมือทั้งหมด': 'All tools',
  'หยุดเส้น': 'Pause',
  'เล่นต่อ': 'Play',
  'ซูมออก': 'Zoom out',
  'ซูมเข้า': 'Zoom in',
  'ซูมออก (Ctrl -)': 'Zoom out (Ctrl -)',
  'ซูมเข้า (Ctrl +)': 'Zoom in (Ctrl +)',
  'กลับขนาดพอดีจอ (Ctrl 0)': 'Fit to screen (Ctrl 0)',
  'ที่เก็บรูปในเบราว์เซอร์เต็มแล้ว รูปล่าสุดอาจไม่ถูกเก็บไว้': 'Browser storage is full. Your latest drawing may not be saved',
  'ล้างกระดาษแล้ว (ทุกเลเยอร์) อยากได้คืนให้กด Undo': 'Cleared all layers. Press Undo to get it back',

  // เลเยอร์
  'เลเยอร์ {n}': 'Layer {n}',
  'เพิ่มเลเยอร์': 'Add layer',
  'เลื่อนขึ้น': 'Move up',
  'เลื่อนลง': 'Move down',
  'เลื่อนเลเยอร์ขึ้น': 'Move layer up',
  'เลื่อนเลเยอร์ลง': 'Move layer down',
  'รวมลงเลเยอร์ข้างล่าง': 'Merge down',
  'ลบเลเยอร์': 'Delete layer',
  'ความโปร่งของเลเยอร์': 'Layer opacity',
  'ปรับสีทั้งเลเยอร์': 'Recolor layer',
  'โทนสี': 'Hue',
  'เลื่อนโทนสีทั้งเลเยอร์': 'Shift hue of the whole layer',
  'ปรับความสว่างทั้งเลเยอร์': 'Adjust brightness of the whole layer',
  'ยกเลิก': 'Cancel',
  'ปรับสีเลเยอร์แล้ว': 'Layer recolored',
  'เลเยอร์นี้ซ่อนอยู่ กดรูปตาเพื่อแสดงก่อนวาด': 'This layer is hidden. Tap the eye to show it first',
  'มีได้สูงสุด 10 เลเยอร์': 'Up to 10 layers',
  'ต้องมีอย่างน้อย 1 เลเยอร์': 'You need at least 1 layer',
  'ลบเลเยอร์แล้ว อยากได้คืนให้กด Undo': 'Layer deleted. Press Undo to get it back',
  'ไม่มีเลเยอร์ข้างล่างให้รวม': 'No layer below to merge into',
  'แสดงทั้งสองเลเยอร์ก่อนรวม': 'Show both layers before merging',
  'รวมลงเลเยอร์ “{n}” แล้ว': 'Merged into “{n}”',
  'ซ่อนเลเยอร์': 'Hide layer',
  'แสดงเลเยอร์': 'Show layer',
  'กดอีกครั้งเพื่อเปลี่ยนชื่อ': 'Tap again to rename',

  // บันทึกรูป
  'รูปของคุณพร้อมแล้ว': 'Your picture is ready',
  'ภาพนิ่ง (PNG)': 'Still (PNG)',
  'ภาพขยับ (GIF)': 'Moving (GIF)',
  'รูปที่วาด': 'Your drawing',
  'กำลังทำ GIF': 'Making GIF',
  'กำลังทำ GIF รอสักครู่': 'Making the GIF, one moment',
  'ทำ GIF เสร็จแล้ว ขนาด {n} KB': 'GIF ready, {n} KB',
  'ทำ GIF ไม่สำเร็จ ลองใหม่อีกครั้ง': "Couldn't make the GIF. Please try again",
  'แสดงรูปในหน้านี้ไม่ได้ ลองเปิดเว็บจากลิงก์ของคุณ (GitHub Pages) แล้วบันทึกอีกครั้ง': "Can't show the picture here. Open the site from its own link (GitHub Pages) and save again",
  'บนคอม: คลิกขวาที่รูป แล้วเลือก “บันทึกรูปภาพ”': 'On a computer: right-click the picture and choose “Save image”',
  'บนมือถือ: กดค้างที่รูป แล้วเลือก “บันทึกรูปภาพ”': 'On a phone: press and hold the picture, then choose “Save image”',
  'กด “ดาวน์โหลด” เพื่อบันทึก': 'Press “Download” to save',
  'หรือคลิกขวา (กดค้างบนมือถือ) ที่รูปแล้วเลือก “บันทึกรูปภาพ”': 'or right-click (press and hold on a phone) and choose “Save image”',
  'คัดลอกรูป': 'Copy',
  'ดาวน์โหลด': 'Download',
  'คัดลอกรูปแล้ว วางที่ไหนก็ได้เลย': 'Copied! Paste it anywhere',
  'คัดลอกไม่ได้ ลองคลิกขวาที่รูปแล้วกดบันทึกแทนนะ': "Couldn't copy. Right-click the picture and save it instead",

  // ห้องวาดกับเพื่อน
  'วาดบนกระดาษแผ่นเดียวกันกับเพื่อนได้ ห้องละ 2 คน ทุกห้องจะหายเองเมื่อครบ 3 วัน': 'Draw on the same paper with a friend. 2 people per room, and rooms disappear after 3 days.',
  'ดูห้องทั้งหมด หรือสร้างห้องใหม่': 'See all rooms or create one',
  'หรือมีรหัสห้องแล้ว': 'Or join with a code',
  'รหัสห้อง 6 ตัว': '6-character room code',
  'รหัสผ่านห้องส่วนตัว': 'Private room password',
  'ลิงก์ห้อง': 'Room link',
  'คัดลอกลิงก์': 'Copy link',
  'รูปในห้องนี้แยกจากรูปที่คุณวาดคนเดียว ออกจากห้องเมื่อไหร่ รูปเดิมของคุณจะกลับมา': 'This room has its own paper. Your solo drawing comes back when you leave.',
  'ออกจากห้อง': 'Leave room',
  'กำลังต่อใหม่': 'Reconnecting',
  'คุณอยู่ในห้องแล้ว': "You're in the room",
  'กำลังเข้า': 'Joining',
  'กำลังเข้าห้อง {c}': 'Joining room {c}',
  'เข้าห้อง {c} แล้ว': 'Joined room {c}',
  'ห้องจะหายในอีก {d} วัน {h} ชั่วโมง': 'Room closes in {d} days {h} hours',
  'ห้องจะหายในอีก {h} ชั่วโมง': 'Room closes in {h} hours',
  'ห้องจะหายในอีก {m} นาที': 'Room closes in {m} minutes',
  'ห้องนี้ถูกลบแล้ว รูปเดิมของคุณกลับมาแล้ว': 'This room was deleted. Your own drawing is back',
  'ห้องนี้ครบ 3 วันแล้ว จึงปิดไป': 'This room reached 3 days and has closed',
  'เพื่อนเข้าห้องแล้ว วาดด้วยกันได้เลย': 'Your friend is here. Start drawing together!',
  'เพื่อนอยู่ในห้องแล้ว วาดด้วยกันได้เลย': 'Your friend is here. Start drawing together!',
  'เพื่อนออกจากห้องแล้ว': 'Your friend left',
  'ตอนนี้มีคุณคนเดียว ส่งลิงก์ให้เพื่อนได้เลย': "It's just you for now. Send the link to a friend",
  'ห้องนี้มีคนครบ 2 คนแล้ว': 'This room already has 2 people',
  'ล้างกระดาษของห้องแล้ว อยากได้คืนให้กด Undo': 'Room paper cleared. Press Undo to get it back',
  'ห้องนี้เป็นห้องส่วนตัว ใส่รหัสผ่านก่อนนะ': 'This room is private. Enter the password first',
  'รหัสผ่านไม่ถูกต้อง': 'Wrong password',
  'ยังไม่ได้ตั้งค่า Firebase ดูวิธีตั้งค่าในไฟล์ README.md': "Firebase isn't set up yet. See README.md",
  'ไม่พบห้องนี้ ลองเช็กรหัสอีกครั้ง': "Room not found. Check the code again",
  'ฐานข้อมูลไม่อนุญาต ลองเช็กว่าใส่ Security Rules แล้วหรือยัง': 'The database said no. Check that the Security Rules are published',
  'เน็ตหลุด กำลังเชื่อมต่อใหม่': 'Connection lost, reconnecting',
  'ออกจากห้องแล้ว รูปเดิมของคุณกลับมาแล้ว': 'You left the room. Your own drawing is back',
  'คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย': 'Link copied. Send it to a friend!',
  'กดค้างที่ลิงก์แล้วเลือกคัดลอกได้เลย': 'Press and hold the link to copy it',
  'ห้อง {c}': 'Room {c}',
};

const TH_RE = /[฀-๿]/;
const KEY = 'yukyik-lang';
let lang;
try { lang = localStorage.getItem(KEY); } catch (_) {}
if (lang !== 'th' && lang !== 'en') lang = /^th\b/i.test(navigator.language || '') ? 'th' : 'en';

// แปลงคำที่มี {x} เป็นรูปแบบสำหรับจับข้อความ
const PATS = [];
for (const k in EN){
  if (!k.includes('{')) continue;
  const names = [];
  const src = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (_, n) => { names.push(n); return '(.+?)'; });
  PATS.push({re: new RegExp('^' + src + '$'), names, en: EN[k]});
}
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, n) => (v && n in v) ? v[n] : m);
const missing = new Set();
function lookup(k){
  if (k in EN) return EN[k];
  for (const p of PATS){
    const m = k.match(p.re);
    if (m){ const v = {}; p.names.forEach((n, i) => v[n] = m[i + 1]); return fill(p.en, v); }
  }
  missing.add(k);
  return null;
}
function trText(s){
  const k = s.trim();
  if (!k || !TH_RE.test(k)) return null;
  const e = lookup(k);
  if (e == null) return null;
  return s.slice(0, s.indexOf(k)) + e + s.slice(s.indexOf(k) + k.length);
}

// ---------- แปลข้อความบนหน้า ----------
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'content'];
const touched = new Set();
const skip = el => !el || el.closest('script,style,[translate="no"]');
function doText(n){
  const cur = n.nodeValue;
  const orig = (n.__en !== undefined && cur === n.__en) ? n.__th : cur;
  if (!TH_RE.test(orig)) return;
  const e = trText(orig);
  if (e == null) return;
  n.__th = orig; n.__en = e; touched.add(n);
  if (cur !== e) n.nodeValue = e;
}
function doAttr(el, a){
  const cur = el.getAttribute(a);
  if (cur == null) return;
  const m = el.__i18n || (el.__i18n = {});
  const orig = (m[a] && cur === m[a][1]) ? m[a][0] : cur;
  if (!TH_RE.test(orig)) return;
  const e = trText(orig);
  if (e == null) return;
  m[a] = [orig, e]; touched.add(el);
  if (cur !== e) el.setAttribute(a, e);
}
function walk(root){
  if (root.nodeType === 3){ if (!skip(root.parentElement)) doText(root); return; }
  if (root.nodeType !== 1 || skip(root)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.nodeType === 1 && skip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n = root; n; n = tw.nextNode()){
    if (n.nodeType === 3) doText(n);
    else for (const a of ATTRS) if (n.hasAttribute(a)) doAttr(n, a);
  }
}
function restore(){
  for (const n of touched){
    if (n.nodeType === 3){ if (n.nodeValue === n.__en) n.nodeValue = n.__th; }
    else for (const a in n.__i18n){ const [th, en] = n.__i18n[a]; if (n.getAttribute(a) === en) n.setAttribute(a, th); }
  }
  touched.clear();
}
const mo = new MutationObserver(list => {
  for (const r of list){
    if (r.type === 'characterData') walk(r.target);
    else if (r.type === 'attributes') { if (!skip(r.target)) doAttr(r.target, r.attributeName); }
    else r.addedNodes.forEach(walk);
  }
});
let titleTh = null;
function apply(){
  document.documentElement.lang = lang;
  document.querySelectorAll('.lang-switch button').forEach(b => {
    b.classList.toggle('on', b.dataset.lang === lang); b.setAttribute('aria-pressed', b.dataset.lang === lang);
  });
  if (titleTh == null) titleTh = document.title;
  if (lang === 'en'){
    walk(document.head); walk(document.body);
    document.title = lookup(titleTh) || titleTh;
    mo.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:ATTRS});
  } else {
    mo.disconnect(); restore(); document.title = titleTh;
  }
}

// ---------- ปุ่ม TH / EN ----------
const css = document.createElement('style');
css.textContent = `
.lang-switch{display:inline-flex;align-items:center;gap:2px;padding:3px;border:1.5px solid var(--line,#e4d8c5);background:#fff;border-radius:999px;flex:none}
.lang-switch button{display:inline-flex;align-items:center;gap:4px;border:0;background:none;font:inherit;font-size:12.5px;font-weight:600;color:var(--muted,#8c8071);
  padding:4px 10px;border-radius:999px;cursor:pointer;touch-action:manipulation;line-height:1.2}
.lang-switch button:hover{color:var(--ink,#2a2420)}
.lang-switch button.on{background:var(--ink,#2a2420);color:#fff}
.lang-switch svg{width:13px;height:13px;flex:none}`;
document.head.append(css);
function mount(){
  document.querySelectorAll('.lang-slot').forEach(slot => {
    if (slot.firstChild) return;
    slot.innerHTML = '<div class="lang-switch" role="group" aria-label="Language" translate="no">' +
      '<button type="button" data-lang="th">TH</button>' +
      '<button type="button" data-lang="en"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c2 2.2 2 10.2 0 12.4M8 1.8c-2 2.2-2 10.2 0 12.4"/></svg>EN</button></div>';
    slot.querySelectorAll('button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  });
}
function setLang(l){
  if (l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch (_) {}
  apply();
  window.dispatchEvent(new CustomEvent('langchange', {detail:l}));
}

// ใช้ในโค้ดของหน้าได้: t('ข้อความไทย') คืนคำตามภาษาที่เลือก
window.i18n = { get lang(){ return lang; }, set: setLang, t: s => lang === 'en' ? (lookup(s) ?? s) : s, missing };

function start(){ mount(); apply(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
