/**
 * THE KILTED SANTA PROJECT — sign-ups + Santa's Operations Hub (Google Apps Script)
 * --------------------------------------------------------------------------------
 * One script runs both pages:
 *   - the public sign-up page (families, adopters, volunteers)
 *   - Santa's Operations Hub, where the ELVES (Enthusiastic Loving Volunteers
 *     Empowering Santa) run the show: tasks, the adoption desk, routes, crew.
 *
 * Everything is saved in the Google Sheet "Kilted Santa Sign-ups" (SHEET_ID below).
 * Family photos and proof-of-residency files are saved privately in your
 * Google Drive folder "Kilted Santa Uploads". Photos are never published.
 *
 * WHO SEES WHAT IN THE HUB
 * - Every approved ELF: tasks, crew, family numbers, kids' first names, ages,
 *   sizes and wishes, gift progress, routes and the activity feed.
 * - Adoption ELVES and Leads: also parent names, phones, addresses, proof
 *   documents and adopter contact info.
 * - Santa teams: the addresses of the stops on their own route, as soon as an
 *   Adoption ELF or Lead puts a family on that route.
 * - Families nobody adopted go on the Lead's route by default ("random
 *   deliveries"), unless a Santa has said they're comfortable with them.
 * - Leads: also approve new volunteers, set roles and teams, and send ELF codes.
 *
 * SWING-BYS: anyone can ask for a quick Santa stop (for their own family or a
 * family they know). They're random stops, never promised, and get numbers like
 * SB-001 in the Families tab (Request type = Swing-by). ELVES can add ones that
 * come in through Facebook or a phone call right in the hub.
 *
 * REMOVING: Adoption ELVES and Leads can remove a family or swing-by that doesn't
 * add up; Leads can decline volunteer applicants or remove an ELF. Removed records
 * move to the Removed tab (with the reason), uploaded ID/bill photos go to the
 * trash, and a later sign-up with the same phone or address gets flagged.
 *
 * CHAT: the hub has crew chat: Everyone, the Adoption team, each Santa team, and
 * private messages between two ELVES. Messages are kept in the Chat tab.
 *
 * TABS IN THE SHEET: Families, Adopters, Volunteers (the ELVES), Tasks, Log, Chat, Removed.
 * You can edit the sheet directly any time; the hub reads it fresh.
 *
 * If you ever edit this script, run "setup" once, then use
 * Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy,
 * so the same web link keeps working.
 */

// ---------- settings ----------
const NOTIFY_EMAIL = '';      // where alerts go; blank = the account that owns this script
const SEND_ALERTS = true;
const FAMILY_PREFIX = 'KS-';
const PUBLIC_URL = 'https://thepeoplesvoices.org/Kilted-Santa/';
const HUB_URL = PUBLIC_URL + 'hub.html';
const GUIDE_URL = PUBLIC_URL + 'guide.html';
const FROM_NAME = 'The Kilted Santa Project';   // the "from" name on emails families, adopters and ELVES get
const LEAD_NAME = 'Justin (Santa)';
// The route that families nobody adopted go on by default.
const RANDOM_ROUTE = "Santa Justin's route";

// ZIP codes you can deliver to. Families outside these are still saved,
// but marked "Outside — check" so you can decide. Add or remove freely.
const SERVICE_AREA_NAME = 'Jackson County';
const SERVICE_ZIPS = [
  '49201', '49202', '49203', '49204', // Jackson
  '49230', // Brooklyn
  '49234', // Clarklake
  '49237', // Concord
  '49240', // Grass Lake
  '49241', // Hanover
  '49246', // Horton
  '49254', // Michigan Center
  '49259', // Munith
  '49261', // Napoleon
  '49263', // Norvell
  '49269', // Parma
  '49272', // Pleasant Lake
  '49277', // Rives Junction
  '49283', // Spring Arbor
  '49284'  // Springport
];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
];

const STATUSES = ['Pending review', 'Available', 'Adopted', 'Swing-by request', 'Delivered', 'Not listed'];
const SWING_PREFIX = 'SB-';
const GIFT_STEPS = ['Not started', 'Shopping', 'Gifts in', 'Wrapped', 'Loaded', 'Delivered'];
const HUB_ROLES = ['ELF', 'Adoption ELF', 'Lead'];
const HUB_ACCESS = ['Pending', 'Approved', 'Paused'];
const TASK_AREAS = ['Wrapping', 'Shopping', 'Pickups & drop-offs', 'Adoptions', 'Santa & delivery', 'Spread the word', 'Other'];

const FAMILY_HEADERS = [
  'Family #', 'Status', 'Submitted',
  'Parent/Guardian name', 'Phone', 'Email', 'Street address', 'City/Town', 'ZIP',
  'In service area?',
  'Best way to reach', 'Adults in home', 'Number of children',
  'Children (private: names + details)',
  'Household wishes (public)', 'Note to adopters (public)',
  'Hardship story (for posting)', 'OK to post publicly?',
  'Family photo', 'Proof of residency (private)',
  'Christmas Eve Santa delivery OK?', 'Private notes for coordinator', 'Consent given',
  'Adopted by', 'Adopter phone', 'Adopter email', 'Connection type',
  'Handled by', 'Gift progress', 'Santa team', 'Stop #', 'Team notes',
  'Request type', 'Requested by', 'Swing-by notes', 'Flag',
  'Family told', 'Family contacted', 'Lat', 'Lng', 'Mapped address', 'Adopter messages',
  'Kids data — do not edit'
];

const ADOPTER_HEADERS = [
  'Submitted', 'Family #', 'Name', 'Phone', 'Email',
  'Connection', 'Gift plan', 'Notes', 'Follow-up done?'
];

const VOLUNTEER_HEADERS = [
  'Submitted', 'Name', 'Phone', 'Email', 'City/Town',
  'Wants to help with', 'Availability', 'Has a vehicle?',
  'OK with background check?', 'Notes / experience', 'Follow-up done?',
  'Hub access', 'Hub role', 'ELF code', 'Santa team', 'Random deliveries OK?', 'Last seen', 'ELF ID'
];

const TASK_HEADERS = [
  'Task ID', 'Created', 'Created by', 'Title', 'Details', 'Area', 'Family #', 'Due',
  'Status', 'Claimed by', 'Done', 'Updates'
];

const LOG_HEADERS = ['When', 'Who', 'What'];
const CHAT_HEADERS = ['When', 'From', 'From ID', 'Channel', 'Message'];
const SPONSOR_HEADERS = ['ID', 'Added', 'Added by', 'Name', 'Kind', 'What they gave', 'Value', 'Drop-off spot',
  'Address', 'Website', 'Contact person', 'Phone', 'Email', 'OK to list publicly', 'Thank-you note', 'Status', 'Thanked', 'Private notes'];
const SPONSOR_KINDS = ['Local small business', 'Corporate sponsor', 'Church / nonprofit', 'Community group', 'Individual'];
const SPONSOR_STATUSES = ['Asked', 'Said yes', 'Received', 'Thanked'];
const CHEER_HEADERS = ['ID', 'When', 'Who', 'ELF ID', 'Text', 'Shout-out to', 'Photo file ID', 'Reactions'];
const CHEER_EMOJI = ['🎉', '❤️', '🎅', '🙌', '😂'];
const REMOVED_HEADERS = ['When', 'Removed by', 'Type', 'ID', 'Name', 'Phone', 'Address', 'Reason', 'Record'];

// ---------- one-time setup (safe to run again) ----------
function setup() {
  const fam = table_('Families', FAMILY_HEADERS);
  table_('Adopters', ADOPTER_HEADERS);
  const vol = table_('Volunteers', VOLUNTEER_HEADERS);
  table_('Tasks', TASK_HEADERS);
  table_('Log', LOG_HEADERS);
  table_('Chat', CHAT_HEADERS);
  table_('Removed', REMOVED_HEADERS);
  table_('Cheers', CHEER_HEADERS);
  table_('Sponsors', SPONSOR_HEADERS);
  ensureElfIds_();
  clearAutoHandled_();

  dropdown_(fam, 'Status', STATUSES);
  dropdown_(fam, 'Gift progress', GIFT_STEPS);
  dropdown_(vol, 'Hub access', HUB_ACCESS);
  dropdown_(vol, 'Hub role', HUB_ROLES);
  dropdown_(vol, 'Random deliveries OK?', ['Yes', 'No']);

  // Hide the machine-readable column so it doesn't get edited by accident.
  fam.sh.showColumns(1, fam.sh.getMaxColumns());
  fam.sh.hideColumns(fam.map['Kids data — do not edit'] + 1);

  // Anyone who signed up before the hub existed starts as Pending.
  rows_(vol).forEach(function (r) {
    if (r['Name'] && !r['Hub access']) set_(vol, r._row, { 'Hub access': 'Pending' });
  });

  // Make sure the private upload folders exist.
  folder_('photos');
  folder_('proof');

  // Make sure there is at least one Lead (the owner) who can get into the hub.
  const owner = Session.getEffectiveUser().getEmail();
  const hasLead = rows_(vol).some(function (r) {
    return r['Hub role'] === 'Lead' && r['Hub access'] === 'Approved';
  });
  if (!hasLead && owner) {
    const code = newCode_();
    append_(vol, {
      'Submitted': new Date(), 'Name': LEAD_NAME, 'Email': owner,
      'Wants to help with': 'Steering the project',
      'Hub access': 'Approved', 'Hub role': 'Lead', 'ELF code': code,
      'Santa team': RANDOM_ROUTE, 'Random deliveries OK?': 'Yes', 'ELF ID': newElfId_()
    });
    sendCode_(LEAD_NAME, owner, code);
    Logger.log('Lead ELF code for ' + owner + ': ' + code);
  }

  ss_().rename('Kilted Santa Sign-ups');
  const blank = ss_().getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0) ss_().deleteSheet(blank);
}

// ---------- web endpoints ----------
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'families') return json_({ ok: true, families: listAvailable_(), thanks: publicSponsors_() });
  return json_({ ok: true, message: 'Kilted Santa sign-up service is running.' });
}

function doPost(e) {
  let data;
  try { data = JSON.parse(e.postData.contents); }
  catch (err) { return json_({ ok: false, error: 'Could not read the form.' }); }

  // Spam trap: real people never fill the hidden "website" field.
  if (data.website) return json_({ ok: true });

  try {
    if (data.type === 'hub') return json_(hub_(data));
    return json_(withLock_(function () {
      switch (data.type) {
        case 'family':    return addFamily_(data);
        case 'adopt':     return adoptFamily_(data);
        case 'volunteer': return addVolunteer_(data);
        case 'swingby':   return addSwingBy_(data, null);
        case 'mylist':    return myList_(data);
        case 'adopter_msg': return adopterMsg_(data);
        default:          return { ok: false, error: 'Unknown form.' };
      }
    }));
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Something went wrong on our end. Please try again.' });
  }
}

// Phones retry when a connection drops. Each save carries a request id; if we've already
// done that exact request, say "saved" instead of doing it twice (a double task, a double message).
function once_(rid, fn) {
  rid = String(rid || '').replace(/[^\w-]/g, '').slice(0, 60);
  if (!rid) return fn();
  const cache = CacheService.getScriptCache(), key = 'rid_' + rid;
  if (cache.get(key)) return { ok: true, msg: 'Saved.' };
  const res = fn();
  if (res && res.ok !== false) cache.put(key, '1', 1800);
  return res;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------- families (public sign-up) ----------
function addFamily_(d) {
  if (!clean_(d.name) || !clean_(d.phone)) return { ok: false, error: 'Name and phone are required.' };
  const kids = Array.isArray(d.kids) ? d.kids.slice(0, 15) : [];
  if (!kids.length) return { ok: false, error: 'Please add at least one child or household member.' };

  const photoErr = checkUpload_(d.photo, 'family photo');
  if (photoErr) return { ok: false, error: photoErr };
  const proofErr = checkUpload_(d.proof, 'proof of residency');
  if (proofErr) return { ok: false, error: proofErr };

  const fam = table_('Families', FAMILY_HEADERS);
  const props = PropertiesService.getScriptProperties();
  const next = Number(props.getProperty('nextFamily') || 1);
  props.setProperty('nextFamily', String(next + 1));
  const famNo = FAMILY_PREFIX + String(next).padStart(3, '0');
  const who = clean_(d.name, 60);

  // Save the uploads to the private Drive folders.
  let photoUrl = '', proofUrl = '';
  try {
    photoUrl = saveUpload_(d.photo, folder_('photos'), famNo + ' — ' + who + ' — family photo');
    proofUrl = saveUpload_(d.proof, folder_('proof'), famNo + ' — ' + who + ' — proof of residency');
  } catch (err) {
    return { ok: false, error: 'We could not save your photos. Please try again, or try smaller pictures.' };
  }

  const privateKids = kids.map(function (k, i) {
    return (i + 1) + '. ' + (clean_(k.name) || '(no name)') + ' — ' + kidSummary_(k);
  }).join('\n');

  const kidsData = kids.map(function (k) {
    return {
      name: clean_(k.name, 40),
      age: clean_(k.age, 10), gender: clean_(k.gender, 30),
      clothing: clean_(k.clothing, 40), shoe: clean_(k.shoe, 20),
      wishes: clean_(k.wishes, 600), likes: clean_(k.likes, 300)
    };
  });

  const zip = String(d.zip || '').replace(/\D/g, '').slice(0, 5);
  const inArea = SERVICE_ZIPS.indexOf(zip) >= 0 ? 'Yes' : 'Outside — check';
  const flag = matchFlag_(fam, d.phone, d.address);

  append_(fam, {
    'Family #': famNo,
    'Flag': flag,
    'Status': 'Pending review',
    'Submitted': new Date(),
    'Parent/Guardian name': clean_(d.name),
    'Phone': text_(d.phone, 40),
    'Email': clean_(d.email),
    'Street address': clean_(d.address),
    'City/Town': clean_(d.town),
    'ZIP': text_(d.zip, 12),
    'In service area?': inArea,
    'Best way to reach': clean_(d.contactPref),
    'Adults in home': clean_(d.adults, 10),
    'Number of children': kids.length,
    'Children (private: names + details)': privateKids,
    'Household wishes (public)': clean_(d.household, 600),
    'Note to adopters (public)': clean_(d.story, 800),
    'Hardship story (for posting)': clean_(d.hardship, 4000),
    'OK to post publicly?': clean_(d.sharePermission, 100),
    'Family photo': photoUrl,
    'Proof of residency (private)': proofUrl,
    'Christmas Eve Santa delivery OK?': clean_(d.santaVisit),
    'Private notes for coordinator': clean_(d.privateNotes, 1000),
    'Consent given': d.consent ? 'Yes' : 'No',
    'Gift progress': 'Not started',
    'Kids data — do not edit': JSON.stringify(kidsData)
  });

  logAs_('Sign-up page', 'New family signed up: ' + famNo + ' (' + clean_(d.town, 40) + ')' +
    (inArea === 'Yes' ? '' : ' — outside ' + SERVICE_AREA_NAME));

  alert_('New family sign-up: ' + famNo + (inArea === 'Yes' ? '' : ' (OUTSIDE service area)') + (flag ? ' ⚠️ FLAGGED' : ''),
    clean_(d.name) + ' (' + clean_(d.town) + ' ' + zip + ') signed up with ' + kids.length + ' child(ren).\n' +
    'In ' + SERVICE_AREA_NAME + ' service area: ' + inArea + '\n' +
    'OK to share their story: ' + clean_(d.sharePermission, 100) + '\n' +
    (flag ? '⚠️ ' + flag + '\n' : '') + '\n' +
    'Review them in Santa\'s Operations Hub: ' + HUB_URL + '\n\n' +
    'Family photo: ' + photoUrl + '\nProof of residency: ' + proofUrl);

  mail_(d.email, 'We got your Kilted Santa sign-up (' + famNo + ') 🎄',
    'Hi ' + firstName_(d.name) + '!\n\n' +
    'Thank you for reaching out to the Kilted Santa Project. We got your sign-up, and your family number is ' + famNo + '. ' +
    'Please keep this email so you have it.\n\n' +
    'What happens next:\n' +
    '1. One of our volunteers (we call them ELVES) checks your sign-up and proof of address. We can only serve families in ' + SERVICE_AREA_NAME + '.\n' +
    '2. Once you\'re approved, your wish list goes on our Adopt page so a sponsor can choose your family. ' +
    'We only ever share first names, ages and wishes — never your last name, address or photos.\n' +
    '3. If a sponsor adopts your family, we\'ll email you right away, and an ELF will be in touch about delivery.\n\n' +
    'We have a lot of families signing up this year, and we can\'t promise every family will be adopted, ' +
    'but our whole crew is working to reach as many as we can.\n\n' +
    'If your phone number or address changes, just reply to this email and let us know.\n\n' +
    'Merry Christmas,\n— The Kilted Santa Project');

  return { ok: true, familyNumber: famNo, inArea: inArea === 'Yes' };
}

// ---------- adopters can always get their family's wish list back ----------
function publicFam_(r) {
  let kids = [];
  try { kids = JSON.parse(r['Kids data — do not edit'] || '[]'); } catch (e) {}
  return {
    id: String(r['Family #']),
    kids: kids.map(function (k) {
      return { age: k.age || '', gender: k.gender || '', clothing: k.clothing || '',
               shoe: k.shoe || '', wishes: k.wishes || '', likes: k.likes || '' };
    }),
    household: String(r['Household wishes (public)'] || ''),
    story: String(r['Note to adopters (public)'] || '')
  };
}

function wishListText_(r) {
  const f = publicFam_(r);
  const lines = [];
  f.kids.forEach(function (k) {
    lines.push('• ' + (k.gender || 'Child') + (k.age ? ', ' + k.age : '') +
      ((k.clothing || k.shoe) ? '  (' + [k.clothing && 'clothes ' + k.clothing, k.shoe && 'shoes ' + k.shoe].filter(String).join(', ') + ')' : ''));
    if (k.wishes) lines.push('    Wishes: ' + k.wishes);
    if (k.likes) lines.push('    Loves: ' + k.likes);
  });
  if (f.household) lines.push('', 'For the household: ' + f.household);
  if (f.story) lines.push('', 'A note from the family: ' + f.story);
  return lines.join('\n');
}

function sendWishList_(r, name, email) {
  email = String(email || '').trim();
  if (!email || email.indexOf('@') < 0) return false;
  const id = String(r['Family #']);
  return mail_(email, 'Your Kilted Santa family: ' + id + ' wish list 🎁',
      'Hi ' + (String(name || '').split(' ')[0] || 'there') + '!\n\n' +
      'Thank you for adopting Family ' + id + '! Here is their wish list, so you have it handy while you shop:\n\n' +
      wishListText_(r) + '\n\n' +
      'Need it again later? Go to ' + PUBLIC_URL + '#mylist and enter ' + id + ' with this email address.\n\n' +
      'One of our ELVES will reach out in the next couple of days to say hi and help with drop-off.\n\n' +
      'Questions about sizes, wishes or dropping off gifts? Send the crew a message here (it goes to the whole team, so someone sees it fast):\n' +
      PUBLIC_URL + '#mylist  (enter ' + id + ' and this email address)\n\n' +
      'Thank you for being someone\'s Christmas!\n— The Kilted Santa Project');
}

// "Already adopted? See your family's wish list": family # plus the adopter's email or phone.
function myList_(d) {
  const m = adopterMatch_(d);
  if (!m.ok) return m;
  return { ok: true, family: publicFam_(m.r), thread: adopterView_(threadOf_(m.r)) };
}
// What the adopter sees of the conversation: ELF first names only.
function adopterView_(t) {
  return t.map(function (x) { return { from: x.from, who: x.from === 'crew' ? firstName_(x.who) : 'You', when: x.when, text: x.text }; });
}

// An adopter proves who they are with the family # plus the email or phone they adopted with.
function adopterMatch_(d) {
  const contact = String(d.contact || '').trim().toLowerCase();
  const id = String(d.familyId || '').trim().toUpperCase().replace(/\s/g, '');
  if (!contact || !id) return { ok: false, error: 'Please enter your family number and the email or phone you used.' };
  const cache = CacheService.getScriptCache();
  const key = 'list_' + Utilities.base64EncodeWebSafe(contact).slice(0, 200);
  const fails = Number(cache.get(key) || 0);
  if (fails >= 10) return { ok: false, error: 'Too many tries. Please wait a few minutes, or reach out to us.' };
  const fam = table_('Families', FAMILY_HEADERS);
  const r = findFamily_(fam, id.indexOf('-') < 0 ? id.replace(/^KS/, 'KS-') : id);
  const digits = contact.replace(/\D/g, '');
  const match = r && ['Adopted', 'Delivered'].indexOf(String(r['Status'])) >= 0 && (
    (contact.indexOf('@') > 0 && String(r['Adopter email'] || '').trim().toLowerCase() === contact) ||
    (digits.length >= 7 && String(r['Adopter phone'] || '').replace(/\D/g, '').slice(-10) === digits.slice(-10)));
  if (!match) {
    cache.put(key, String(fails + 1), 600);
    return { ok: false, error: 'We couldn\'t find that family with that email or phone. Check the family number (like KS-004), or reach out to us.' };
  }
  return { ok: true, r: r, fam: fam };
}

// ---------- adopter <-> crew messages (kept in the hub, not anyone's personal inbox) ----------
function threadOf_(r) {
  try { const t = JSON.parse(r['Adopter messages'] || '[]'); return Array.isArray(t) ? t : []; } catch (e) { return []; }
}
function addToThread_(r, from, who, text) {
  const t = threadOf_(r);
  t.push({ from: from, who: who, when: new Date().toISOString(), text: text });
  return JSON.stringify(t.slice(-40));
}
function adopterMsg_(d) {
  const m = adopterMatch_(d);
  if (!m.ok) return m;
  const text = clean_(d.message, 1000);
  if (!text) return { ok: false, error: 'Write your message first.' };
  const cache = CacheService.getScriptCache(), key = 'amsg_' + String(m.r['Family #']);
  const n = Number(cache.get(key) || 0);
  if (n >= 8) return { ok: false, error: 'You\'ve sent a few messages already. An ELF will get back to you soon.' };
  cache.put(key, String(n + 1), 3600);
  const id = String(m.r['Family #']), who = String(m.r['Adopted by'] || 'Adopter');
  const thread = addToThread_(m.r, 'adopter', who, text);
  set_(m.fam, m.r._row, { 'Adopter messages': thread });
  const open = rows_(table_('Tasks', TASK_HEADERS)).some(function (t) {
    return String(t['Family #']) === id && t['Status'] !== 'Done' && /^💬 /.test(String(t['Title']));
  });
  if (!open) addTask_('Sign-up page', {
    'Title': '💬 ' + firstName_(who) + ' (' + id + '\'s adopter) sent a message',
    'Details': 'Open Family ' + id + ' and reply right in the adopter section. Your reply is emailed to them.',
    'Area': 'Adoptions', 'Family #': id });
  logAs_('Sign-up page', firstName_(who) + ', the adopter of Family ' + id + ', sent the crew a message 💬');
  return { ok: true, thread: adopterView_(JSON.parse(thread)) };
}

// Every new adoption gets a friendly first touch from an ELF, on the task board.
function adopterTask_(id, adopter, connection, by) {
  const exists = rows_(table_('Tasks', TASK_HEADERS)).some(function (t) {
    return String(t['Family #']) === String(id) && /^🤝 /.test(String(t['Title']));
  });
  if (exists) return false;
  const direct = /directly/i.test(String(connection || ''));
  addTask_(by, {
    'Title': '🤝 Say hi to ' + firstName_(adopter) + ', the adopter of Family ' + id,
    'Details': direct
      ? 'They asked to connect DIRECTLY with the family. Call the family first and make sure they\'re OK sharing contact info, then connect them both ways. Mark the family contacted when you talk to them.'
      : 'Introduce yourself, answer any questions about sizes or wishes, and set up how the gifts get to us. Reply to them from the Families tab (Family ' + id + ').',
    'Area': 'Adoptions', 'Family #': String(id) });
  return true;
}

// What the public Adopt page sees. Never names, addresses, phones or photos.
function listAvailable_() {
  const fam = table_('Families', FAMILY_HEADERS);
  return rows_(fam).filter(function (r) {
    return String(r['Status']).trim() === 'Available';
  }).map(function (r) {
    let kids = [];
    try { kids = JSON.parse(r['Kids data — do not edit'] || '[]'); } catch (e) {}
    return {
      id: String(r['Family #']),
      kids: kids.map(function (k) {
        return { age: k.age || '', gender: k.gender || '', clothing: k.clothing || '',
                 shoe: k.shoe || '', wishes: k.wishes || '', likes: k.likes || '' };
      }),
      household: String(r['Household wishes (public)'] || ''),
      story: String(r['Note to adopters (public)'] || '')
    };
  });
}

// ---------- adopters (public page) ----------
function adoptFamily_(d) {
  if (!clean_(d.name) || !(clean_(d.phone) || clean_(d.email)))
    return { ok: false, error: 'Please give your name and a phone or email.' };

  const fam = table_('Families', FAMILY_HEADERS);
  const r = findFamily_(fam, d.familyId);
  if (!r) return { ok: false, error: 'We could not find that family.', taken: true };
  if (String(r['Status']).trim() !== 'Available')
    return { ok: false, taken: true, error: 'Someone just adopted this family — thank you! Please pick another.' };

  set_(fam, r._row, {
    'Status': 'Adopted',
    'Adopted by': clean_(d.name),
    'Adopter phone': text_(d.phone, 40),
    'Adopter email': clean_(d.email),
    'Connection type': clean_(d.connection)
  });

  append_(table_('Adopters', ADOPTER_HEADERS), {
    'Submitted': new Date(),
    'Family #': String(d.familyId),
    'Name': clean_(d.name),
    'Phone': text_(d.phone, 40),
    'Email': clean_(d.email),
    'Connection': clean_(d.connection),
    'Gift plan': clean_(d.giftPlan),
    'Notes': clean_(d.notes, 1000)
  });

  logAs_('Sign-up page', clean_(d.name, 60) + ' adopted Family ' + d.familyId + ' 🎁');
  sendWishList_(r, clean_(d.name, 60), clean_(d.email));
  tellFamilyAdopted_(fam, r, 'Sign-up page');
  adopterTask_(String(d.familyId), clean_(d.name, 60), clean_(d.connection), 'Sign-up page');

  alert_('Family ' + d.familyId + ' was adopted',
    clean_(d.name) + ' adopted ' + d.familyId + '.\n' +
    'Phone: ' + clean_(d.phone) + '   Email: ' + clean_(d.email) + '\n' +
    'Connection: ' + clean_(d.connection) + '\nGift plan: ' + clean_(d.giftPlan) + '\n\n' +
    'The adoption ELVES can follow up in the hub: ' + HUB_URL);

  return { ok: true };
}

// ---------- Santa swing-bys (public page, or added by an ELF in the hub) ----------
function addSwingBy_(d, ctx) {
  const nominated = d.forWho === 'someone';
  const famPhone = clean_(d.phone, 40);
  const reqPhone = clean_(d.requesterPhone, 40);
  if (!clean_(d.name)) return { ok: false, error: 'Please add the family\'s name.' };
  if (!famPhone && !(nominated && reqPhone)) return { ok: false, error: 'Please add a phone number so we can reach someone.' };
  if (!clean_(d.address) || !clean_(d.town)) return { ok: false, error: 'Please add the address where Santa would stop.' };
  if (nominated && !clean_(d.requester)) return { ok: false, error: 'Please add your name, since you\'re asking for someone else.' };
  if (!ctx && !d.okVisit) return { ok: false, error: 'Please confirm the family would welcome a Santa visit.' };
  const kids = (Array.isArray(d.kids) ? d.kids : []).slice(0, 15).map(function (k) {
    return { name: clean_(k.name, 40), age: clean_(k.age, 10), gender: '', clothing: '', shoe: '', wishes: '', likes: '' };
  }).filter(function (k) { return k.name || k.age; });
  if (!kids.length) return { ok: false, error: 'Tell us who the visit is for (first names and ages).' };

  const fam = table_('Families', FAMILY_HEADERS);
  const props = PropertiesService.getScriptProperties();
  const next = Number(props.getProperty('nextSwing') || 1);
  props.setProperty('nextSwing', String(next + 1));
  const id = SWING_PREFIX + String(next).padStart(3, '0');
  const zip = String(d.zip || '').replace(/\D/g, '').slice(0, 5);
  const inArea = SERVICE_ZIPS.indexOf(zip) >= 0 ? 'Yes' : 'Outside — check';
  const flag = matchFlag_(fam, famPhone || reqPhone, d.address);
  const requestedBy = ctx
    ? 'Added in the hub by ' + ctx.name + (clean_(d.source) ? ' (' + clean_(d.source, 80) + ')' : '')
    : (nominated ? clean_(d.requester, 60) + (reqPhone ? ' · ' + reqPhone : '') + ' (nominated them)' : 'The family');

  append_(fam, {
    'Family #': id,
    'Status': 'Swing-by request',
    'Request type': 'Swing-by',
    'Submitted': new Date(),
    'Parent/Guardian name': clean_(d.name),
    'Phone': text_(famPhone, 40),
    'Email': clean_(d.email),
    'Street address': clean_(d.address),
    'City/Town': clean_(d.town),
    'ZIP': text_(d.zip, 12),
    'In service area?': inArea,
    'Best way to reach': clean_(d.contactPref),
    'Number of children': kids.length,
    'Children (private: names + details)': kids.map(function (k, i) {
      return (i + 1) + '. ' + (k.name || '(no name)') + ' — ' + (k.age ? 'age ' + k.age : '');
    }).join('\n'),
    'Requested by': requestedBy,
    'Swing-by notes': clean_(d.special, 800),
    'Christmas Eve Santa delivery OK?': ctx ? 'Checked by ' + ctx.name : 'Yes, Santa visit welcome!',
    'Consent given': 'Yes',
    'Flag': flag,
    'Kids data — do not edit': JSON.stringify(kids)
  });

  logAs_(ctx ? ctx.name : 'Sign-up page', 'New swing-by request: ' + id + ' (' + clean_(d.town, 40) + ')' +
    (inArea === 'Yes' ? '' : ' — outside ' + SERVICE_AREA_NAME));
  if (!ctx) alert_('Swing-by request: ' + id + (inArea === 'Yes' ? '' : ' (OUTSIDE service area)'),
    clean_(d.name) + ' in ' + clean_(d.town) + ' ' + zip + ' would love a Santa swing-by.\n' +
    'Requested by: ' + requestedBy + '\n' +
    'For: ' + kids.map(function (k) { return k.name + (k.age ? ' (' + k.age + ')' : ''); }).join(', ') + '\n' +
    (clean_(d.special) ? 'Notes: ' + clean_(d.special, 800) + '\n' : '') +
    '\nPlan it in Santa\'s Operations Hub (Routes tab): ' + HUB_URL);
  return { ok: true, requestNumber: id, inArea: inArea === 'Yes' };
}

// ---------- volunteers (public page) ----------
function addVolunteer_(d) {
  if (!clean_(d.name) || !(clean_(d.phone) || clean_(d.email)))
    return { ok: false, error: 'Please give your name and a phone or email.' };
  const roles = Array.isArray(d.roles) ? d.roles.map(function (r) { return clean_(r, 80); }) : [];

  append_(table_('Volunteers', VOLUNTEER_HEADERS), {
    'Submitted': new Date(),
    'Name': clean_(d.name),
    'Phone': text_(d.phone, 40),
    'Email': clean_(d.email),
    'City/Town': clean_(d.town),
    'Wants to help with': roles.join(', ') + (clean_(d.otherRole) ? ' (Other: ' + clean_(d.otherRole) + ')' : ''),
    'Availability': clean_(d.availability, 500),
    'Has a vehicle?': clean_(d.vehicle),
    'OK with background check?': clean_(d.background),
    'Notes / experience': clean_(d.notes, 1000),
    'Hub access': 'Pending',
    'ELF ID': newElfId_()
  });

  logAs_('Sign-up page', 'New volunteer waiting for approval: ' + clean_(d.name, 60));

  mail_(d.email, 'Thanks for signing up to be one of Santa\'s ELVES! 🧝',
    'Hi ' + firstName_(d.name) + '!\n\n' +
    'Thank you for signing up to help the Kilted Santa Project. You\'re going to be one of Santa\'s ELVES ' +
    '(Enthusiastic Loving Volunteers Empowering Santa)!\n\n' +
    'What happens next:\n' +
    '1. A Lead looks over your sign-up. This usually takes a day or two.\n' +
    '2. Once you\'re approved, you\'ll get a second email with your personal ELF code and the link to Santa\'s Operations Hub. ' +
    'That\'s where the crew picks up tasks, chats and keeps track of the families.\n' +
    '3. You\'ll sign in with this email address (or your phone number) plus your ELF code.\n\n' +
    'While you wait, take a peek at the ELF Guide to see how everything works and the ways you can help:\n' + GUIDE_URL + '\n\n' +
    'Thank you for helping make Christmas happen for families in ' + SERVICE_AREA_NAME + '!\n— The Kilted Santa Project');

  alert_('New volunteer: ' + clean_(d.name),
    clean_(d.name) + ' wants to help with: ' + roles.join(', ') + '\n' +
    'Phone: ' + clean_(d.phone) + '   Email: ' + clean_(d.email) + '\n\n' +
    'A Lead can approve them and send their ELF code in the hub (Crew tab): ' + HUB_URL);

  return { ok: true };
}

// =====================================================================
// SANTA'S OPERATIONS HUB
// =====================================================================
function hub_(d) {
  const auth = auth_(d);
  if (auth.error) return { ok: false, auth: false, error: auth.error };
  const ctx = ctx_(auth.me);
  const action = String(d.action || 'state');

  if (action === 'state' || action === 'login') {
    touch_(auth.me);
    return { ok: true, me: meOut_(ctx), state: state_(ctx) };
  }
  if (action === 'file') return file_(ctx, d);
  if (action === 'cheer_photo') return cheerPhoto_(d);
  if (action === 'map_locate') {
    const found = mapLocate_(ctx);
    return { ok: true, msg: '', me: meOut_(ctx), state: state_(ctx), located: found };
  }
  if (action === 'chat') return { ok: true, chat: chatFor_(ctx, d.since) };
  if (action === 'chat_send') {
    const sent = withLock_(function () { return once_(d.rid, function () { return chatSend_(ctx, d); }); });
    if (!sent.ok) return sent;
    return { ok: true, chat: chatFor_(ctx, d.since) };
  }

  const fn = HUB_ACTIONS[action];
  if (!fn) return { ok: false, error: 'Unknown action.' };
  const res = withLock_(function () { return once_(d.rid, function () { return fn(ctx, d) || {}; }); });
  if (res.ok === false) return res;
  SpreadsheetApp.flush();
  // Re-read the ELF in case they just changed their own team.
  const fresh = rows_(table_('Volunteers', VOLUNTEER_HEADERS)).filter(function (r) { return r._row === ctx.row; })[0];
  const now = fresh ? ctx_(fresh) : ctx;
  return { ok: true, msg: res.msg || '', extra: res.extra || null, me: meOut_(now), state: state_(now) };
}

function auth_(d) {
  const id = String(d.login || '').trim().toLowerCase();
  const code = normCode_(d.code);
  if (!id || !code) return { error: 'Please enter your email or phone and your ELF code.' };

  const cache = CacheService.getScriptCache();
  const key = 'fail_' + Utilities.base64EncodeWebSafe(id).slice(0, 200);
  const fails = Number(cache.get(key) || 0);
  if (fails >= 8) return { error: 'Too many tries. Please wait 15 minutes and try again.' };

  const digits = id.replace(/\D/g, '');
  const vol = table_('Volunteers', VOLUNTEER_HEADERS);
  const me = rows_(vol).filter(function (r) {
    const em = String(r['Email'] || '').trim().toLowerCase();
    const ph = String(r['Phone'] || '').replace(/\D/g, '');
    const idMatch = (em && em === id) || (digits.length >= 7 && ph.length >= 7 && ph.slice(-10) === digits.slice(-10));
    return idMatch && normCode_(r['ELF code']) === code;
  })[0];

  if (!me) {
    cache.put(key, String(fails + 1), 900);
    return { error: 'That email/phone and ELF code don\'t match. Check your code, or ask a Lead.' };
  }
  if (String(me['Hub access']) !== 'Approved')
    return { error: 'Your hub access is paused. Please check with a Lead.' };
  return { me: me };
}

function ctx_(me) {
  const role = HUB_ROLES.indexOf(String(me['Hub role'])) >= 0 ? String(me['Hub role']) : 'ELF';
  return {
    row: me._row,
    id: String(me['ELF ID'] || ''),
    name: String(me['Name'] || 'An ELF'),
    role: role,
    team: String(me['Santa team'] || '').trim(),
    isLead: role === 'Lead',
    isAdopt: role === 'Lead' || role === 'Adoption ELF'
  };
}

function meOut_(ctx) {
  return { name: ctx.name, role: ctx.role, team: ctx.team, isLead: ctx.isLead, isAdopt: ctx.isAdopt, row: ctx.row, id: ctx.id };
}

function touch_(me) {
  const last = me['Last seen'] instanceof Date ? me['Last seen'].getTime() : 0;
  if (Date.now() - last > 10 * 60 * 1000) {
    try { set_(table_('Volunteers', VOLUNTEER_HEADERS), me._row, { 'Last seen': new Date() }); } catch (e) {}
  }
}

function state_(ctx) {
  clearAutoHandled_();   // one-time fix; does nothing after the first run
  const plans = {};
  rows_(table_('Adopters', ADOPTER_HEADERS)).forEach(function (r) { plans[String(r['Family #'])] = r; });

  // The most recent thing anyone did for each family, from the activity log.
  const logRows = rows_(table_('Log', LOG_HEADERS));
  const lastByFam = {};
  logRows.forEach(function (r) {
    const what = String(r['What'] || ''), m = what.match(/Family (KS-\d+)/);
    if (m) lastByFam[m[1]] = { who: String(r['Who'] || ''), what: what.replace(/Family KS-\d+/, 'them'), when: iso_(r['When']) };
  });

  const families = rows_(table_('Families', FAMILY_HEADERS))
    .filter(function (r) { return r['Family #']; })
    .map(function (r) { return famOut_(r, ctx, plans, lastByFam); });

  const crew = rows_(table_('Volunteers', VOLUNTEER_HEADERS))
    .filter(function (r) { return r['Name'] && (ctx.isLead || r['Hub access'] === 'Approved'); })
    .map(function (r) { return crewOut_(r, ctx); });

  const tasks = rows_(table_('Tasks', TASK_HEADERS))
    .filter(function (r) { return r['Task ID']; })
    .map(taskOut_);

  const log = logRows.slice(-250).reverse().map(function (r) {
    return { when: iso_(r['When']), who: String(r['Who'] || ''), what: String(r['What'] || '') };
  });

  return {
    families: families, crew: crew, tasks: tasks, log: log, chat: chatFor_(ctx, ''), cheers: cheersFor_(ctx),
    sponsors: sponsorsFor_(ctx), sponsorKinds: SPONSOR_KINDS, sponsorStatuses: SPONSOR_STATUSES,
    randomRoute: RANDOM_ROUTE, statuses: STATUSES, giftSteps: GIFT_STEPS, roles: HUB_ROLES,
    areas: TASK_AREAS, publicUrl: PUBLIC_URL, serviceArea: SERVICE_AREA_NAME
  };
}

function famOut_(r, ctx, plans, lastByFam) {
  let kids = [];
  try { kids = JSON.parse(r['Kids data — do not edit'] || '[]'); } catch (e) {}
  // Older sign-ups kept first names only in the private column.
  const priv = String(r['Children (private: names + details)'] || '').split('\n');
  kids.forEach(function (k, i) {
    if (!k.name && priv[i]) {
      const m = priv[i].match(/^\d+\.\s*(.*?)\s+—/);
      if (m && m[1] !== '(no name)') k.name = m[1];
    }
  });

  const id = String(r['Family #']);
  const team = String(r['Santa team'] || '').trim();
  const plan = plans[id];
  const o = {
    id: id,
    status: String(r['Status'] || ''),
    submitted: iso_(r['Submitted']),
    town: String(r['City/Town'] || ''),
    inArea: String(r['In service area?'] || ''),
    kids: kids.map(function (k) {
      return { name: k.name || '', age: k.age || '', gender: k.gender || '', clothing: k.clothing || '',
               shoe: k.shoe || '', wishes: k.wishes || '', likes: k.likes || '' };
    }),
    household: String(r['Household wishes (public)'] || ''),
    note: String(r['Note to adopters (public)'] || ''),
    story: String(r['Hardship story (for posting)'] || ''),
    share: String(r['OK to post publicly?'] || ''),
    santaVisit: String(r['Christmas Eve Santa delivery OK?'] || ''),
    handledBy: String(r['Handled by'] || ''),
    last: (lastByFam || {})[id] || null,
    gift: String(r['Gift progress'] || 'Not started'),
    team: team,
    stop: r['Stop #'] === '' ? '' : String(r['Stop #']),
    teamNotes: String(r['Team notes'] || ''),
    adopter: String(r['Adopted by'] || ''),
    connection: String(r['Connection type'] || ''),
    giftPlan: plan ? String(plan['Gift plan'] || '') : '',
    hasPhoto: !!r['Family photo'],
    hasProof: !!r['Proof of residency (private)'],
    type: String(r['Request type'] || '') === 'Swing-by' ? 'Swing-by' : 'Adoption',
    private: false
  };
  const onMyRoute = team && ctx.team && team.toLowerCase() === ctx.team.toLowerCase();
  if (ctx.isAdopt || onMyRoute) {
    o.private = true;
    o.parent = String(r['Parent/Guardian name'] || '');
    o.phone = String(r['Phone'] || '');
    o.address = String(r['Street address'] || '');
    o.zip = String(r['ZIP'] || '');
    o.contactPref = String(r['Best way to reach'] || '');
    o.adults = String(r['Adults in home'] || '');
    o.privateNotes = String(r['Private notes for coordinator'] || '');
    o.requestedBy = String(r['Requested by'] || '');
    o.swingNotes = String(r['Swing-by notes'] || '');
    if (r['Lat'] !== '' && r['Lng'] !== '') { o.lat = Number(r['Lat']); o.lng = Number(r['Lng']); }
    o.mapMiss = !!r['Mapped address'] && r['Lat'] === '' && String(r['Mapped address']) === mapKey_(r);
  }
  if (ctx.isAdopt) {
    o.email = String(r['Email'] || '');
    o.adopterPhone = String(r['Adopter phone'] || '');
    o.adopterEmail = String(r['Adopter email'] || '');
    o.adopterNotes = plan ? String(plan['Notes'] || '') : '';
    o.flag = String(r['Flag'] || '');
    o.told = String(r['Family told'] || '');
    o.thread = threadOf_(r);
    o.contacted = String(r['Family contacted'] || '');
  }
  return o;
}

function crewOut_(r, ctx) {
  const o = {
    row: r._row,
    name: String(r['Name'] || ''),
    phone: String(r['Phone'] || ''),
    email: String(r['Email'] || ''),
    town: String(r['City/Town'] || ''),
    wants: String(r['Wants to help with'] || ''),
    availability: String(r['Availability'] || ''),
    vehicle: String(r['Has a vehicle?'] || ''),
    access: String(r['Hub access'] || 'Pending'),
    role: String(r['Hub role'] || 'ELF'),
    team: String(r['Santa team'] || ''),
    randomOk: String(r['Random deliveries OK?'] || '') === 'Yes',
    elfId: String(r['ELF ID'] || ''),
    lastSeen: iso_(r['Last seen']),
    me: r._row === ctx.row
  };
  if (ctx.isLead) {
    o.background = String(r['OK with background check?'] || '');
    o.notes = String(r['Notes / experience'] || '');
    o.code = String(r['ELF code'] || '');
    o.submitted = iso_(r['Submitted']);
  }
  return o;
}

function updatesOf_(r) {
  try { const u = JSON.parse(r['Updates'] || '[]'); return Array.isArray(u) ? u : []; } catch (e) { return []; }
}
function addUpdate_(r, ctx, text) {
  const u = updatesOf_(r);
  u.push({ who: ctx.name, when: new Date().toISOString(), text: text });
  return JSON.stringify(u.slice(-40));   // keep the 40 most recent
}
function taskOut_(r) {
  return {
    updates: updatesOf_(r),
    id: String(r['Task ID']), created: iso_(r['Created']), createdBy: String(r['Created by'] || ''),
    title: String(r['Title'] || ''), details: String(r['Details'] || ''), area: String(r['Area'] || 'Other'),
    family: String(r['Family #'] || ''), due: String(r['Due'] || ''), status: String(r['Status'] || 'Open'),
    claimedBy: String(r['Claimed by'] || ''), done: iso_(r['Done'])
  };
}

// ---------- map pins ----------
// Each stop's address is turned into a map pin once (Google's geocoder, built into Apps Script),
// then saved in the sheet. If the address changes, it gets looked up again.
function mapKey_(r) {
  return [r['Street address'], r['City/Town'], 'MI', r['ZIP']].map(function (x) { return String(x || '').trim(); }).join(', ');
}
function mapLocate_(ctx) {
  const t = table_('Families', FAMILY_HEADERS);
  const todo = rows_(t).filter(function (r) {
    if (!r['Family #'] || !String(r['Street address'] || '').trim()) return false;
    if (['Adopted', 'Available', 'Swing-by request', 'Delivered'].indexOf(String(r['Status'])) < 0) return false;
    const team = String(r['Santa team'] || '').trim().toLowerCase();
    if (!ctx.isAdopt && !(team && ctx.team && team === ctx.team.toLowerCase())) return false;
    return String(r['Mapped address'] || '') !== mapKey_(r);
  }).slice(0, 25);
  if (!todo.length) return 0;
  const geo = Maps.newGeocoder().setRegion('us').setBounds(41.9, -84.95, 42.6, -83.9);
  let found = 0;
  todo.forEach(function (r) {
    const key = mapKey_(r);
    let lat = '', lng = '';
    try {
      const res = geo.geocode(key);
      const hit = res && res.status === 'OK' && res.results && res.results[0];
      if (hit) { lat = hit.geometry.location.lat; lng = hit.geometry.location.lng; found++; }
    } catch (e) { console.error(e); return; }   // try again next time
    set_(t, r._row, { 'Lat': lat, 'Lng': lng, 'Mapped address': key });
  });
  return found;
}

// Run this once from the editor (select it, press Run) to make sure map lookups work.
function checkMap() {
  const res = Maps.newGeocoder().setRegion('us').geocode('Jackson, MI');
  Logger.log(res.status + ' ' + JSON.stringify(res.results[0].geometry.location));
}

// The thank-you board as the crew sees it. Dollar values are for Adoption ELVES and Leads only.
function sponsorsFor_(ctx) {
  return rows_(table_('Sponsors', SPONSOR_HEADERS)).filter(function (r) { return r['ID']; }).map(function (r) {
    const o = { id: String(r['ID']), added: iso_(r['Added']), addedBy: String(r['Added by'] || ''), name: String(r['Name'] || ''),
      kind: String(r['Kind'] || ''), gave: String(r['What they gave'] || ''), dropoff: r['Drop-off spot'] === 'Yes',
      address: String(r['Address'] || ''), website: String(r['Website'] || ''), contact: String(r['Contact person'] || ''),
      phone: String(r['Phone'] || ''), email: String(r['Email'] || ''), isPublic: r['OK to list publicly'] === 'Yes',
      note: String(r['Thank-you note'] || ''), status: String(r['Status'] || ''), thanked: iso_(r['Thanked']),
      privateNotes: String(r['Private notes'] || '') };
    if (ctx.isAdopt) o.value = String(r['Value'] || '');
    return o;
  });
}
// What the public sign-up page shows: only entries they said OK to list. No contacts, notes or amounts.
function publicSponsors_() {
  try {
    return rows_(table_('Sponsors', SPONSOR_HEADERS)).filter(function (r) {
      return r['ID'] && r['OK to list publicly'] === 'Yes' && ['Said yes', 'Received', 'Thanked'].indexOf(String(r['Status'])) >= 0;
    }).map(function (r) {
      const drop = r['Drop-off spot'] === 'Yes';
      return { name: String(r['Name']), kind: String(r['Kind'] || ''), gave: String(r['What they gave'] || ''),
        note: String(r['Thank-you note'] || ''), website: String(r['Website'] || ''), dropoff: drop,
        address: drop ? String(r['Address'] || '') : '' };
    });
  } catch (e) { console.error(e); return []; }
}

function cheersFor_(ctx) {
  return rows_(table_('Cheers', CHEER_HEADERS)).filter(function (r) { return r['ID']; }).slice(-100).reverse().map(function (r) {
    let rx = {}; try { rx = JSON.parse(r['Reactions'] || '{}'); } catch (e) {}
    const counts = {}, mine = [];
    Object.keys(rx).forEach(function (k) { counts[k] = rx[k].length; if (rx[k].indexOf(ctx.id) >= 0) mine.push(k); });
    return { id: String(r['ID']), when: iso_(r['When']), who: String(r['Who'] || ''), whoId: String(r['ELF ID'] || ''),
             text: String(r['Text'] || ''), shout: String(r['Shout-out to'] || ''), photo: !!r['Photo file ID'],
             counts: counts, mine: mine };
  });
}

// Cheer photos load one at a time, only for signed-in ELVES (the hub checks the code first).
function cheerPhoto_(d) {
  const r = rows_(table_('Cheers', CHEER_HEADERS)).filter(function (x) { return String(x['ID']) === String(d.id); })[0];
  if (!r || !r['Photo file ID']) return { ok: false, error: 'Photo not found.' };
  const blob = DriveApp.getFileById(String(r['Photo file ID'])).getBlob();
  return { ok: true, type: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}

// Private photo / proof viewer for Adoption ELVES and Leads. Files stay in Drive.
function file_(ctx, d) {
  if (!ctx.isAdopt) return { ok: false, error: 'Only Adoption ELVES and Leads can view family documents.' };
  const fam = table_('Families', FAMILY_HEADERS);
  const r = findFamily_(fam, d.familyId);
  if (!r) return { ok: false, error: 'Family not found.' };
  const url = String(d.which === 'photo' ? r['Family photo'] : r['Proof of residency (private)']);
  const m = url.match(/\/d\/([\w-]+)/);
  if (!m) return { ok: false, error: 'No file on record.' };
  const blob = DriveApp.getFileById(m[1]).getBlob();
  logAs_(ctx.name, 'viewed the ' + (d.which === 'photo' ? 'family photo' : 'proof of residency') + ' for Family ' + r['Family #']);
  return { ok: true, type: blob.getContentType(), name: blob.getName(), data: Utilities.base64Encode(blob.getBytes()) };
}

// ---------- hub actions (each runs inside the lock) ----------
const HUB_ACTIONS = {
  // Tasks: anyone can post, claim, finish.
  task_create: function (ctx, d) {
    const title = clean_(d.title, 120);
    if (!title) return err_('Give the task a short title.');
    const area = TASK_AREAS.indexOf(d.area) >= 0 ? d.area : 'Other';
    const props = PropertiesService.getScriptProperties();
    const n = Number(props.getProperty('nextTask') || 1);
    props.setProperty('nextTask', String(n + 1));
    append_(table_('Tasks', TASK_HEADERS), {
      'Task ID': 'T' + n, 'Created': new Date(), 'Created by': ctx.name, 'Title': title,
      'Details': clean_(d.details, 1000), 'Area': area, 'Family #': clean_(d.familyId, 12),
      'Due': clean_(d.due, 40), 'Status': 'Open'
    });
    log_(ctx, 'posted a task: “' + title + '”');
    return { msg: 'Task posted!' };
  },
  task_claim: function (ctx, d) {
    const t = taskRow_(d.taskId); if (!t) return err_('That task is gone.');
    if (t.r['Status'] === 'Done') return err_('That one is already done!');
    if (t.r['Claimed by'] && t.r['Claimed by'] !== ctx.name) return err_(t.r['Claimed by'] + ' already has that one.');
    set_(t.t, t.r._row, { 'Status': 'Claimed', 'Claimed by': ctx.name });
    log_(ctx, 'is on it: “' + t.r['Title'] + '”');
    return { msg: 'It\'s yours. Thank you!' };
  },
  task_unclaim: function (ctx, d) {
    const t = taskRow_(d.taskId); if (!t) return err_('That task is gone.');
    if (t.r['Claimed by'] !== ctx.name && !ctx.isLead) return err_('Only ' + t.r['Claimed by'] + ' or a Lead can let this one go.');
    set_(t.t, t.r._row, { 'Status': 'Open', 'Claimed by': '' });
    log_(ctx, 'put back “' + t.r['Title'] + '” for someone else');
    return { msg: 'Back on the board.' };
  },
  task_done: function (ctx, d) {
    const t = taskRow_(d.taskId); if (!t) return err_('That task is gone.');
    const note = clean_(d.note, 500);
    const fields = { 'Status': 'Done', 'Claimed by': t.r['Claimed by'] || ctx.name, 'Done': new Date() };
    if (note) fields['Updates'] = addUpdate_(t.r, ctx, '✅ ' + note);
    set_(t.t, t.r._row, fields);
    log_(ctx, 'finished “' + t.r['Title'] + '” ✅');
    return { msg: 'Done! Nice work.' };
  },
  // Anyone on the crew can post a progress update on a task ("Called Kroger, they're in!").
  task_note: function (ctx, d) {
    const t = taskRow_(d.taskId); if (!t) return err_('That task is gone.');
    const note = clean_(d.note, 500); if (!note) return err_('Write an update first.');
    set_(t.t, t.r._row, { 'Updates': addUpdate_(t.r, ctx, note) });
    log_(ctx, 'posted an update on “' + t.r['Title'] + '” 📝');
    return { msg: 'Update posted.' };
  },
  task_reopen: function (ctx, d) {
    const t = taskRow_(d.taskId); if (!t) return err_('That task is gone.');
    set_(t.t, t.r._row, { 'Status': 'Open', 'Claimed by': '', 'Done': '' });
    log_(ctx, 'reopened “' + t.r['Title'] + '”');
    return { msg: 'Reopened.' };
  },
  task_delete: function (ctx, d) {
    const t = taskRow_(d.taskId); if (!t) return err_('That task is gone.');
    if (t.r['Created by'] !== ctx.name && !ctx.isLead) return err_('Only the person who posted it or a Lead can delete it.');
    t.t.sh.deleteRow(t.r._row);
    log_(ctx, 'removed the task “' + t.r['Title'] + '”');
    return { msg: 'Removed.' };
  },

  // Families: everyone can move gifts along and leave notes.
  fam_gift: function (ctx, d) {
    const f = famRow_(d.familyId); if (!f) return err_('Family not found.');
    if (GIFT_STEPS.indexOf(d.step) < 0) return err_('Unknown step.');
    const upd = { 'Gift progress': d.step };
    if (d.step === 'Delivered') upd['Status'] = 'Delivered';
    set_(f.t, f.r._row, upd);
    log_(ctx, 'moved Family ' + f.r['Family #'] + ' gifts to “' + d.step + '”');
    return { msg: 'Updated.' };
  },
  fam_note: function (ctx, d) {
    const f = famRow_(d.familyId); if (!f) return err_('Family not found.');
    const note = clean_(d.note, 500); if (!note) return err_('Write a note first.');
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d');
    const prev = String(f.r['Team notes'] || '');
    const next = (prev ? prev + '\n' : '') + stamp + ' · ' + ctx.name + ': ' + note;
    set_(f.t, f.r._row, { 'Team notes': next.slice(-4000) });
    log_(ctx, 'left a note on Family ' + f.r['Family #']);
    return { msg: 'Note added.' };
  },

  // Adoption desk: Adoption ELVES and Leads.
  fam_take: function (ctx, d) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can do that.');
    const f = famRow_(d.familyId); if (!f) return err_('Family not found.');
    const mine = f.r['Handled by'] === ctx.name;
    set_(f.t, f.r._row, { 'Handled by': mine ? '' : ctx.name });
    log_(ctx, mine ? 'handed off Family ' + f.r['Family #'] : 'is handling Family ' + f.r['Family #']);
    return { msg: mine ? 'Handed off.' : 'You\'re handling this family.' };
  },
  fam_approve: function (ctx, d) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can approve families.');
    const f = famRow_(d.familyId); if (!f) return err_('Family not found.');
    if (f.r['Status'] !== 'Pending review') return err_('This family is already ' + f.r['Status'] + '.');
    set_(f.t, f.r._row, { 'Status': 'Available' });
    log_(ctx, 'checked and approved Family ' + f.r['Family #'] + ', now open for adoption 🎄');
    return { msg: 'Approved! They now show on the Adopt page.' };
  },
  fam_status: function (ctx, d) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can change status.');
    const f = famRow_(d.familyId); if (!f) return err_('Family not found.');
    if (STATUSES.indexOf(d.status) < 0) return err_('Unknown status.');
    const upd = { 'Status': d.status };
    if (d.status === 'Delivered') upd['Gift progress'] = 'Delivered';
    set_(f.t, f.r._row, upd);
    log_(ctx, 'set Family ' + f.r['Family #'] + ' to “' + d.status + '”');
    return { msg: 'Status updated.' };
  },
  fam_adopter: function (ctx, d) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can record adopters.');
    const f = famRow_(d.familyId); if (!f) return err_('Family not found.');
    if (!clean_(d.name) || !(clean_(d.phone) || clean_(d.email))) return err_('Add the adopter\'s name and a phone or email.');
    set_(f.t, f.r._row, {
      'Status': 'Adopted', 'Adopted by': clean_(d.name), 'Adopter phone': text_(d.phone, 40),
      'Adopter email': clean_(d.email), 'Connection type': clean_(d.connection) || 'Through a Kilted Santa volunteer'
    });
    append_(table_('Adopters', ADOPTER_HEADERS), {
      'Submitted': new Date(), 'Family #': String(f.r['Family #']), 'Name': clean_(d.name),
      'Phone': text_(d.phone, 40), 'Email': clean_(d.email),
      'Connection': clean_(d.connection) || 'Through a Kilted Santa volunteer',
      'Gift plan': clean_(d.giftPlan) || 'Not sure yet', 'Notes': 'Recorded in the hub by ' + ctx.name
    });
    log_(ctx, 'matched Family ' + f.r['Family #'] + ' with ' + clean_(d.name, 60) + ' 🎁');
    sendWishList_(f.r, clean_(d.name, 60), clean_(d.email));
    const told = tellFamilyAdopted_(f.t, f.r, ctx.name);
    adopterTask_(String(f.r['Family #']), clean_(d.name, 60), clean_(d.connection), ctx.name);
    return { msg: told ? 'Adopter recorded, and the family got an email with the good news.' : 'Adopter recorded. The family has no email, so a call/text task was added.' };
  },
  // Reply to an adopter from the hub; it's emailed to them with a link to write back.
  fam_reply: function (ctx, d) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can message adopters.');
    const f = famRow_(d.familyId); if (!f) return err_('Family not found.');
    const text = clean_(d.text, 1500); if (!text) return err_('Write your reply first.');
    const id = String(f.r['Family #']);
    const sent = mail_(f.r['Adopter email'], 'A note from the Kilted Santa crew about Family ' + id + ' 🎁',
      'Hi ' + firstName_(f.r['Adopted by']) + '!\n\n' + text + '\n\n— ' + firstName_(ctx.name) + ', one of Santa\'s ELVES\n\n' +
      'To write back, use this link (enter ' + id + ' and this email address):\n' + PUBLIC_URL + '#mylist\n' +
      'That way your message goes straight to the whole crew.');
    set_(f.t, f.r._row, { 'Adopter messages': addToThread_(f.r, 'crew', ctx.name, text) });
    const tt = table_('Tasks', TASK_HEADERS);
    rows_(tt).forEach(function (t) {
      if (String(t['Family #']) === id && t['Status'] !== 'Done' && /^(💬|🤝) /.test(String(t['Title'])))
        set_(tt, t._row, { 'Status': 'Done', 'Claimed by': t['Claimed by'] || ctx.name, 'Done': new Date() });
    });
    log_(ctx, 'replied to the adopter of Family ' + id + ' ✉️');
    return { msg: sent ? 'Reply emailed to the adopter.' : 'Saved, but they have no email on file. Give them a call or text: ' + (f.r['Adopter phone'] || '') };
  },
  // A Lead writes one message to every current adopter (an apology, a drop-off reminder).
  // Each person gets one email naming all of their families. send:false only previews.
  adopters_broadcast: function (ctx, d) {
    if (!ctx.isLead) return err_('Only Leads can message every adopter at once.');
    const text = clean_(d.text, 3000), subject = clean_(d.subject, 150);
    if (d.send && (!text || !subject)) return err_('Add a subject and a message.');
    const fam = table_('Families', FAMILY_HEADERS);
    const groups = {};
    rows_(fam).forEach(function (r) {
      if (String(r['Status']) !== 'Adopted' || !r['Adopted by']) return;
      const key = String(r['Adopter email'] || '').trim().toLowerCase() || ('phone:' + String(r['Adopter phone'] || '').replace(/\D/g, '')) || ('name:' + r['Adopted by']);
      (groups[key] = groups[key] || { name: String(r['Adopted by']), email: String(r['Adopter email'] || '').trim(), phone: String(r['Adopter phone'] || ''), rows: [] }).rows.push(r);
    });
    const list = Object.keys(groups).map(function (k) { return groups[k]; });
    const out = list.map(function (g) { return { name: g.name, families: g.rows.map(function (r) { return String(r['Family #']); }), email: !!g.email, phone: g.phone }; });
    if (!d.send) return { msg: '', extra: { recipients: out } };
    let sent = 0;
    list.forEach(function (g) {
      const ids = g.rows.map(function (r) { return String(r['Family #']); });
      const famText = (ids.length === 1 ? 'Family ' : 'Families ') + (ids.length < 3 ? ids.join(' and ') : ids.slice(0, -1).join(', ') + ' and ' + ids[ids.length - 1]);
      const body = 'Hi ' + greetName_(g.name) + '!\n\n' + text.replace(/\{families\}/g, famText) + '\n\n' +
        'Reach the whole crew anytime (questions, sizes, drop-off), and see your wish list:\n' + PUBLIC_URL + '#mylist\n' +
        'Enter ' + (ids.length === 1 ? 'your family number (' + ids[0] + ')' : 'one of your family numbers (' + ids.join(', ') + ')') + ' and this email address.';
      if (mail_(g.email, subject, body)) sent++;
      g.rows.forEach(function (r) { set_(fam, r._row, { 'Adopter messages': addToThread_(r, 'crew', ctx.name, '📣 (sent to all adopters) ' + subject + '\n\n' + text.replace(/\{families\}/g, famText)) }); });
    });
    log_(ctx, 'emailed all ' + sent + ' adopters: “' + subject + '” 📣');
    const noEmail = out.filter(function (x) { return !x.email; });
    return { msg: 'Sent to ' + sent + ' adopter' + (sent === 1 ? '' : 's') + '.' + (noEmail.length ? ' ' + noEmail.length + ' have no email, so give them a call.' : '') };
  },
  // One tap: a "say hi" task for every adopted family that doesn't have one yet.
  adopter_tasks: function (ctx) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can do that.');
    let n = 0;
    rows_(table_('Families', FAMILY_HEADERS)).forEach(function (r) {
      if (String(r['Status']) === 'Adopted' && r['Adopted by'] &&
          adopterTask_(String(r['Family #']), String(r['Adopted by']), String(r['Connection type'] || ''), ctx.name)) n++;
    });
    if (n) log_(ctx, 'added ' + n + ' adopter check-in tasks 🤝');
    return { msg: n ? n + ' check-in task' + (n === 1 ? '' : 's') + ' added to the board.' : 'Every adopter already has one.' };
  },
  // Send the "you've been adopted" news (one family, or a list of them at once).
  fam_tell: function (ctx, d) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can do that.');
    const ids = (Array.isArray(d.familyIds) ? d.familyIds : [d.familyId]).slice(0, 100).map(String);
    let emailed = 0, calls = 0;
    ids.forEach(function (id) {
      const f = famRow_(id);
      if (!f || ['Adopted', 'Delivered'].indexOf(String(f.r['Status'])) < 0) return;
      if (tellFamilyAdopted_(f.t, f.r, ctx.name)) emailed++; else calls++;
    });
    if (!emailed && !calls) return err_(ids.length === 1 ? 'This family isn\'t adopted yet.' : 'None of those families are adopted.');
    if (ids.length === 1) return { msg: emailed ? 'The family got an email with the good news.' : 'They have no email, so a call/text task was added.' };
    return { msg: emailed + ' famil' + (emailed === 1 ? 'y' : 'ies') + ' emailed' + (calls ? ', ' + calls + ' call/text task' + (calls === 1 ? '' : 's') + ' added' : '') + '.' };
  },
  fam_contacted: function (ctx, d) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can do that.');
    const f = famRow_(d.familyId); if (!f) return err_('Family not found.');
    const undo = d.undo === true;
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d');
    set_(f.t, f.r._row, { 'Family contacted': undo ? '' : 'Yes · ' + ctx.name + ' · ' + stamp });
    if (!undo) closeContactTasks_(String(f.r['Family #']), ctx.name);
    log_(ctx, undo ? 'un-marked Family ' + f.r['Family #'] + ' as contacted' : 'touched base with Family ' + f.r['Family #'] + ' 📞');
    return { msg: undo ? 'Marked not contacted.' : 'Got it, family contacted.' };
  },
  fam_sendlist: function (ctx, d) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can do that.');
    const f = famRow_(d.familyId); if (!f) return err_('Family not found.');
    const to = String(f.r['Adopter email'] || '').trim();
    if (!to) return err_('This adopter didn\'t leave an email. Text them the link instead: ' + PUBLIC_URL + '#mylist');
    if (!sendWishList_(f.r, String(f.r['Adopted by'] || ''), to)) return err_('The email didn\'t send. Please try again.');
    log_(ctx, 'emailed Family ' + f.r['Family #'] + '\'s wish list to their adopter');
    return { msg: 'Wish list emailed to ' + to + '.' };
  },
  fam_release: function (ctx, d) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can release an adoption.');
    const f = famRow_(d.familyId); if (!f) return err_('Family not found.');
    set_(f.t, f.r._row, { 'Status': 'Available', 'Adopted by': '', 'Adopter phone': '', 'Adopter email': '', 'Connection type': '', 'Family told': '', 'Family contacted': '' });
    log_(ctx, 'released Family ' + f.r['Family #'] + ' back to the Adopt page');
    return { msg: 'Family is back on the Adopt page.' };
  },

  // Routes
  fam_route: function (ctx, d) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can plan routes.');
    const f = famRow_(d.familyId); if (!f) return err_('Family not found.');
    const team = clean_(d.team, 40);
    const stop = String(d.stop || '').replace(/\D/g, '').slice(0, 3);
    set_(f.t, f.r._row, { 'Santa team': team, 'Stop #': stop });
    log_(ctx, team ? 'put Family ' + f.r['Family #'] + ' on ' + team + (stop ? ' (stop ' + stop + ')' : '') : 'took Family ' + f.r['Family #'] + ' off its route');
    // Families nobody adopted are "random deliveries": only Santas who said yes should get them.
    const adopted = ['Adopted', 'Delivered'].indexOf(String(f.r['Status'])) >= 0;
    if (team && !adopted && team.toLowerCase() !== RANDOM_ROUTE.toLowerCase()) {
      const willing = rows_(table_('Volunteers', VOLUNTEER_HEADERS)).some(function (c) {
        return c['Hub access'] === 'Approved' && String(c['Santa team'] || '').trim().toLowerCase() === team.toLowerCase() &&
          c['Random deliveries OK?'] === 'Yes';
      });
      if (!willing) return { msg: 'Saved. Heads up: Family ' + f.r['Family #'] + ' isn\'t adopted, and nobody on ' + team + ' has said they\'re OK with random deliveries.' };
    }
    return { msg: 'Route updated.' };
  },
  fam_delivered: function (ctx, d) {
    const f = famRow_(d.familyId); if (!f) return err_('Family not found.');
    const team = String(f.r['Santa team'] || '').trim().toLowerCase();
    if (!ctx.isAdopt && !(ctx.team && ctx.team.toLowerCase() === team)) return err_('Only that Santa team or a Lead can mark this delivered.');
    const undo = d.undo === true;
    const swing = String(f.r['Request type']) === 'Swing-by';
    const label = (swing ? 'swing-by ' : 'Family ') + f.r['Family #'];
    const wasAdopted = !!String(f.r['Adopted by'] || '');
    set_(f.t, f.r._row, undo
      ? { 'Status': swing ? 'Swing-by request' : (wasAdopted ? 'Adopted' : 'Available'), 'Gift progress': swing ? '' : 'Loaded' }
      : { 'Status': 'Delivered', 'Gift progress': swing ? '' : 'Delivered' });
    log_(ctx, undo ? 'un-marked ' + label + ' as done' : (swing ? 'swung by ' + label + '! 🎅' : 'delivered Christmas to ' + label + '! 🎅'));
    return { msg: undo ? 'Marked not done.' : 'Ho ho ho! Done.' };
  },

  // Swing-bys that came in through Facebook, a call, or someone Santa remembers.
  swing_add: function (ctx, d) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can add swing-bys.');
    const r = addSwingBy_(d, ctx);
    if (!r.ok) return r;
    return { msg: 'Swing-by ' + r.requestNumber + ' added.' + (r.inArea ? '' : ' Heads up: that ZIP is outside ' + SERVICE_AREA_NAME + '.') };
  },

  // Remove a family or swing-by that doesn't add up. Kept in the Removed tab; ID/bill photos go to the trash.
  fam_remove: function (ctx, d) {
    if (!ctx.isAdopt) return err_('Only Adoption ELVES and Leads can remove families.');
    const f = famRow_(d.familyId); if (!f) return err_('Family not found. It may already be removed.');
    const reason = clean_(d.reason, 300);
    if (!reason) return err_('Please give a reason, so the crew knows why.');
    ['Family photo', 'Proof of residency (private)'].forEach(function (k) {
      const m = String(f.r[k] || '').match(/\/d\/([\w-]+)/);
      if (m) { try { DriveApp.getFileById(m[1]).setTrashed(true); } catch (e) {} }
    });
    const swing = String(f.r['Request type']) === 'Swing-by';
    archive_(ctx, swing ? 'Swing-by' : 'Family', String(f.r['Family #']), f.r['Parent/Guardian name'], f.r['Phone'],
      [f.r['Street address'], f.r['City/Town'], f.r['ZIP']].filter(String).join(', '), reason, f.r);
    f.t.sh.deleteRow(f.r._row);
    log_(ctx, 'removed ' + (swing ? 'swing-by ' : 'Family ') + f.r['Family #'] + ' (' + reason + ')');
    return { msg: (swing ? 'Swing-by ' : 'Family ') + f.r['Family #'] + ' removed.' };
  },

  // Crew: Leads approve volunteers, set roles and teams, send codes.
  crew_approve: function (ctx, d) {
    if (!ctx.isLead) return err_('Only Leads can approve ELVES.');
    const c = crewRow_(d.row, d.name); if (!c) return err_('Could not find that volunteer. Refresh and try again.');
    const role = HUB_ROLES.indexOf(d.role) >= 0 ? d.role : 'ELF';
    const code = c.r['ELF code'] || newCode_();
    set_(c.t, c.r._row, { 'Hub access': 'Approved', 'Hub role': role, 'ELF code': code, 'Santa team': clean_(d.team, 40), 'ELF ID': c.r['ELF ID'] || newElfId_() });
    const sent = sendCode_(c.r['Name'], c.r['Email'], code);
    log_(ctx, 'welcomed ' + c.r['Name'] + ' as ' + (role === 'ELF' ? 'an ELF' : role === 'Adoption ELF' ? 'an Adoption ELF' : 'a ' + role) + ' 🧝');
    return { msg: sent ? 'Approved, and their ELF code was emailed.' : 'Approved! They have no email, so text them their code.',
             extra: { code: code, name: String(c.r['Name']), phone: String(c.r['Phone'] || ''), emailed: sent } };
  },
  crew_update: function (ctx, d) {
    const c = crewRow_(d.row, d.name); if (!c) return err_('Could not find that ELF. Refresh and try again.');
    const self = c.r._row === ctx.row;
    const upd = {};
    if (d.team !== undefined && (ctx.isLead || self)) upd['Santa team'] = clean_(d.team, 40);
    if (d.randomOk !== undefined && (ctx.isLead || self)) upd['Random deliveries OK?'] = d.randomOk ? 'Yes' : 'No';
    if (ctx.isLead) {
      if (d.role !== undefined && HUB_ROLES.indexOf(d.role) >= 0) upd['Hub role'] = d.role;
      if (d.access !== undefined && HUB_ACCESS.indexOf(d.access) >= 0) {
        if (self && d.access !== 'Approved') return err_('You can\'t pause yourself.');
        upd['Hub access'] = d.access;
      }
    }
    if (!Object.keys(upd).length) return err_('Nothing to change.');
    set_(c.t, c.r._row, upd);
    log_(ctx, 'updated ' + c.r['Name'] + (upd['Santa team'] !== undefined ? ' (team: ' + (upd['Santa team'] || 'none') + ')' : '') +
      (upd['Random deliveries OK?'] ? (upd['Random deliveries OK?'] === 'Yes' ? ' (OK with random deliveries)' : ' (adopted families only)') : '') +
      (upd['Hub role'] ? ' (role: ' + upd['Hub role'] + ')' : '') + (upd['Hub access'] ? ' (access: ' + upd['Hub access'] + ')' : ''));
    return { msg: 'Saved.' };
  },
  crew_remove: function (ctx, d) {
    if (!ctx.isLead) return err_('Only Leads can remove ELVES.');
    const c = crewRow_(d.row, d.name); if (!c) return err_('Could not find that person. Refresh and try again.');
    if (c.r._row === ctx.row) return err_('You can\'t remove yourself.');
    const reason = clean_(d.reason, 300);
    if (!reason) return err_('Please give a reason.');
    if (c.r['Hub role'] === 'Lead' && c.r['Hub access'] === 'Approved') {
      const leads = rows_(c.t).filter(function (r) { return r['Hub role'] === 'Lead' && r['Hub access'] === 'Approved'; });
      if (leads.length < 2) return err_('The hub needs at least one Lead.');
    }
    const pending = String(c.r['Hub access']) !== 'Approved';
    archive_(ctx, 'Volunteer', String(c.r['ELF ID'] || ''), c.r['Name'], c.r['Phone'], c.r['City/Town'], reason, c.r);
    c.t.sh.deleteRow(c.r._row);
    log_(ctx, pending ? 'declined ' + c.r['Name'] + '\'s volunteer application' : 'removed ' + c.r['Name'] + ' from the crew');
    return { msg: pending ? 'Application declined.' : c.r['Name'] + ' was removed from the crew.' };
  },
  // ---------- Thank-you board: businesses, sponsors and everyone who pitched in ----------
  // Any ELF can add one; whoever added it, Adoption ELVES and Leads can edit; Leads can remove.
  sponsor_save: function (ctx, d) {
    const name = clean_(d.name, 100); if (!name) return err_('Add the business or sponsor name.');
    const t = table_('Sponsors', SPONSOR_HEADERS);
    const fields = {
      'Name': name,
      'Kind': SPONSOR_KINDS.indexOf(d.kind) >= 0 ? d.kind : SPONSOR_KINDS[0],
      'What they gave': clean_(d.gave, 300),
      'Value': clean_(d.value, 60),
      'Drop-off spot': d.dropoff ? 'Yes' : '',
      'Address': clean_(d.address, 160),
      // (sent as "site": "website" is the spam-trap field name)
      'Website': /^https?:\/\//i.test(String(d.site || '').trim()) ? clean_(d.site, 300) : (d.site ? clean_('https://' + String(d.site).trim(), 300) : ''),
      'Contact person': clean_(d.contact, 80),
      'Phone': text_(clean_(d.phone, 30)),
      'Email': clean_(d.email, 120),
      'OK to list publicly': d.isPublic ? 'Yes' : '',
      'Thank-you note': clean_(d.note, 400),
      'Status': SPONSOR_STATUSES.indexOf(d.status) >= 0 ? d.status : 'Said yes',
      'Private notes': clean_(d.privateNotes, 600)
    };
    if (d.id) {
      const r = rows_(t).filter(function (x) { return String(x['ID']) === String(d.id); })[0];
      if (!r) return err_('That entry is gone.');
      if (!ctx.isAdopt && String(r['Added by']) !== ctx.name) return err_('Ask an Adoption ELF or Lead to edit this one.');
      if (fields['Status'] === 'Thanked' && !r['Thanked']) fields['Thanked'] = new Date();
      set_(t, r._row, fields);
      log_(ctx, 'updated ' + name + ' on the thank-you board');
      return { msg: 'Saved.' };
    }
    const props = PropertiesService.getScriptProperties();
    const n = Number(props.getProperty('nextSponsor') || 1);
    props.setProperty('nextSponsor', String(n + 1));
    if (fields['Status'] === 'Thanked') fields['Thanked'] = new Date();
    append_(t, Object.assign({ 'ID': 'B' + n, 'Added': new Date(), 'Added by': ctx.name }, fields));
    log_(ctx, 'added ' + name + ' to the thank-you board 💚');
    return { msg: 'Added! 💚' };
  },
  sponsor_thanked: function (ctx, d) {
    const t = table_('Sponsors', SPONSOR_HEADERS);
    const r = rows_(t).filter(function (x) { return String(x['ID']) === String(d.id); })[0];
    if (!r) return err_('That entry is gone.');
    set_(t, r._row, { 'Status': 'Thanked', 'Thanked': new Date() });
    log_(ctx, 'thanked ' + r['Name'] + ' 💚');
    return { msg: 'Marked thanked. 💚' };
  },
  sponsor_delete: function (ctx, d) {
    if (!ctx.isLead) return err_('Only Leads can remove entries.');
    const t = table_('Sponsors', SPONSOR_HEADERS);
    const r = rows_(t).filter(function (x) { return String(x['ID']) === String(d.id); })[0];
    if (!r) return { msg: 'Already gone.' };
    t.sh.deleteRow(r._row);
    return { msg: 'Removed.' };
  },
  // ---------- Cheers: photos, shout-outs and good news, for ELVES only ----------
  cheer_post: function (ctx, d) {
    const text = clean_(d.text, 600);
    const hasPhoto = d.photo && d.photo.data;
    if (!text && !hasPhoto) return err_('Write a cheer or add a photo first.');
    if (hasPhoto && d.photoOk !== true) return err_('Please check the box confirming no families we serve are in the photo.');
    let shout = '';
    if (d.shout) {
      const c = rows_(table_('Volunteers', VOLUNTEER_HEADERS)).filter(function (r) { return String(r['ELF ID']) === String(d.shout) && r['Hub access'] === 'Approved'; })[0];
      if (c) shout = String(c['Name']);
    }
    const props = PropertiesService.getScriptProperties();
    const n = Number(props.getProperty('nextCheer') || 1);
    props.setProperty('nextCheer', String(n + 1));
    let fileId = '';
    if (hasPhoto) {
      const type = String(d.photo.type || '').toLowerCase();
      if (['image/jpeg', 'image/png', 'image/webp'].indexOf(type) < 0) return err_('Photos need to be JPG or PNG.');
      if (String(d.photo.data).length * 0.75 > 3 * 1024 * 1024) return err_('That photo is too big. Try a smaller one.');
      const url = saveUpload_(d.photo, folder_('cheers'), 'C' + n + ' — ' + ctx.name);
      fileId = (url.match(/\/d\/([\w-]+)/) || [])[1] || '';
    }
    append_(table_('Cheers', CHEER_HEADERS), { 'ID': 'C' + n, 'When': new Date(), 'Who': ctx.name, 'ELF ID': ctx.id,
      'Text': text, 'Shout-out to': shout, 'Photo file ID': fileId, 'Reactions': '{}' });
    log_(ctx, shout ? 'gave ' + shout + ' a shout-out 🎉' : (fileId ? 'shared a photo on the Cheers wall 📸' : 'posted on the Cheers wall 🎉'));
    return { msg: 'Posted! 🎉' };
  },
  cheer_react: function (ctx, d) {
    if (CHEER_EMOJI.indexOf(d.emoji) < 0) return err_('Unknown reaction.');
    const t = table_('Cheers', CHEER_HEADERS);
    const r = rows_(t).filter(function (x) { return String(x['ID']) === String(d.id); })[0];
    if (!r) return err_('That post is gone.');
    let rx = {}; try { rx = JSON.parse(r['Reactions'] || '{}'); } catch (e) {}
    const list = rx[d.emoji] || [];
    const i = list.indexOf(ctx.id);
    if (i >= 0) list.splice(i, 1); else list.push(ctx.id);
    if (list.length) rx[d.emoji] = list; else delete rx[d.emoji];
    set_(t, r._row, { 'Reactions': JSON.stringify(rx) });
    return {};
  },
  cheer_delete: function (ctx, d) {
    const t = table_('Cheers', CHEER_HEADERS);
    const r = rows_(t).filter(function (x) { return String(x['ID']) === String(d.id); })[0];
    if (!r) return { msg: 'Already gone.' };
    if (String(r['ELF ID']) !== String(ctx.id) && !ctx.isLead) return err_('You can only remove your own posts.');
    if (r['Photo file ID']) { try { DriveApp.getFileById(String(r['Photo file ID'])).setTrashed(true); } catch (e) {} }
    t.sh.deleteRow(r._row);
    return { msg: 'Removed.' };
  },
  crew_resend: function (ctx, d) {
    if (!ctx.isLead) return err_('Only Leads can resend codes.');
    const c = crewRow_(d.row, d.name); if (!c) return err_('Could not find that ELF.');
    if (String(c.r['Hub access']) !== 'Approved') return err_('Approve them first.');
    const code = String(c.r['ELF code'] || '') || newCode_();
    if (!c.r['ELF code']) set_(c.t, c.r._row, { 'ELF code': code });
    const sent = sendCode_(c.r['Name'], c.r['Email'], code);
    log_(ctx, 're-sent ' + c.r['Name'] + '\'s sign-in instructions');
    return { msg: sent ? 'Sign-in instructions emailed again.' : 'No email on file. Text them their code.',
             extra: { code: code, name: String(c.r['Name']), phone: String(c.r['Phone'] || ''), emailed: sent, existing: true } };
  },
  crew_code: function (ctx, d) {
    if (!ctx.isLead) return err_('Only Leads can send new codes.');
    const c = crewRow_(d.row, d.name); if (!c) return err_('Could not find that ELF.');
    const code = newCode_();
    set_(c.t, c.r._row, { 'ELF code': code });
    const sent = sendCode_(c.r['Name'], c.r['Email'], code);
    log_(ctx, 'sent a new ELF code to ' + c.r['Name']);
    return { msg: sent ? 'New code emailed.' : 'New code made. Text it to them.',
             extra: { code: code, name: String(c.r['Name']), phone: String(c.r['Phone'] || ''), emailed: sent } };
  }
};

function err_(m) { return { ok: false, error: m }; }

// ---------- removing ----------
function archive_(ctx, type, id, name, phone, address, reason, row) {
  const rec = {};
  Object.keys(row).forEach(function (k) {
    if (k === '_row' || k === 'Kids data — do not edit' || k === 'ELF code') return;
    const v = row[k];
    if (v !== '' && v !== null && v !== undefined) rec[k] = v instanceof Date ? v.toISOString() : String(v);
  });
  append_(table_('Removed', REMOVED_HEADERS), {
    'When': new Date(), 'Removed by': ctx.name, 'Type': type, 'ID': id, 'Name': String(name || ''),
    'Phone': text_(phone, 40), 'Address': String(address || ''), 'Reason': reason, 'Record': JSON.stringify(rec).slice(0, 45000)
  });
}

// Flags a new sign-up that matches a removed one, or an existing one.
function matchFlag_(fam, phone, address) {
  const p = String(phone || '').replace(/\D/g, '').slice(-10);
  const a = normAddr_(address);
  const hits = [];
  rows_(table_('Removed', REMOVED_HEADERS)).forEach(function (r) {
    if (String(r['Type']) === 'Volunteer') return;
    const rp = String(r['Phone'] || '').replace(/\D/g, '').slice(-10);
    const ra = normAddr_(String(r['Address'] || '').split(',')[0]);
    if ((p.length >= 7 && rp === p) || (a.length > 5 && ra === a))
      hits.push('Matches removed ' + r['ID'] + ' (' + r['Reason'] + ')');
  });
  rows_(fam).forEach(function (r) {
    if (!r['Family #'] || r['Status'] === 'Not listed') return;
    const rp = String(r['Phone'] || '').replace(/\D/g, '').slice(-10);
    const ra = normAddr_(r['Street address']);
    if ((p.length >= 7 && rp === p) || (a.length > 5 && ra === a)) hits.push('Same phone or address as ' + r['Family #']);
  });
  return hits.slice(0, 4).join('; ');
}

function normAddr_(s) {
  return String(s || '').toLowerCase()
    .replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave').replace(/\broad\b/g, 'rd').replace(/\bdrive\b/g, 'dr')
    .replace(/\blane\b/g, 'ln').replace(/\bcourt\b/g, 'ct').replace(/[^a-z0-9]/g, '');
}

// ---------- ELF IDs (stable, used for private chats) ----------
function newElfId_() { return 'E' + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function ensureElfIds_() {
  const vol = table_('Volunteers', VOLUNTEER_HEADERS);
  rows_(vol).forEach(function (r) { if (r['Name'] && !r['ELF ID']) set_(vol, r._row, { 'ELF ID': newElfId_() }); });
}

// ---------- chat ----------
// Channels: 'all' (everyone), 'adopt' (Adoption ELVES + Leads), 'team:<name>' (a Santa team), 'dm:<id>|<id>' (two ELVES).
function chatAllowed_(ctx, ch) {
  ch = String(ch || '');
  if (ch === 'all') return true;
  if (ch === 'adopt') return ctx.isAdopt;
  if (ch.indexOf('team:') === 0) return ctx.isLead || (!!ctx.team && ch === 'team:' + ctx.team.toLowerCase());
  if (ch.indexOf('dm:') === 0) return !!ctx.id && ch.slice(3).split('|').indexOf(ctx.id) >= 0;
  return false;
}

function chatFor_(ctx, since) {
  const t = since ? new Date(since).getTime() : 0;
  return rows_(table_('Chat', CHAT_HEADERS)).filter(function (r) {
    return r['Message'] && chatAllowed_(ctx, r['Channel']) && (!t || (r['When'] instanceof Date && r['When'].getTime() > t));
  }).slice(-300).map(function (r) {
    return { when: iso_(r['When']), from: String(r['From'] || ''), fromId: String(r['From ID'] || ''),
             ch: String(r['Channel']), text: String(r['Message']) };
  });
}

function chatSend_(ctx, d) {
  const text = clean_(d.text, 1000);
  if (!text) return err_('Type a message first.');
  let ch = String(d.channel || '');
  if (ch.indexOf('dm:') === 0) {
    const other = String(d.to || '');
    const ok = rows_(table_('Volunteers', VOLUNTEER_HEADERS)).some(function (r) {
      return String(r['ELF ID']) === other && r['Hub access'] === 'Approved';
    });
    if (!ok || other === ctx.id || !ctx.id) return err_('Could not find that ELF.');
    ch = 'dm:' + [ctx.id, other].sort().join('|');
  }
  if (!chatAllowed_(ctx, ch)) return err_('You can\'t post in that chat.');
  append_(table_('Chat', CHAT_HEADERS), { 'When': new Date(), 'From': ctx.name, 'From ID': ctx.id, 'Channel': ch, 'Message': text });
  return { ok: true };
}

function taskRow_(id) {
  const t = table_('Tasks', TASK_HEADERS);
  const r = rows_(t).filter(function (x) { return String(x['Task ID']) === String(id); })[0];
  return r ? { t: t, r: r } : null;
}

function famRow_(id) {
  const t = table_('Families', FAMILY_HEADERS);
  const r = findFamily_(t, id);
  return r ? { t: t, r: r } : null;
}

function findFamily_(t, id) {
  return rows_(t).filter(function (x) { return String(x['Family #']) === String(id); })[0] || null;
}

function crewRow_(row, name) {
  const t = table_('Volunteers', VOLUNTEER_HEADERS);
  const n = Number(row);
  if (!(n >= 2)) return null;
  const r = rows_(t).filter(function (x) { return x._row === n; })[0];
  if (!r || String(r['Name']) !== String(name)) return null;
  return { t: t, r: r };
}

function normCode_(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^ELF/, '');
}

function newCode_() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc.charAt(Math.floor(Math.random() * abc.length));
  return 'ELF-' + s;
}

function sendCode_(name, email, code) {
  email = String(email || '').trim();
  if (!email || email.indexOf('@') < 0) return false;
  return mail_(email, 'You\'re in! Your ELF code for Santa\'s Operations Hub 🎅',
    'Hi ' + firstName_(name) + '!\n\n' +
    'You\'re officially one of Santa\'s ELVES (Enthusiastic Loving Volunteers Empowering Santa) ' +
    'for the Kilted Santa Project. Thank you!\n\n' +
    'HOW TO SIGN IN (takes a minute):\n' +
    '1. Open Santa\'s Operations Hub: ' + HUB_URL + '\n' +
    '2. Type this email address (' + email + ') or your phone number.\n' +
    '3. Type your ELF code: ' + code + '\n' +
    '4. Tap Sign in. Check "Keep me signed in" on your own phone so you only do this once.\n\n' +
    'Tip: once you\'re in, add the hub to your phone\'s home screen (Share → Add to Home Screen) so it\'s one tap away.\n\n' +
    'Then start on the Home tab: "Ways to help right now" shows what the crew needs today. ' +
    'Grab a task, say hi in Chat, and you\'re rolling.\n\n' +
    'New to all this? The ELF Guide walks through every tab and role: ' + GUIDE_URL + '\n\n' +
    'Please keep your code to yourself. It opens up details about the families we serve.\n\n' +
    '— The Kilted Santa Project');
}

// Every email the project sends goes through here, from "The Kilted Santa Project".
function mail_(to, subject, body) {
  to = String(to || '').trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return false;
  try { MailApp.sendEmail(to, subject, body, { name: FROM_NAME }); return true; }
  catch (e) { console.error(e); return false; }
}

// "Sandy & Gerry McCarroll" -> "Sandy & Gerry"; "Kerr Bunch and family" -> "Kerr"
function greetName_(n) {
  const t = String(n || '').replace(/\s+and family\s*$/i, '').trim().split(/\s+/);
  const c = t.findIndex(function (w) { return w === '&' || /^and$/i.test(w); });
  if (c > 0 && c + 1 < t.length) return t.slice(0, c + 2).join(' ');
  return t[0] || 'there';
}
function firstName_(n) { return String(n || '').trim().split(/\s+/)[0] || 'there'; }

// When a family is adopted: email them the good news, or put a call/text task on the board.
function tellFamilyAdopted_(fam, r, by) {
  const id = String(r['Family #']);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d');
  const sent = mail_(r['Email'], 'Good news from the Kilted Santa Project! 🎁 (' + id + ')',
    'Hi ' + firstName_(r['Parent/Guardian name']) + '!\n\n' +
    'We have happy news: a sponsor has adopted your family (' + id + ') for Christmas! 🎄\n\n' +
    'One of our ELVES will reach out as we get closer to Christmas to talk about delivery. ' +
    'Most of our deliveries happen on December 23 or 24. Please keep an eye on your phone and email, ' +
    'and answer calls or texts from numbers you don\'t know around then.\n\n' +
    'If your phone number or address has changed, just reply to this email.\n\n' +
    'Merry Christmas from all of Santa\'s ELVES!\n— The Kilted Santa Project');
  set_(fam, r._row, { 'Family told': sent ? 'Emailed ' + stamp : 'No email — needs a call or text' });
  const hasTask = rows_(table_('Tasks', TASK_HEADERS)).some(function (t) {
    return String(t['Family #']) === id && t['Status'] !== 'Done' && /^📞 Let Family /.test(String(t['Title']));
  });
  if (!sent && !hasTask) {
    addTask_(by, {
      'Title': '📞 Let Family ' + id + ' know a sponsor adopted them',
      'Details': 'They didn\'t leave an email, so they haven\'t heard yet. Call or text them (Families tab → ' + id + '), ' +
        'then tap "Mark family contacted". Don\'t share the adopter\'s name unless they connected directly.',
      'Area': 'Adoptions', 'Family #': id
    });
  }
  logAs_(by, sent ? 'emailed Family ' + id + ' the good news ✉️' : 'Family ' + id + ' has no email, so a call/text task went on the board');
  return sent;
}

function addTask_(by, fields) {
  const props = PropertiesService.getScriptProperties();
  const n = Number(props.getProperty('nextTask') || 1);
  props.setProperty('nextTask', String(n + 1));
  append_(table_('Tasks', TASK_HEADERS), Object.assign({
    'Task ID': 'T' + n, 'Created': new Date(), 'Created by': by, 'Area': 'Other', 'Status': 'Open'
  }, fields));
}

// Marking a family contacted also finishes any open "let them know" task for them.
function closeContactTasks_(id, by) {
  const t = table_('Tasks', TASK_HEADERS);
  rows_(t).forEach(function (r) {
    if (String(r['Family #']) === id && r['Status'] !== 'Done' && /^📞 Let Family /.test(String(r['Title'])))
      set_(t, r._row, { 'Status': 'Done', 'Claimed by': r['Claimed by'] || by, 'Done': new Date() });
  });
}

// Approving a family used to quietly mark the approver as "handling" it, which made it look like
// one person had every family. Undo that once, keeping anyone who really tapped "I'll handle this family".
function clearAutoHandled_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('autoHandledCleared')) return;
  const took = {};
  rows_(table_('Log', LOG_HEADERS)).forEach(function (r) {
    const m = String(r['What'] || '').match(/^is handling Family (KS-\d+)/);
    if (m) took[m[1] + '|' + r['Who']] = true;
  });
  // Read and write the whole column in one go (one cell at a time is far too slow).
  const fam = table_('Families', FAMILY_HEADERS);
  const n = fam.sh.getLastRow() - 1;
  if (n > 0) {
    const ids = fam.sh.getRange(2, fam.map['Family #'] + 1, n, 1).getValues();
    const col = fam.sh.getRange(2, fam.map['Handled by'] + 1, n, 1);
    const vals = col.getValues();
    let changed = false;
    vals.forEach(function (v, i) {
      if (v[0] && !took[String(ids[i][0]) + '|' + v[0]]) { v[0] = ''; changed = true; }
    });
    if (changed) col.setValues(vals);
  }
  props.setProperty('autoHandledCleared', '1');
}

function log_(ctx, what) { logAs_(ctx.name, what); }
function logAs_(who, what) {
  try { append_(table_('Log', LOG_HEADERS), { 'When': new Date(), 'Who': who, 'What': String(what).slice(0, 300) }); } catch (e) {}
}

// =====================================================================
// helpers
// =====================================================================
// The sheet this script saves to.
const SHEET_ID = '1c9sIiE4BKZUaE7PxfFK3oPjPMmU6rwyI86kluIZW07A';
function ss_() { return SpreadsheetApp.openById(SHEET_ID); }

// Opens a tab by name, adding any missing columns at the end, and maps headers to columns.
const TABLES_ = {};
function table_(name, headers) {
  if (TABLES_[name]) return TABLES_[name];
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const lastCol = sh.getLastColumn();
  let have = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  while (have.length && !have[have.length - 1]) have.pop();
  const missing = headers.filter(function (h) { return have.indexOf(h) < 0; });
  if (missing.length) {
    const need = have.length + missing.length;
    if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
    sh.getRange(1, have.length + 1, 1, missing.length).setValues([missing]);
    have = have.concat(missing);
  }
  if (missing.length || !lastCol) {
    sh.getRange(1, 1, 1, have.length).setFontWeight('bold').setBackground('#f3e9d2');
    sh.setFrozenRows(1);
  }
  const map = {};
  have.forEach(function (h, i) { if (h) map[h] = i; });
  TABLES_[name] = { sh: sh, headers: have, map: map };
  return TABLES_[name];
}

function rows_(t) {
  const last = t.sh.getLastRow();
  if (last < 2) return [];
  const values = t.sh.getRange(2, 1, last - 1, t.headers.length).getValues();
  return values.map(function (v, i) {
    const o = { _row: i + 2 };
    t.headers.forEach(function (h, j) { if (h) o[h] = v[j]; });
    return o;
  });
}

function append_(t, obj) {
  t.sh.appendRow(t.headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; }));
}

function set_(t, row, obj) {
  Object.keys(obj).forEach(function (k) {
    if (t.map[k] !== undefined) t.sh.getRange(row, t.map[k] + 1).setValue(obj[k]);
  });
}

function dropdown_(t, header, list) {
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
  t.sh.getRange(2, t.map[header] + 1, Math.max(1, t.sh.getMaxRows() - 1), 1).setDataValidation(rule);
}

function iso_(v) {
  if (v instanceof Date) return v.toISOString();
  return v ? String(v) : '';
}

// Private Drive folders: "Kilted Santa Uploads" > "Family photos" / "Proof of residency (private)".
function folder_(kind) {
  const props = PropertiesService.getScriptProperties();
  const names = { root: 'Kilted Santa Uploads', photos: 'Family photos', proof: 'Proof of residency (private)', cheers: 'ELF cheer photos (hub only)' };
  const key = 'folder_' + kind;
  const id = props.getProperty(key);
  if (id) {
    try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {}
  }
  const parent = kind === 'root' ? DriveApp.getRootFolder() : folder_('root');
  const found = parent.getFoldersByName(names[kind]);
  const f = found.hasNext() ? found.next() : parent.createFolder(names[kind]);
  props.setProperty(key, f.getId());
  return f;
}

function checkUpload_(file, label) {
  if (!file || !file.data) return 'Please add a ' + label + '.';
  const type = String(file.type || '').toLowerCase();
  if (ALLOWED_UPLOAD_TYPES.indexOf(type) < 0) return 'The ' + label + ' needs to be a photo or a PDF.';
  if (String(file.data).length * 0.75 > MAX_UPLOAD_BYTES) return 'The ' + label + ' is too large. Please use a smaller picture.';
  return '';
}

function saveUpload_(file, folder, baseName) {
  const type = String(file.type).toLowerCase();
  const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
                'image/heic': '.heic', 'image/heif': '.heif', 'application/pdf': '.pdf' }[type] || '';
  const bytes = Utilities.base64Decode(String(file.data));
  const name = baseName.replace(/[\\\/:*?"<>|]/g, '').slice(0, 120) + ext;
  const saved = folder.createFile(Utilities.newBlob(bytes, type, name));
  return saved.getUrl();
}

function kidSummary_(k) {
  const bits = [];
  if (clean_(k.age)) bits.push('age ' + clean_(k.age));
  if (clean_(k.gender)) bits.push(clean_(k.gender));
  if (clean_(k.clothing)) bits.push('clothes ' + clean_(k.clothing));
  if (clean_(k.shoe)) bits.push('shoe ' + clean_(k.shoe));
  let s = bits.join(', ');
  if (clean_(k.wishes)) s += ' | Wishes: ' + clean_(k.wishes);
  if (clean_(k.likes)) s += ' | Likes: ' + clean_(k.likes);
  return s;
}

// Trims, caps length, and stops spreadsheet formulas from being injected.
function clean_(v, max) {
  if (v === null || v === undefined) return '';
  let s = String(v).trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

// Forces a value to stay plain text in the sheet (keeps leading zeros and '+').
function text_(v, max) {
  const s = String(v === null || v === undefined ? '' : v).trim().slice(0, max || 200).replace(/^'+/, '');
  return s ? "'" + s : '';
}

function alert_(subject, body) {
  if (!SEND_ALERTS) return;
  try {
    const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
    if (to) MailApp.sendEmail(to, '[Kilted Santa] ' + subject, body);
  } catch (e) { /* alerts are a bonus; never block a sign-up */ }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
