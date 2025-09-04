const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');

dotenv.config();
const app = express();

// If deployed behind a proxy (Railway/Render/Heroku), keep this
app.set('trust proxy', 1);

// ---------- Core middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Static: uploads (profile photos, degrees, prescriptions, health records, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Static: public assets
app.use(express.static(path.join(__dirname, 'frontend', 'public')));

// ---------- View engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'frontend', 'views'));

// ---------- Session ----------
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
      httpOnly: true,
      secure: false, // set true only in HTTPS prod + trust proxy
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  })
);

// Make user available in EJS + controllers
app.use((req, res, next) => {
  const u = req.session.user || null;
  res.locals.currentUser = u;
  req.user = u;
  next();
});

// ---------- DB ----------
const connectDB = require('./backend/config/database');
connectDB();

// ---------- Routes ----------
app.use('/auth', require('./backend/routes/authRoutes'));
app.use('/api/ai', require('./backend/routes/aiRoutes'));
app.use('/patient', require('./backend/routes/patientRoutes'));
app.use('/doctor', require('./backend/routes/doctorRoutes'));
app.use('/admin', require('./backend/routes/adminRoutes'));
app.use('/health-records', require('./backend/routes/healthRecordRoutes')); // 👈 NEW
app.use('/', require('./backend/routes/dashboardRoutes'));

// ---------- Home ----------
app.get('/', (req, res) => {
  res.render('shared/home', { title: 'Clinic-AI Home' });
});

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).render('shared/404', {
    title: 'Not Found',
    url: req.originalUrl,
  });
});

// ---------- Start ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
