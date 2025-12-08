console.log('[BOOT] cwd=', process.cwd(), 'file=', __filename);

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const multer = require('multer');
const { connectDB } = require('./utils/db');

const AuthUser = require('./models/AuthUser');
const Record   = require('./models/Record');
const DataType = require('./models/DataType');
const Field    = require('./models/Field');
const OptionSet= require('./models/OptionSet');

const bcrypt = require('bcryptjs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const MongoStore = require('connect-mongo');

const { createRecord } = require('./controllers/records');
const recordsCtrl = require('./controllers/records.js');
if (!recordsCtrl || typeof recordsCtrl.createRecord !== 'function') {
  console.error('controllers/records.js export is', recordsCtrl);
  process.exit(1);
}

/* ---------- create app BEFORE using it ---------- */
const app = express();
app.use((req,res,next) => {
  console.log('[LIVE]', req.method, req.url);
  next();
});

app.get('/__ping', (req, res) => res.send('EJS Live server is running'));

const router = express.Router();
app.set('trust proxy', 1);

/* ---------- CORS FIRST ---------- */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8400',
  'https://www.suiteseat.io',
  'https://app.suiteseat.io',
  ...(process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean),
];
const corsOptions = {
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
};
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cors(corsOptions));
app.options('*', cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
/* ---------- parsers, then session ---------- */
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    httpOnly: true,
    // For cross-origin with localhost in dev, LAX usually works
    sameSite: 'lax',
    // In dev over http, this must be false
    secure: false,
    // optional:
    maxAge: 1000 * 60 * 60 * 24 * 7,
  }
}));

// ---------- AUTH ROUTES ----------
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

    const user = await AuthUser.findOne({ email: String(email).toLowerCase().trim() }).lean();
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.passwordHash || user.password || '');
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    req.session.userId = String(user._id);
    req.session.user = {
      _id: String(user._id),
      email: user.email,
      firstName: user.firstName || user.name || '',
    };

    res.json({ ok: true, user: req.session.user });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  const u = req.session?.userId
    ? (req.session.user || { _id: req.session.userId })
    : null;
  res.json({ ok: true, user: u });
});



function stampCreatedBy(req, _res, next) {
  const url = req.originalUrl || req.url || '';
  if (req.method === 'POST' && url.includes('/api/records')) {
    const uid = req.session?.userId || req.session?.user?._id || req.user?._id || req.body?.createdBy || null;
    req.body ||= {};
    if (uid && !req.body.createdBy) req.body.createdBy = String(uid);
  }
  next();
}
app.use(stampCreatedBy);


// Make sure this is AFTER app.use(session(...)) and BEFORE any routes using it.
function requireLogin(req, res, next) {
  const uid = req.session?.userId || req.session?.user?._id || null;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  req.session.userId = uid;
  next();
}
// helper you already asked about:
function escapeRegex(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// ✅ use the one from normalize; do NOT redeclare it elsewhere
const {
  getDataTypeByNameLoose,
  normalizeWhereForType,
  normalizeSortForType,
  normalizeValuesForType,
} = require('./utils/normalize');

// one canonical handler
// in your route, temporarily:
// keep your existing route exactly as-is
app.post('/api/records', requireLogin, async (req, res, next) => {
  try {
    const { dataTypeId, values = {} } = req.body || {};
    if (!dataTypeId) return next(); // let controller handle normal errors

    const dt = await DataType.findById(dataTypeId).lean();
    if (!dt) return next();

    if (/^store$/i.test(dt.name)) {
      let slug =
        values.slug ||
        values.Slug ||
        values.storeSlug ||
        values['Store Slug'] ||
        ((values.Name || values.name) ? slugify(values.Name || values.name) : null);

      if (slug) slug = await ensureUniqueStoreSlug(slug);
      req.body.values = { ...values, slug };
    }

    return recordsCtrl.createRecord(req, res, next);
  } catch (e) {
    return next(e);
  }
});

// 🔁 add this one-liner alias so BOTH paths work
app.post('/records', requireLogin, (req, res, next) =>
  recordsCtrl.createRecord(req, res, next)
);


app.post('/api/records/:type', ensureAuthenticated, async (req, res) => {
  try {
    const sid = req.session?.userId;
    const typeName = decodeURIComponent(req.params.type || '').trim();
    const values = (req.body && req.body.values) || {};

    console.log('[CREATE] /api/records/:type', {
      typeName,
      sid,
      isValidSid: isValidObjectId(sid),
      values
    });

    if (!sid || !isValidObjectId(sid)) {
      return res.status(401).json({ message: 'Not logged in' });
    }

    const createdBy = new mongoose.Types.ObjectId(sid);

    // Prefer dataTypeId if your schema uses it
    let doc = {
      values,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const dt = await getDataTypeByNameLoose(typeName);
      if (dt?._id) {
        doc.dataTypeId = dt._id;
      } else {
        // fall back to string name
        doc.dataType = typeName;
      }
    } catch (e) {
      // fallback to string dataType if lookup helper throws
      doc.dataType = typeName;
    }

    const rec = await Record.create(doc);
    console.log('[CREATE] saved', { id: String(rec._id), typeName, used: doc.dataTypeId ? 'dataTypeId' : 'dataType' });

    res.json({ _id: rec._id, values: rec.values });
  } catch (e) {
    // Print useful validation details
    if (e?.name === 'ValidationError' && e?.errors) {
      for (const [k, err] of Object.entries(e.errors)) {
        console.error(`[VALIDATION] ${k}:`, err?.message);
      }
    }
    console.error('[CREATE] error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/_routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(l => {
    if (l.route && l.route.path) {
      routes.push({ method: Object.keys(l.route.methods)[0]?.toUpperCase(), path: l.route.path });
    } else if (l.name === 'router' && l.handle.stack) {
      l.handle.stack.forEach(s => {
        if (s.route && s.route.path) {
          routes.push({ method: Object.keys(s.route.methods)[0]?.toUpperCase(), path: '/api' + s.route.path });
        }
      });
    }
  });
  res.json(routes);
});

router.get('/api/users/me', (req, res) => {
  const userId = req.session?.userId || null;
  res.json({ user: userId ? { _id: userId, ...(req.session.user || {}) } : null });
});

app.use('/api', router);

// ---- add this near the top of server.js ----
const TYPE = Object.freeze({
  Business: 'Business',
  Calendar: 'Calendar',
  Category: 'Category',
  Service: 'Service',
  Appointment: 'Appointment',
});

app.post('/api/_ping', (req, res) => {
  res.json({ ok: true, got: req.body, t: Date.now() });
});





// ---------- routes ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, t: Date.now() }));


// ---------- static / assets ----------
const path = require('path');
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use('/qassets', express.static('C:/Users/tiffa/OneDrive/Desktop/suiteseat-web/public/qassets'));


// ---------- sockets / server listen ----------
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

io.on('connection', (socket) => {
  console.log('🔌 socket connected', socket.id);
  socket.on('disconnect', () => console.log('🔌 socket disconnected', socket.id));
});
app.use((req, res, next) => {
  console.warn('[404]', req.method, req.originalUrl);
  next();
});

// ✅ DB connect then start server (single place)
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 8400;
    server.listen(PORT, () => console.log(`✅ API listening on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ DB connect failed', err);
    process.exit(1);
  });
// --- View engine (only if you actually render EJS views) ---
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));
const nodemailer = require('nodemailer');


const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE) === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
// server.js
const { Resend } = require('resend');
const { createEvent } = require('ics');

const resend = new Resend(process.env.RESEND_API_KEY);

function to12h(hhmm = '00:00') {
  const [H, M='0'] = String(hhmm).split(':');
  let h = parseInt(H, 10), m = parseInt(M, 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}
function prettyDate(ymd = '2025-01-01') {
  try {
    const d = new Date(`${ymd}T00:00:00`);
    return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  } catch { return ymd; }
}
function objIdFromRef(ref) {
  if (!ref) return null;
  const id = (typeof ref === 'object') ? (ref._id || ref.id) : ref;
  try { return id ? new mongoose.Types.ObjectId(String(id)) : null; }
  catch { return null; }
}

function makeIcsBuffer({ title, description='', location='', startISO, durationMin=60, organizerName='', organizerEmail='' }) {
  const d = new Date(startISO);
  return new Promise((resolve, reject) => {
    createEvent({
      start: [d.getFullYear(), d.getMonth()+1, d.getDate(), d.getHours(), d.getMinutes()],
      duration: { minutes: durationMin },
      title,
      description,
      location,
      organizer: organizerEmail ? { name: organizerName || '', email: organizerEmail } : undefined,
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
    }, (err, value) => err ? reject(err) : resolve(Buffer.from(value)));
  });
}

async function sendBookingEmailWithResend({ to, subject, html, icsBuffer, cc=[], bcc=[], replyTo='' }) {
  const from = process.env.MAIL_FROM; // e.g. "Your Biz <bookings@yourdomain.com>"
  const attachments = icsBuffer ? [{ filename: 'appointment.ics', content: icsBuffer }] : undefined;

  return resend.emails.send({
    from,
    to,
    subject,
    html,
    attachments,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    reply_to: replyTo || undefined,
  });
}
// server.js (or routes file on 8400)
app.post('/api/booking/notify', async (req, res) => {
  try {
    // TODO: send email/SMS here (Resend/Nodemailer/Twilio etc.)
    console.log('[notify] payload:', req.body);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[notify] failed', e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});


// Return { slug: "business-slug" } for a Business record by its _id
// --- Public: get a Business slug by its Record _id ---
// Return { slug: "business-slug" } for a Business record by its _id
app.get('/api/public/business-slug/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.json({ slug: '' });

    const biz = await Record.findOne({ _id: id, deletedAt: null })
      .select({ values: 1 })
      .lean();

    if (!biz) return res.status(404).json({ slug: '' });

    // 1) Try existing slug fields
    let slug =
      biz?.values?.slug ||
      biz?.values?.Slug ||
      biz?.values?.['Business Slug'] ||
      '';

    // 2) If missing, derive from a name and persist
    if (!slug) {
      const name =
        biz.values?.businessName ||
        biz.values?.name ||
        biz.values?.['Business Name'] ||
        '';

      if (!name) return res.json({ slug: '' }); // no name to derive from

      slug = slugify(name);

      // Optional: ensure uniqueness among Businesses (simple suffix)
      const conflict = await Record.findOne({
        _id: { $ne: biz._id },
        deletedAt: null,
        'values.slug': slug
      }).lean();

      if (conflict) slug = `${slug}-${biz._id.toString().slice(-4)}`;

      // Save back so next lookups are instant
      await Record.updateOne(
        { _id: biz._id },
        { $set: { 'values.slug': slug } }
      );
    }

    res.json({ slug });
  } catch (e) {
    console.error('GET /api/public/business-slug failed:', e);
    res.json({ slug: '' });
  }
});

app.get('/api/public/booking-slug/by-business/:id', async (req, res) => {
  try {
    const bizId = String(req.params.id || '').trim();
    if (!bizId) return res.json({ slug: '' });

    // helpers to resolve datatypes by name
    async function getDT(name) {
      if (typeof getDataTypeByNameLoose === 'function') {
        const dt = await getDataTypeByNameLoose(name);
        return dt?._id || null;
      }
      return null;
    }

    const businessDT = await getDT('Business');
    const pageDT     = await getDT('CustomBookingPage');

    // fetch the Business to read selectedBookingPageId (if present)
    const biz = await Record.findOne({
      _id: bizId, deletedAt: null,
      ...(businessDT ? { dataTypeId: businessDT } : {})
    }).lean();

    const selectedId = biz?.values?.selectedBookingPageId || '';

    // find pages tied to this business by any of the common keys
    const pages = await Record.find({
      deletedAt: null,
      ...(pageDT ? { dataTypeId: pageDT } : {}),
      $or: [
        { 'values.businessId': bizId },
        { 'values.Business': bizId },
        { 'values.ownerId': bizId }
      ]
    }).lean();

    const isPublished = (v = {}) =>
      v.published === true || v.Published === true ||
      v['is Published'] === true ||
      String(v.status || '').toLowerCase() === 'published';

    // Prefer the selected + published one, else newest published
    let chosen = pages.find(p => String(p._id) === String(selectedId) && isPublished(p.values));
    if (!chosen) {
      chosen = pages
        .filter(p => isPublished(p.values))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0];
    }

    const slug = chosen?.values?.slug || chosen?.values?.Slug || '';
    return res.json({ slug: slug || '' });
  } catch (e) {
    console.error('GET /api/public/booking-slug/by-business failed:', e);
    res.json({ slug: '' });
  }
});
// GET /api/public/business/by-slug/:slug  -> { business: {...} }
app.get('/api/public/business/by-slug/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return res.status(400).json({ error: 'missing slug' });

    // find a "Business" record by slug (your values may be under different keys)
    const biz = await Record.findOne({
      deletedAt: null,
      $or: [
        { 'values.slug': slug },
        { 'values.Slug': slug },
        { 'values.Business Slug': slug }
      ]
    })
    .select({ values: 1, _id: 1, createdAt: 1, updatedAt: 1 })
    .lean();

    if (!biz) return res.status(404).json({ error: 'not_found' });

    const v = biz.values || {};
    res.json({
      business: {
        id: String(biz._id),
        name: v.businessName || v.name || '',
        slug: v.slug || v.Slug || v['Business Slug'] || slug,
        logoUrl: v.logoUrl || v.logo || '',
        phone: v.phone || v.Phone || '',
        email: v.email || v.Email || '',
        address: v.address || v.Address || '',
      }
    });
  } catch (e) {
    console.error('GET /api/public/business/by-slug failed:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/uploads/presign', async (req, res) => {
  try {
    const { filename, contentType } = req.body || {};
    if (!filename || !contentType) return res.status(400).json({ error: 'filename, contentType required' });

    // create a unique key; you can prefix with userId if you want
    const ext = filename.split('.').pop();
    const key = `uploads/${uuid()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read', // or keep private and serve via CloudFront / signed URLs
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60 seconds
    const publicUrl =
      process.env.PUBLIC_BASE_URL
        ? `${process.env.PUBLIC_BASE_URL}/${key}`
        : `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    res.json({ url, key, publicUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'presign failed' });
  }
});





///////////////////////////////////
// --- Uploads (single source of truth) ---
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Serve uploaded files at /uploads/<filename>
app.use('/uploads', express.static(UPLOADS_DIR));


// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const name = `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
//////////////////////////////////


function objIdFromRef(ref) {
  if (!ref) return null;
  const id = (typeof ref === 'object') ? (ref._id || ref.id) : ref;
  try { return id ? new mongoose.Types.ObjectId(String(id)) : null; }
  catch { return null; }
}

async function enrichAppointment(rawValues) {
  // Attach Business Owner + Pro Name from Business
  const businessId = objIdFromRef(rawValues['Business']);
  if (businessId) {
    const bizDT = await DataType.findOne({ name: /Business/i, deletedAt: null }).lean();
    if (bizDT) {
      const biz = await Record.findOne({ _id: businessId, dataTypeId: bizDT._id, deletedAt: null }).lean();
      if (biz) {
        if (biz.createdBy && !rawValues['Business Owner']) {
          rawValues['Business Owner'] = { _id: String(biz.createdBy) };
        }
        const pn = biz.values?.['Pro Name'] || biz.values?.proName || biz.values?.stylistName;
        if (pn && !rawValues['Pro Name']) rawValues['Pro Name'] = pn;
      }
    }
  }

  // Attach Pro from Calendar if client didn't provide it
  const calId = objIdFromRef(rawValues['Calendar']);
  if (calId && !rawValues['Pro']) {
    const calDT = await DataType.findOne({ name: /Calendar/i, deletedAt: null }).lean();
    if (calDT) {
      const cal = await Record.findOne({ _id: calId, dataTypeId: calDT._id, deletedAt: null }).lean();
      const v = cal?.values || {};
      const proLike = v.Pro || v['Pro Ref'] || v.Staff || v['Staff Ref'] || v.Professional || v.Provider || v.Owner;
      const proId = proLike?._id || proLike?.id || (typeof proLike === 'string' ? proLike : null);
      if (proId) rawValues['Pro'] = { _id: String(proId) };
    }
  }

  return rawValues;
}



//////////////////////////////////////////////
//User Authentication

// Save profile updates (name, phone, etc.) + optional file upload
app.post('/update-user-profile',
  ensureAuthenticated,
  upload.single('profilePhoto'),
  async (req, res) => {
    try {
      const userId = req.session.userId;

      // Grab previous values (for prevEmail match)
      const prev = await AuthUser.findById(userId).lean();

      const { firstName, lastName, phone, address, email } = req.body;
      const update = { firstName, lastName, phone, address, email };

      if (req.file) {
        update.profilePhoto = `/uploads/${req.file.filename}`;
      }

      const user = await AuthUser.findByIdAndUpdate(userId, update, { new: true, lean: true });
      if (!user) return res.status(404).json({ message: 'User not found' });

      // 🔁 Propagate to Client & Appointment records
      const stats = await propagateProfileToCRM(
        { userId, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone },
        prev?.email
      );

      // Return shape expected by the front-end
      res.json({ user, propagated: stats });
    } catch (e) {
      console.error('POST /update-user-profile failed:', e);
      res.status(500).json({ message: 'Server error saving profile' });
    }
  }
);


app.get("/api/me", (req,res)=>{
  if (!req.session?.userId) return res.status(401).json({ loggedIn:false });
  res.json({ 
    id: req.session.userId, 
    ...req.session.user      // set this during /login
  });
}); 
function ensureAuthenticated(req, res, next) {
  if (req.session?.userId) return next();
  return res.status(401).json({ error: 'Not logged in' });
}

// Returns { user: { _id, firstName, lastName, email, phone, address, profilePhoto } }
app.get('/api/users/me', ensureAuthenticated, async (req, res) => {
  try {
    const u = await AuthUser.findById(req.session.userId).lean();
    if (!u) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        _id: String(u._id),
        firstName:   u.firstName   || '',
        lastName:    u.lastName    || '',
        email:       u.email       || '',
        phone:       u.phone       || '',
        address:     u.address     || '',   // string is fine; if you store an object, serialize as needed
        profilePhoto:u.profilePhoto|| ''    // e.g. "/uploads/169..._avatar.png"
      }
    });
  } catch (e) {
    console.error('GET /api/users/me failed:', e);
    res.status(500).json({ error: e.message });
  }
});


app.get('/api/me/records', ensureAuthenticated, async (req, res) => {
  try {
    const userId = String(req.session.userId || '');
    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    const {
      dataType,
      where: whereStr,
      sort: sortStr,
      includeCreatedBy = '1',
      includeRefField = '1',
      myRefField = 'Client',
      limit = '100',
      skip  = '0',
    } = req.query;

    if (!dataType) return res.status(400).json({ error: 'dataType required' });

    const dt = await getDataTypeByNameLoose(dataType);
    if (!dt) return res.json({ data: [] });

    let whereRaw = {};
    if (whereStr) { try { whereRaw = JSON.parse(whereStr); } catch {} }
    const where = await normalizeWhereForType(dt._id, whereRaw);

    const ors = [];
    if (includeCreatedBy === '1' || includeCreatedBy === 'true') {
      ors.push({ createdBy: req.session.userId });
    }
    if (includeRefField === '1' || includeRefField === 'true') {
      const mineByRef = await normalizeWhereForType(dt._id, { [myRefField]: userId });
      ors.push(mineByRef);
    }

    const q = { dataTypeId: dt._id, deletedAt: null, ...where };
    if (ors.length) q.$or = ors;

    let mongoSort = { createdAt: -1 };
    if (sortStr) { try { mongoSort = await normalizeSortForType(dt._id, JSON.parse(sortStr)); } catch {} }

    const lim = Math.min(parseInt(limit, 10) || 100, 500);
    const skp = Math.max(parseInt(skip, 10) || 0, 0);
const rows = await Record.find(q)
  .sort(mongoSort).skip(skp).limit(lim)
  .populate({ path: 'createdBy', select: 'firstName lastName name' })  // <— add this
  .lean();

res.json({
  data: rows.map(r => ({
    _id: r._id,
    values: r.values || {},
    createdBy: r.createdBy ? {
      firstName: r.createdBy.firstName || '',
      lastName:  r.createdBy.lastName  || '',
      name:      r.createdBy.name      || ''
    } : null
  }))
}); } catch (e) {
    console.error('GET /api/me/records failed:', e);
    res.status(500).json({ error: e.message });
  }
});



app.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password, phone } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email & password required' });

  const existing = await AuthUser.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) return res.status(409).json({ message: 'Email already in use' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await AuthUser.create({
    firstName, lastName, email, phone, passwordHash, roles: ['client']
  });

  req.session.userId = user._id;
  req.session.user = { email: user.email, name: user.name, roles: user.roles };

  res.json({
    ok: true,
    user: {  _id: String(user._id), firstName, lastName, email, phone }
  });
});

app.post('/signup/pro', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Missing email/password' });

    const existing = await AuthUser.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await AuthUser.create({
      firstName, lastName,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      roles: ['pro']
    });

    req.session.userId = String(user._id);
    req.session.user = { _id: String(user._id), firstName, lastName, email: user.email, roles: user.roles };

    res.status(201).json({ user: req.session.user, redirect: '/appointment-settings' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/login  — canonical login used everywhere
//app.post('/api/login', async (req, res) => {
  //try {
    //const { email, password } = req.body || {};
    //const user = await AuthUser.findOne({ email: String(email || '').toLowerCase().trim() });
   // if (!user) return res.status(401).json({ error: 'Invalid email or password' });

   // const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
    //if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    // set session (ObjectId string)
   // req.session.userId = String(user._id);
   // req.session.roles  = Array.isArray(user.roles) ? user.roles : [];
    //req.session.user   = {
     // _id: String(user._id),
     // email: user.email,
    //  firstName: user.firstName || '',
    //  lastName:  user.lastName  || ''
   // };

   // await req.session.save(); // ensure cookie is set before response

    //return res.json({
   //   ok: true,
   //   user: {
    //    _id: String(user._id),
    //    email: user.email,
    //    firstName: user.firstName || '',
    //    lastName: user.lastName || ''
    //  }
   // });
 // } catch (e) {
  //  console.error('[login] error', e);
 //   return res.status(500).json({ error: 'Login failed' });
 // }
//});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await AuthUser.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  req.session.userId = String(user._id);
  req.session.user = {
    _id: String(user._id),
    email: user.email,
    firstName: user.firstName || '',
    lastName:  user.lastName  || ''
  };
  await req.session.save();

  res.json({ ok: true, user: req.session.user });
});

// Simple login used by availability admin page
// Use AuthUser everywhere (not `User`) and always store the _id string
app.post('/login', express.json(), async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    // TODO: replace with your real lookup/verify
    const user = await AuthUser.findOne({ email }).lean();
    const ok = !!user; // and check password, bcrypt.compare, etc.
    if (!ok) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    // Safely (re)create session, then respond ONCE.
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.userId = String(user._id);
      req.session.roles = user.roles || [];

      req.session.save((err2) => {
        if (err2) return next(err2);
        return res.status(200).json({ ok: true, user: { id: String(user._id), roles: req.session.roles } });
      });
    });
  } catch (e) {
    next(e);
  }
});

// --- DEV ONLY: turn on admin/pro in the session ---
app.post('/dev/admin-on', (req, res) => {
  // use a stable fake ObjectId
  const fakeId = '000000000000000000000001';
  req.session.userId = req.session.userId || fakeId;
  const roles = new Set(req.session.roles || []);
  roles.add('pro'); roles.add('admin');
  req.session.roles = [...roles];
  res.json({ ok: true, userId: req.session.userId, roles: req.session.roles });
});

// Dev toggle to become admin quickly
app.get('/dev/admin-on', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ ok: false, message: 'Login first' });
  const roles = new Set(req.session.roles || []);
  roles.add('pro'); roles.add('admin');
  req.session.roles = [...roles];
  res.json({ ok: true, roles: req.session.roles, userId: String(req.session.userId) });
});


// Optional logout
app.post('/auth/logout', (req, res) => {
  req.session?.destroy(() => res.json({ ok: true }));
});

// ME (session probe)
app.get('/api/me', (req, res) => {
  const id = req.session?.userId || null;
  const u  = req.session?.user   || null;

  if (!id || !u) return res.json({ ok: false, user: null });

  res.json({
    ok: true,
    user: {
      _id: String(id),
      email:     u.email     || '',
      firstName: u.firstName || '',
      lastName:  u.lastName  || ''
    }
  });
});

// server.js (or routes/auth.js)
app.post('/api/logout', (req, res) => {
  try {
    // destroy server session
    req.session?.destroy?.(() => {});
    // clear the session cookie
    res.clearCookie('connect.sid'); // or your custom cookie name
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: true });
  }
});
// server.js (or routes file)
app.post('/api/auth/logout', (req, res) => {
  try {
    // name is "connect.sid" unless you customized it in session()
    const cookieName = (req.session?.cookie?.name) || 'connect.sid';
    req.session?.destroy(() => {
      res.clearCookie(cookieName, { path: '/' });
      res.status(200).json({ ok: true });
    });
  } catch (e) {
    res.status(200).json({ ok: true }); // still consider it logged out on client
  }
});

app.post('/api/auth/logout', (req, res) => req.session?.destroy(() => res.json({ ok:true })));
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.get('/check-login', async (req, res) => {
  try {
    if (!req.session?.userId) return res.json({ loggedIn: false });

    const u = await AuthUser.findById(req.session.userId).lean();
    if (!u) return res.json({ loggedIn: false });

    let first = (u.firstName || u.first_name || '').trim();
    let last  = (u.lastName  || u.last_name  || '').trim();
    let name  = [first, last].filter(Boolean).join(' ').trim() || (u.name || '').trim();

    // Try to enrich from Records if missing
    if (!first || !name) {
      try {
        const profile = await Record.findOne({
          deletedAt: { $exists: false },
          dataType: { $in: ['User', 'Client', 'Profile'] },
          $or: [
            { 'values.userId': String(u._id) },
            { 'values.createdBy': u._id },     // many of your records use createdBy: auth._id
            { 'values.Email': u.email },
            { 'values.email': u.email }
          ]
        }).lean();

        const pv = profile?.values || {};
        const pfFirst = (pv['First Name'] || pv.firstName || pv.first_name || '').trim();
        const pfLast  = (pv['Last Name']  || pv.lastName  || pv.last_name  || '').trim();
        const pfName  = [pfFirst, pfLast].filter(Boolean).join(' ').trim();

        if (!first && pfFirst) first = pfFirst;
        if (!last  && pfLast)  last  = pfLast;
        if (!name  && pfName)  name  = pfName;
      } catch {}
    }

    if (!name && u.email) name = u.email.split('@')[0]; // last resort
    const safeFirst = (first || name || 'there').split(' ')[0];

   req.session.user = req.session.user || {};
    if (!req.session.user.firstName) req.session.user.firstName = first;
    if (!req.session.user.lastName)  req.session.user.lastName  = last;
    if (!req.session.user.email)     req.session.user.email     = u.email;

    res.json({
      loggedIn: true,
      userId:   String(u._id),
      email:    u.email || '',
      firstName:first || '',
      lastName: last  || '',
      name, // ← include full name, useful if you want it
      roles:   req.session.roles || []
    });
  } catch (e) {
    console.error('check-login error:', e);
    res.status(500).json({ loggedIn: false });
  }
});

// server.js (or routes/auth.js)

// Example login route that your front-end calls via API.login(email, pass)
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const auth = await AuthUser.findOne({ email: String(email).toLowerCase().trim() }).lean();
    if (!auth) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, auth.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    // ⬇️ THIS is the bit you were asking about
req.session.userId = String(auth._id);
req.session.roles  = Array.isArray(auth.roles) ? auth.roles : [];
req.session.user   = { email: auth.email, firstName: auth.firstName || '', lastName: auth.lastName || '' };


    res.json({
      ok: true,
      userId: String(auth._id),
      email: auth.email,
      firstName: auth.firstName || '',
      lastName:  auth.lastName  || '',
      roles: req.session.roles
    });
  } catch (e) {
    console.error('/auth/login error', e);
    res.status(500).json({ message: 'Login failed' });
  }
});

/////////////////////////////////////////////////////////////////////
   
//Datatypes
//helper 
async function resolveDataTypeId(input) {
  if (!input) throw new Error('dataType or dataTypeId is required');

  // if already a valid ObjectId, just return it
  if (mongoose.isValidObjectId(input)) return new mongoose.Types.ObjectId(input);

  // otherwise treat as a name; look up by nameCanonical
  const dt = await DataType.findOne({ nameCanonical: canon(String(input)) }, { _id: 1 }).lean();
  if (!dt) throw new Error(`Unknown DataType: ${input}`);
  return dt._id;
}


app.get('/api/datatypes', async (req, res) => {
  const list = await DataType.find().sort({ createdAt: 1 }).lean();
  res.json(list);
});

// Create
app.post('/api/datatypes', async (req, res) => {
  const { name, description = '' } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const doc = await DataType.create({ name, description });
    res.status(201).json(doc);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Name already exists' });
    console.error(e);
    res.status(500).json({ error: 'Failed to create' });
  }
});

// Read one
app.get('/api/datatypes/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await DataType.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

// Update
app.patch('/api/datatypes/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body || {};
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
  if (name === undefined && description === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }
  try {
    const update = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (description !== undefined) update.description = String(description ?? '');

    const doc = await DataType.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
      context: 'query',
    });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Name already exists' });
    console.error(e);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// Delete
app.delete('/api/datatypes/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await DataType.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});



//Field
// ----- Fields -----
app.get('/api/fields', async (req, res) => {
  try {
    const { dataTypeId } = req.query;
    const q = { deletedAt: null };
    if (dataTypeId) q.dataTypeId = dataTypeId;

    const items = await Field.find(q)
      .sort({ createdAt: -1 })
      .populate('referenceTo', 'name')     // <-- add this
      .populate('optionSetId', 'name');    // <-- optional, for "Dropdown → SetName"

    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

//app.post('/api/fields',ensureAuthenticated, async (req, res) => {
    app.post('/api/fields', async (req, res) => {
  try {
    const { dataTypeId, name, type, allowMultiple, referenceTo, optionSetId } = req.body || {};
    if (!dataTypeId || !name || !type) {
      return res.status(400).json({ error: 'dataTypeId, name, type are required' });
    }
    if (!mongoose.isValidObjectId(dataTypeId)) {
      return res.status(400).json({ error: 'Invalid dataTypeId' });
    }
    if (type === 'Reference' && referenceTo && !mongoose.isValidObjectId(referenceTo)) {
      return res.status(400).json({ error: 'Invalid referenceTo' });
    }
    if (type === 'Dropdown' && optionSetId && !mongoose.isValidObjectId(optionSetId)) {
      return res.status(400).json({ error: 'Invalid optionSetId' });
    }

    const nameCanonical = canon(name);

    // Optional pre-check (your unique index will also enforce this)
    const dupe = await Field.findOne({ dataTypeId, nameCanonical, deletedAt: null });
    if (dupe) return res.status(409).json({ error: 'Field already exists (ignoring case/spaces)' });

    const created = await Field.create({
      dataTypeId,
      name,
      nameCanonical,
      type,
      allowMultiple: !!allowMultiple,
      referenceTo: referenceTo || null,
      optionSetId: optionSetId || null
    });
    res.status(201).json(created);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Field already exists (unique index)' });
    }
    res.status(500).json({ error: e.message });
  }
});
//app.patch('/api/fields/:id', ensureAuthenticated, async (req, res) => {
app.patch('/api/fields/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });

    const setOps = {};
    if (req.body?.name) {
      setOps.name = String(req.body.name).trim();
      setOps.nameCanonical = canon(setOps.name);
    }
    if ('defaultOptionValueId' in req.body) {
      setOps.defaultOptionValueId = req.body.defaultOptionValueId || null;
    }
    if ('allowMultiple' in req.body) {
      setOps.allowMultiple = !!req.body.allowMultiple; // optional, matches your UI if you add a toggle later
    }

    if (!Object.keys(setOps).length) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const updated = await Field.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: setOps },
      { new: true, runValidators: true, context: 'query' }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Field already exists (unique index)' });
    }
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/fields/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });

    const updated = await Field.findByIdAndUpdate(
      id,
      { deletedAt: new Date() },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Optional: server-side canon fallback (same as client helper)
function canon(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
//OptionSet

// ---------- Option Sets ----------
app.get('/api/optionsets', async (req, res) => {
  const sets = await OptionSet.find({ deletedAt: null }).sort({ createdAt: 1 }).lean();
  res.json(sets);
});

app.post('/api/optionsets', /*ensureAuthenticated,*/ async (req, res) => {
  try {
    const { name, kind = 'text' } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const created = await OptionSet.create({ name, nameCanonical: canon(name), kind });
    res.status(201).json(created);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Set name already exists' });
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/optionsets/:id', /*ensureAuthenticated,*/ async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });

    const setOps = {};
    if (req.body?.name) setOps.name = String(req.body.name).trim();
    if (req.body?.kind) setOps.kind = req.body.kind;

    if (!Object.keys(setOps).length) return res.status(400).json({ error: 'Nothing to update' });

    if (setOps.name) setOps.nameCanonical = canon(setOps.name);

    const updated = await OptionSet.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: setOps },
      { new: true, runValidators: true, context: 'query' }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Set name already exists' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/optionsets/:id', /*ensureAuthenticated,*/ async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });

    const set = await OptionSet.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );
    if (!set) return res.status(404).json({ error: 'Not found' });

    // soft-delete its values too
    await OptionValue.updateMany({ optionSetId: id, deletedAt: null }, { $set: { deletedAt: new Date() } });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const OptionSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true },
}, { _id: false });

const OptionSetSchema = new mongoose.Schema({
  name: { type: String, required: true },      // e.g. "Service Categories"
  key:  { type: String, unique: true },        // e.g. "service_categories"
  options: { type: [OptionSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AuthUser' },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.models.OptionSet || mongoose.model('OptionSet', OptionSetSchema);

// ---------- Option Values ----------
app.get('/api/optionsets/:id/values', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.json([]);
  const vals = await OptionValue.find({ optionSetId: id, deletedAt: null })
    .sort({ order: 1, createdAt: 1 })
    .lean();
  res.json(vals);
});

app.post('/api/optionsets/:id/values', /*ensureAuthenticated,*/ async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid optionSetId' });

    const { label, order = 0, imageUrl=null, numberValue=null, boolValue=null, colorHex=null } = req.body || {};
    if (!label) return res.status(400).json({ error: 'label required' });

    const created = await OptionValue.create({
      optionSetId: id,
      label,
      labelCanonical: canon(label),
      order,
      imageUrl, numberValue, boolValue, colorHex
    });
    res.status(201).json(created);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Value already exists in this set' });
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/optionvalues/:id', /*ensureAuthenticated,*/ async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });

    const setOps = {};
    if ('label' in req.body) {
      setOps.label = String(req.body.label).trim();
      setOps.labelCanonical = canon(setOps.label);
    }
    ['imageUrl','numberValue','boolValue','colorHex','order'].forEach(k => {
      if (k in req.body) setOps[k] = req.body[k];
    });

    if (!Object.keys(setOps).length) return res.status(400).json({ error: 'Nothing to update' });

    const updated = await OptionValue.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: setOps },
      { new: true, runValidators: true, context: 'query' }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Duplicate value in set' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/optionvalues/:id', /*ensureAuthenticated,*/ async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });

    const updated = await OptionValue.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



////////////////////////////////////////////////////////////////////////////////////////////////////////

                                     //Accept Appointments 
                                     // helper near the top of server.js (once)
 // ---------- helpers ----------
 //create slug 
// --- Slug helpers ---
// ---------- helpers (slug + business slug) ----------
function slugify(s = '') {
  return String(s).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')   // spaces & junk -> dashes
    .replace(/^-+|-+$/g, '') || 'business';
}

async function ensureUniqueStoreSlug(base, excludeId = null) {
  const dt = await DataType.findOne({ name: /Store/i }).lean();
  if (!dt) return base || 'store';

  let slug = base || 'store';
  let n = 2;
  const collides = async (s) => {
    const q = {
      dataTypeId: dt._id,
      deletedAt: null,
      $or: [
        { 'values.slug': s },
        { 'values.Slug': s },
        { 'values.storeSlug': s },
        { 'values["Store Slug"]': s },
      ],
    };
    if (excludeId) q._id = { $ne: excludeId };
    return !!(await Record.exists(q));
  };
  while (await collides(slug)) slug = `${base}-${n++}`;
  return slug;
}

async function ensureUniqueBusinessSlug(base, excludeId = null) {
  const dt = await DataType.findOne({ name: /Business/i }).lean();
  if (!dt) return base || 'business';

  let slug = base || 'business';
  let n = 2;

  const collides = async (s) => {
    const q = {
      dataTypeId: dt._id,
      deletedAt: null,
      $or: [{ 'values.slug': s }, { 'values.businessSlug': s }],
    };
    if (excludeId) q._id = { $ne: excludeId };
    return !!(await Record.exists(q));
  };

  while (await collides(slug)) slug = `${base}-${n++}`;
  return slug;
}

// ---------- RESERVED slugs (ONE copy only) ----------
const RESERVED = new Set([
  'api','public','uploads','qassets',
  'admin','signup','login','logout','availability',
  'appointment-settings','appqointment-settings',
  'favicon.ico','robots.txt','sitemap.xml','store'
]);

// ---------- PUBLIC RECORDS (keep ONE copy only) ----------
app.get('/public/records', async (req, res) => {
  try {
    const { dataType, limit = '500', skip = '0', sort } = req.query;
    if (!dataType) return res.status(400).json({ error: 'dataType required' });

    const dt = await getDataTypeByNameLoose(dataType);
    if (!dt) return res.json([]);

    const where = { dataTypeId: dt._id, deletedAt: null };

    if (req.query._id) where._id = req.query._id;

    for (const [k, v] of Object.entries(req.query)) {
      if (['dataType','limit','skip','sort','ts','_id'].includes(k)) continue;
      if (v !== undefined && v !== '') where[`values.${k}`] = v;
    }

    let order = { createdAt: -1 };
    if (sort) { try { order = JSON.parse(sort); } catch {} }

    const lim = Math.min(parseInt(limit, 10) || 100, 1000);
    const skp = Math.max(parseInt(skip, 10) || 0, 0);

    const rows = await Record.find(where).sort(order).skip(skp).limit(lim).lean();
    res.json(rows.map(r => ({ _id: String(r._id), values: r.values || {}, deletedAt: r.deletedAt || null })));
  } catch (e) {
    console.error('GET /public/records failed:', e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- BUSINESS JSON: /:slug.json (keep) ----------
app.get('/:slug.json', async (req, res, next) => {
  const { slug } = req.params;
  if (!slug || slug.includes('.') || RESERVED.has(slug)) return next();

  try {
    const dt = await DataType.findOne({ name: /Business/i }).lean();
    if (!dt) return res.status(404).json({ message: 'Business type not found' });

    const re = new RegExp(`^${escapeRegex(slug)}$`, 'i');

    const biz = await Record.findOne({
      deletedAt: null,
      $and: [
        { $or: [{ dataTypeId: dt._id }, { dataType: 'Business' }] },
        { $or: [
          { 'values.slug': re },
          { 'values.businessSlug': re },
          { 'values.Slug': re },
          { 'values.bookingSlug': re },
          { 'values.Business Slug': re },
          { 'values.slug ': re },
          { 'values.Slug ': re },
        ]},
      ],
    }).lean();

    if (!biz) return res.status(404).json({ message: 'Business not found' });
    res.json({ _id: biz._id, values: biz.values || {} });
  } catch (e) {
    console.error('GET /:slug.json error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- AUTH HELPERS ----------

function ensureAuthenticated(req, res, next) {
  if (req.session?.userId) return next();
  res.status(401).json({ error: "Not authenticated" });
}
function ensureRole(role) {
  return (req, res, next) => {
    const roles = req.session?.roles || [];
    if (roles.includes(role)) return next();
    res.status(403).json({ error: "Forbidden" });
  };
}

// Example protected page (unchanged)
app.get('/appointment-settings',
  ensureAuthenticated,
  ensureRole('pro'),
  (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'appointment-settings.html'));
  }
);

app.post('/auth/logout', (req, res) => {
  req.session?.destroy(() => res.json({ ok: true }));
});

// ---------- STORE JSON: /store/:slug.json ----------
// GET /store/:slug.json  -> returns { store, products }
app.get('/store/:slug.json', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const dtStore = await getDataTypeByNameLoose('Store');
    if (!dtStore) return res.status(404).json({ error: 'no-store-type' });

    const re = new RegExp(`^${escapeRegex(slug)}$`, 'i');

    const store = await Record.findOne({
      dataTypeId: dtStore._id,
      deletedAt: null,
      $or: [
        { 'values.slug': re },
        { 'values.Slug': re },
        { 'values.storeSlug': re },
      ],
    }).lean();

    if (!store) return res.status(404).json({ error: 'store-not-found' });

    const dtProduct = await getDataTypeByNameLoose('Product');
    let products = [];
    if (dtProduct) {
      products = await Record.find({
        dataTypeId: dtProduct._id,
        deletedAt: null,
        $or: [
          { 'values.Store._id': String(store._id) }, // your reference field
          { 'values.storeId': String(store._id) },   // optional fallback
        ],
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
    }

    res.json({
      store: {
        _id: String(store._id),
        values: store.values || {},
      },
      products: products.map(p => ({ _id: String(p._id), values: p.values || {} })),
    });
  } catch (e) {
    console.error('GET /store/:slug.json error', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// ---------- HELPERS (do NOT redefine getDataTypeByNameLoose) ----------
async function getStoreBySlug(slug) {
  // TODO: replace with real DB lookup
  // Example with your Records schema (uncomment if you have it):
  // return await Records.findOne({ typeName:'Store', 'values.slug': slug, deletedAt: null }).lean();
  if (slug === 'demo') {
    return { _id: 'x1', values: { Name: 'Demo Store', slug, Description: 'Welcome to the demo!' } };
  }
  return null;
}
async function listProductsForStore(storeId, limit = 60) {
  // TODO: replace with real DB lookup
  // return await Records.find({ typeName:'Product', 'values.Store._id': storeId, deletedAt: null }).limit(limit).lean();
  return [
    { values: { Title: 'Silk Press', Price: 85, Description: 'Shine + body', 'Default Image': '' } },
    { values: { Title: 'Braid Set',  Price: 120, Description: 'Protective style', 'Default Image': '' } },
  ];
}

async function getBusinessBySlug(slug){
  const dt = await getDataTypeByNameLoose('Business');
  if (!dt) return null;
  const re = new RegExp(`^${escapeRegex(slug)}$`, 'i');
  return await Record.findOne({
    deletedAt: null,
    dataTypeId: dt._id,
    $or: [
      { 'values.slug': re },
      { 'values.Slug': re },
      { 'values.businessSlug': re },
      { 'values.bookingSlug': re },
      { 'values["Business Slug"]': re },
    ],
  }).lean();
}

async function getDataTypeByName(typeName) {
  return DataType.findOne({ name: typeName, deletedAt: null });
}


// --- CREATE a record: POST /api/records/:typeName ---
const { isValidObjectId } = mongoose;
// must come AFTER app.use(express.json()) and app.use(session(...))
// after: app.use(cookieParser()); app.use(session(...)); app.use(express.json());




// --- GET one record: GET /api/records/:typeName/:id ---
// GET one record by id (pros/admins can read any)
// GET one record by id (pros/admins can read any)
// helper to pull an id out of {_id} / {id} / string
function xId(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (val._id) return String(val._id);
  if (val.id)  return String(val.id);
  return null;
}

async function canReadAppointment(session, apptRec) {
  const uid   = String(session.userId || '');
  const roles = session.roles || [];
  if (!uid) return false;
  if (String(apptRec.createdBy) === uid) return true;
  if (roles.includes('admin')) return true;

  // Pro on the appointment
  const proId = xId(
    apptRec.values?.Pro ||
    apptRec.values?.['Pro Ref'] ||
    apptRec.values?.Staff ||
    apptRec.values?.['Staff Ref']
  );
  if (proId && proId === uid) return true;

  // Pro via the Calendar
  const calId = xId(apptRec.values?.Calendar);
  if (calId) {
    const calDT = await DataType.findOne({ name: /Calendar/i, deletedAt: null }).lean();
    if (calDT) {
      const cal = await Record.findOne({ _id: calId, dataTypeId: calDT._id, deletedAt: null }).lean();
      const calProId = xId(
        cal?.values?.Pro ||
        cal?.values?.['Pro Ref'] ||
        cal?.values?.Staff ||
        cal?.values?.['Staff Ref']
      );
      if (calProId && calProId === uid) return true;
    }
  }

  // Business owner
  const bizId = xId(apptRec.values?.Business);
  if (bizId) {
    const bizDT = await DataType.findOne({ name: /Business/i, deletedAt: null }).lean();
    if (bizDT) {
      const biz = await Record.findOne({ _id: bizId, dataTypeId: bizDT._id, deletedAt: null }).lean();
      if (biz && String(biz.createdBy) === uid) return true;
    }
  }
  return false;
}

// --- GET one record: GET /api/records/:typeName/:id ---
app.get('/api/records/:typeName/:id', ensureAuthenticated, async (req, res) => {
  try {
    const dt = await getDataTypeByName(req.params.typeName);
    if (!dt) return res.status(404).json({ error: `Data type "${req.params.typeName}" not found` });

    // ⚠️ removed createdBy filter here
    const item = await Record.findOne({
      _id: req.params.id,
      dataTypeId: dt._id,
      deletedAt: null
    });

    if (!item) return res.status(404).json({ error: 'Not found' });

    // Only gate by role/ownership for Appointments
    if (/Appointment/i.test(dt.name)) {
      const ok = await canReadAppointment(req.session, item);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else {
      // for other types keep creator restriction if you want:
      if (String(item.createdBy) !== String(req.session.userId) && !(req.session.roles||[]).includes('admin')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/records/:type/:id', async (req, res) => {
  try {
    const typeName = String(req.params.type || '').trim();
    const id = String(req.params.id || '').trim();

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    // Try to constrain by dataTypeId when possible
    let q = { _id: id, deletedAt: null };

    try {
      const dt = await getDataTypeByNameLoose(typeName);
      if (dt?._id) q.dataTypeId = dt._id;
      else q.dataType = typeName; // fallback if your records store dataType string
    } catch {
      q.dataType = typeName;
    }

    const rec = await Record.findOne(q).lean();
    if (!rec) return res.status(404).json({ error: 'Not found' });

    res.json({ _id: rec._id, values: rec.values || {} });
  } catch (e) {
    console.error('GET /api/records/:type/:id error:', e);
    res.status(500).json({ error: 'server_error' });
  }
});


app.get('/api/records/:typeName', ensureAuthenticated, async (req, res) => {
  try {
    const dt = await getDataTypeByNameLoose(req.params.typeName);
    if (!dt) return res.status(404).json({ error: `Data type "${req.params.typeName}" not found` });

    const roles  = req.session?.roles || [];
    const isPriv = roles.includes('pro') || roles.includes('admin');

    const base = { dataTypeId: dt._id, deletedAt: null };
    if (!isPriv) base.createdBy = req.session.userId;

    let where = {};
    if (req.query.where) { try { where = JSON.parse(req.query.where); } catch {} }
    where = await normalizeWhereForType(dt._id, where);

    let sort = { createdAt: -1 };
    if (req.query.sort) { try { sort = await normalizeSortForType(dt._id, JSON.parse(req.query.sort)); } catch {} }

    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const skip  = Math.max(parseInt(req.query.skip  || '0',   10), 0);

    console.log('[GET many]', { type: req.params.typeName, roles, isPriv });
    const items = await Record.find({ ...base, ...where }).sort(sort).skip(skip).limit(limit);
    res.json(items);
  } catch (e) {
    console.error('GET /api/records error:', e);
    res.status(500).json({ error: e.message });
  }
});


function oid(x) {
  if (!x) return null;
  try { return new mongoose.Types.ObjectId(String(x)); } catch { return null; }
}

async function propagateProfileToCRM({ userId, firstName, lastName, email, phone }, prevEmail = '') {
  try {
    const clientDT = await DataType.findOne({ name: /Client/i, deletedAt: null }).lean();
    const apptDT   = await DataType.findOne({ name: /Appointment/i, deletedAt: null }).lean();
    const userDT   = await DataType.findOne({ name: /User/i,    deletedAt: null }).lean();
    if (!clientDT) return { clients: 0, appts: 0 };

    const norm = s => (s || '').trim();
    const em   = norm(email).toLowerCase();
    const pem  = norm(prevEmail).toLowerCase();

    // 🔎 Resolve the "User" DataType record(s) by email (not AuthUser _id)
    let userRecIds = [];
    if (userDT && (em || pem)) {
      const userRecs = await Record.find({
        dataTypeId: userDT._id,
        deletedAt: null,
        'values.Email': { $in: [em, pem].filter(Boolean) }
      }, { _id: 1 }).lean();
      userRecIds = userRecs.map(r => r._id);
    }

    // 1) Find Client records via Linked User (User record id) OR Email (old/new)
    const clientMatch = {
      dataTypeId: clientDT._id,
      deletedAt: null,
      $or: [
        // Linked User references a User record (all shapes)
        ...(userRecIds.length ? [
          { 'values.Linked User':      { $in: userRecIds } },
          { 'values.Linked User._id':  { $in: userRecIds.map(String) } },
          { 'values.Linked User':      { $in: userRecIds.map(String) } },
        ] : []),
        // Email match (old/new)
        ...(em  ? [{ 'values.Email': em  }] : []),
        ...(pem ? [{ 'values.Email': pem }] : []),
      ]
    };

    const clients = await Record.find(clientMatch).lean();
    if (!clients.length) return { clients: 0, appts: 0 };

    const clientIds = clients.map(c => c._id);

    // 2) Update Clients if different
    for (const c of clients) {
      const v = c.values || {};
      const setOps = {};
      if (firstName && norm(v['First Name'])   !== norm(firstName)) setOps['values.First Name']   = firstName;
      if (lastName  && norm(v['Last Name'])    !== norm(lastName))  setOps['values.Last Name']    = lastName;
      if (phone     && norm(v['Phone Number']) !== norm(phone))     setOps['values.Phone Number'] = phone;
      if (em        && norm(v['Email']).toLowerCase() !== em)       setOps['values.Email']        = em;

      const full = [firstName, lastName].filter(Boolean).join(' ').trim();
      if (full && norm(v['Client Name']) !== norm(full))            setOps['values.Client Name']  = full;

      if (Object.keys(setOps).length) {
        await Record.updateOne({ _id: c._id }, { $set: setOps });
      }
    }

    // 3) Update denormalized fields on Appointments that reference those clients
    if (!apptDT) return { clients: clients.length, appts: 0 };

    const setAppt = {
      ...(firstName ? { 'values.Client First Name': firstName } : {}),
      ...(lastName  ? { 'values.Client Last Name':  lastName  } : {}),
      ...(em        ? { 'values.Client Email':      em        } : {}),
    };
    const full = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (full) setAppt['values.Client Name'] = full;

    if (Object.keys(setAppt).length) {
      const r = await Record.updateMany(
        {
          dataTypeId: apptDT._id,
          deletedAt: null,
          $or: [
            { 'values.Client':       { $in: clientIds } },                 // ObjectId stored directly
            { 'values.Client._id':   { $in: clientIds.map(String) } },     // {_id:"..."}
            { 'values.Client':       { $in: clientIds.map(String) } },     // plain string id
          ]
        },
        { $set: setAppt }
      );
      return { clients: clients.length, appts: r.modifiedCount || r.nModified || 0 };
    }

    return { clients: clients.length, appts: 0 };
  } catch (e) {
    console.error('[propagateProfileToCRM] error:', e);
    return { clients: 0, appts: 0 };
  }
}


// --- UPDATE record (replace or merge values): PATCH /api/records/:typeName/:id ---
app.patch('/api/records/:typeName/:id', ensureAuthenticated, async (req, res) => {
  try {
    const typeName = req.params.typeName;
    const dt = await getDataTypeByNameLoose(typeName);
    if (!dt) return res.status(404).json({ error: `Data type "${typeName}" not found` });

    const roles = req.session?.roles || [];
    const isPriv = roles.includes('pro') || roles.includes('admin');

    const rawValues = req.body?.values || {};
    if (/^appointment$/i.test(typeName)) await enrichAppointment(rawValues);
    const values = await normalizeValuesForType(dt._id, rawValues);

    const setOps = Object.fromEntries(Object.entries(values).map(([k,v]) => [`values.${k}`, v]));

    const q = { _id: req.params.id, dataTypeId: dt._id, deletedAt: null };
    if (!isPriv) q.createdBy = req.session.userId;   // gate only non-privileged

    const updated = await Record.findOneAndUpdate(q, { $set: setOps }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) {
    console.error('PATCH error', e);
    res.status(500).json({ error: e.message });
  }
});

// --- SOFT DELETE record: DELETE /api/records/:typeName/:id ---

app.delete('/api/records/:typeName/:id', ensureAuthenticated, async (req, res) => {
  try {
    const dt = await getDataTypeByNameLoose(req.params.typeName);
    if (!dt) return res.status(404).json({ error: `Data type "${req.params.typeName}" not found` });

    const roles = req.session?.roles || [];
    const isPriv = roles.includes('pro') || roles.includes('admin');

    const q = { _id: req.params.id, dataTypeId: dt._id, deletedAt: null };
    if (!isPriv) q.createdBy = req.session.userId;

    const updated = await Record.findOneAndUpdate(q, { $set: { deletedAt: new Date() } }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE error', e);
    res.status(500).json({ error: e.message });
  }
});
// 1) Upload a single file, return a URL
app.post('/api/upload', ensureAuthenticated, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// 2) Compute a unique slug for a type, scoped to current user
app.post('/api/slug/:typeName', ensureAuthenticated, async (req, res) => {
  try {
    const dt = await getDataTypeByName(req.params.typeName);
    if (!dt) return res.status(404).json({ error: `Data type "${req.params.typeName}" not found` });

    const base = String(req.body.base || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
    const excludeId = req.body.excludeId || null;

    let slug = base || 'item';
    let i = 1;

    const baseQuery = {
      dataTypeId: dt._id,
      'values.slug': slug,
      createdBy: req.session.userId,
      deletedAt: null
    };
    if (excludeId) baseQuery._id = { $ne: excludeId };

    // bump suffix until free
    while (await Record.exists(baseQuery)) {
      slug = `${base}${i++}`;
      baseQuery['values.slug'] = slug;
    }

    res.json({ slug });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



// ---------- GET RECORDS BY TYPE NAME (keeps your old front-end calls working) ----------
app.get('/get-records/:typeName', ensureAuthenticated, async (req, res) => {
  try {
    const dt = await getDataTypeByName(req.params.typeName); // ✅ fixed name
    if (!dt) return res.json([]);

    const q = {
      dataTypeId: dt._id,
      deletedAt: null,
      createdBy: req.session.userId
    };

    // (Optional improvement: resolve the Business datatype and match referenceTo by its _id)

    const rows = await Record.find(q).sort({ createdAt: -1 });
    const out = rows.map(r => ({ _id: r._id, values: r.values || {} }));
    res.json(out);
  } catch (e) {
    console.error('get-records error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});


                               // ----- Records -----
app.get('/api/records', async (req, res) => {
  try {
    const { dataTypeId } = req.query;
    const q = dataTypeId ? { dataTypeId } : {};
    const items = await Record.find(q).sort({ createdAt: -1 });
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});



const requireAuthIfYouHaveIt = (req, _res, next) => next(); // temporary pass-through


const toObjectId = (v) => {
  if (!v) return undefined;
  try { return new mongoose.Types.ObjectId(String(v)); }
  catch { return undefined; }
};




// GET /api/public/booking-page-by-slug/:slug
app.get('/api/public/booking-page-by-slug/:slug', async (req,res) => {
  try {
    const slug = req.params.slug.trim().toLowerCase();
    const biz = await Records.findOne({ typeName:'Business', 'values.slug': slug, deletedAt: null });
    if (!biz) return res.status(404).json({ error:'Business not found' });

    const bizId = biz._id.toString();
    const selectedId = biz.values?.selectedBookingPageId || '';

    const pages = await Records.find({
      typeName: 'CustomBookingPage',
      deletedAt: null,
      $or: [
        { 'values.businessId': bizId },
        { 'values.Business': bizId },      // flexible keying
        { 'values.ownerId': bizId }
      ]
    }).lean();

    // helpers
    const isPublished = r => !!pickPublishedFlag(r.values||{});
    const byBiz = r => true; // already filtered by biz above
    const byTimeDesc = (a,b) => pickTime(b.values||{}) - pickTime(a.values||{});

    // 1) selected and published?
    let chosen = pages.find(p => p._id.toString() === selectedId && isPublished(p));

    // 2) else latest published
    if (!chosen){
      const published = pages.filter(isPublished).sort(byTimeDesc);
      chosen = published[0] || null;
    }

    if (chosen){
      const jsonStr = pickJson(chosen.values||{});
      return res.json({
        kind: 'custom',
        businessId: bizId,
        pageId: chosen._id,
        json: jsonStr
      });
    }

    // 3/4) fallbacks
    return res.json({
      kind: 'template',
      businessId: bizId,
      templateKey: biz.values?.templateKey || 'basic'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:'Resolver failed' });
  }
});


//send email confirmation to clients after booking an appointment
// POST /api/appointments/:id/send-confirmation  (Resend)
app.post('/api/appointments/:id/send-confirmation', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ message: 'Missing id' });

    const appt = await Record.findById(id).lean();
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    const v = appt.values || {};

    // pull related labels
    const bizId  = objIdFromRef(v['Business']);
    const serv   = Array.isArray(v['Service(s)']) ? v['Service(s)'][0] : v['Service(s)'];
    const servId = objIdFromRef(serv);

    const clientEmail = (v['Client Email'] || v['Email'] || '').trim();
    const clientName  = (v['Client Name']
                      || [v['Client First Name'], v['Client Last Name']].filter(Boolean).join(' ').trim()
                      || '').trim();
    if (!clientEmail) return res.status(400).json({ message: 'No client email on record' });

    let businessName = '';
    let locationText = '';
    if (bizId) {
      const biz = await Record.findById(bizId).lean();
      const bv  = biz?.values || {};
      businessName = bv['Business Name'] || bv['Name'] || bv['businessName'] || '';
      locationText = bv['Address'] || bv['Location'] || '';
    }

    let serviceName = 'Appointment';
    if (servId) {
      const srec = await Record.findById(servId).lean();
      const sv   = srec?.values || {};
      serviceName = sv['Service Name'] || sv['Name'] || serviceName;
    }

    const date = v['Date'];        // "YYYY-MM-DD"
    const time = v['Time'];        // "HH:MM" 24h
    const dur  = Number(v['Duration'] ?? 60) || 60;

    const subject = `Your ${serviceName} on ${prettyDate(date)} at ${to12h(time)}`;
    const manageUrl = `${process.env.PUBLIC_BASE_URL || ''}/manage/${appt._id}`; // adjust if you have a real page

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45">
        <p>Hi ${clientName || 'there'},</p>
        <p>Thanks for booking <strong>${serviceName}</strong> with <strong>${businessName}</strong>.</p>
        <p><strong>When:</strong> ${prettyDate(date)} at ${to12h(time)} (${dur} min)<br/>
           ${locationText ? `<strong>Where:</strong> ${locationText}<br/>` : ''}
           <a href="${manageUrl}">Manage your appointment</a>
        </p>
        <p>We attached a calendar invite so you can add this to your calendar.</p>
        <p>See you soon!</p>
      </div>
    `;

    let icsBuffer = null;
    try {
      icsBuffer = await makeIcsBuffer({
        title: `${serviceName} — ${businessName}`,
        description: v['Note'] || '',
        location: locationText,
        startISO: new Date(`${date}T${time}:00`),
        durationMin: dur,
        organizerName: businessName,
        organizerEmail: (process.env.MAIL_FROM || '').match(/<([^>]+)>/)?.[1] || process.env.MAIL_FROM
      });
    } catch (e) {
      console.warn('ICS generation failed:', e);
    }

    await sendBookingEmailWithResend({
      to: clientEmail,
      subject,
      html,
      icsBuffer,
      // cc: ['pro@yourdomain.com'],       // optional
      // replyTo: 'replies@yourdomain.com' // optional
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('send-confirmation (Resend) failed:', e);
    res.status(500).json({ message: 'Email failed' });
  }
});


app.post('/api/appointments/book', async (req, res) => {
  try {
    const values = req.body?.values || {};
    if (!values['Business'] || !values['Calendar'] || !values['Date'] || !values['Time']) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // keep your enrichment
    await enrichAppointment(values);

    const apptDT = await getDataTypeByNameLoose('Appointment');
    const rec = await Record.create({
      dataTypeId: apptDT?._id,
      values,
      createdBy: req.session.userId || null
    });

    // reuse the sender above:
    req.params.id = String(rec._id);
    await (async () => {
      // call the same logic inline instead of HTTP hopping
      const fakeReq = { params:{ id: req.params.id } };
      const fakeRes = { json:()=>{}, status:()=>({ json:()=>{} }) };
      // Easiest: directly call the function body from the other route,
      // or extract that logic into a helper and call it here.
    })();

    res.status(201).json(rec);
  } catch (e) {
    console.error('book route failed:', e);
    res.status(500).json({ message: 'Booking failed' });
  }
});
///////////////////////////////////////////////////////////////////
//availability







///////////////////////////////////////////////////////////////////
// Store Page

// Price lookup helper (DO NOT trust client)
async function getProductsTotalCents(items){
  // items = [{id:"p1"}, ...]
  // Lookup each product in DB and sum server-side prices
  let total = 0;
  for (const it of items){
    const rec = await Records.findOne({ _id: it.id, typeName:'Product', deletedAt:null }).lean();
    if (!rec) continue;
    const cents = Number(rec.values?.Price ?? 0);
    total += cents;
  }
  return total;
}

// POST /api/store/checkout-intent
app.post('/api/store/checkout-intent', async (req,res) => {
  try {
    const { items = [], storeId } = req.body || {};
    const amount = await getProductsTotalCents(items);
    if (!amount || amount < 50) return res.status(400).json({ error: 'Invalid amount' });

    const pi = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { storeId, itemIds: items.map(i=>i.id).join(',') }
    });

    res.json({ clientSecret: pi.client_secret });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:'intent_failed' });
  }
});

// POST /webhooks/stripe
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req,res)=>{
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    // 1) Create order record
    // 2) Send receipt / deliver digital product via Resend
  }
  res.json({received: true});
});






                           //Page Routes
//Index page 
   app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

//Admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html')); 
});

  //Signup page 
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));

  

// Pretty URLs protected by auth
app.get('/appointment-settings', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'appointment-settings.html'));
});

app.get('/appqointment-settings', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'appqointment-settings.html'));
});

// (Optional) keep old links working
app.get(['/appointment-settings', '/appointment-settings.html'], (req, res) => {
  res.redirect('/appointment-settings');
});

// Availability Page
app.get('/availability', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'availability.html'));
});

//calendar page 
app.get('/calendar', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'calendar.html'));
});



//clients page 
app.get('/clients', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'clients.html'));
});

//menu page 
app.get('/menu', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});

//booking-page page 
app.get('/booking-page', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'booking-page.html'));
});
app.get('/store/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const store = await getStoreBySlug(slug);
    if (!store) return next(); // fall through to 404

    const products = await listProductsForStore(String(store._id), 60);
    res.render('store', {
      title: store.values?.Name || store.values?.slug || 'Store',
      store,
      products,
    });
  } catch (e) { next(e); }
});
////////////////////////////////////
//calendar page 
app.get('/custom-booking', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'custom-booking.html'));
});


//////////////////////////////////

//Client-board page 
app.get('/client-dashboard', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'client-dashboard.html'));
});

});
// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));


// ---------- CATCH-ALL PAGE ROUTE (ONE copy only) ----------
// ----- STORE PAGE (EJS) -----
app.get('/store/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;

    // TODO: real DB lookup
    const store = { _id:'x1', values:{ Name:'Demo Store', slug, Description:'Welcome!' } };
    const products = [
      { values:{ Title:'Silk Press', Price:85, Description:'Shine + body' } },
      { values:{ Title:'Braid Set', Price:120, Description:'Protective style' } },
    ];

    return res.render('store', {
      title: store.values?.Name || slug,
      store,
      products,
    });
  } catch (e) { next(e); }
});

// ----- BOOKING PAGE (EJS) -----
app.get('/book/:slug', (req, res) => {
  const { slug } = req.params;
  return res.render('booking-page', { slug });
});

// Global error handler (last middleware)
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err); // delegate to default Express handler
  res.status(500).json({ ok: false, error: err.message || 'Server error' });
});
 