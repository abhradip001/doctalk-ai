const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const aiRoutes = require('./routes/aiRoutes');

app.use('/api/ai', aiRoutes);
dotenv.config();
const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'frontend', 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'frontend', 'views'));

// DB connect
const connectDB = require('./backend/config/database');
connectDB(); 

// Routes
const authRoutes = require('./backend/routes/authRoutes');
app.use('/auth', authRoutes);

// Home Route (Only ONE of these)
app.get('/', (req, res) => {
  res.render('shared/home');  // ✅ Or use 'auth/login'
});

// Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
