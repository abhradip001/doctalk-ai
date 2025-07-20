# 🏥 AI-Powered Clinic Website

A full-stack web application built using the **MERN stack (MongoDB, Express, Node.js, JavaScript, and EJS)** with an integrated AI Assistant for smart symptom assessment, doctor recommendation, online consultation, and automated health reports.

---

## 📌 Features

- 🔐 Patient & Admin Login/Register
- 🧠 AI Assistant (Mic + Camera)
- 💬 Symptom chat with GPT-based suggestions
- 👨‍⚕️ Smart doctor matching
- 💳 Secure appointment booking with payment
- 📹 Real-time video consultation
- 📄 Auto-generated health report (PDF)
- 🛠️ Admin dashboard to manage doctors & bookings

---

## 🧱 Tech Stack

| Layer      | Technology               |
|------------|--------------------------|
| Frontend   | EJS, HTML, CSS, JS       |
| Backend    | Express.js, Node.js      |
| Database   | MongoDB + Mongoose       |
| AI Model   | OpenAI GPT, Whisper      |
| Payments   | Razorpay / Stripe        |
| Video Call | google Meet / Zoom SDK    |
| Reports    | PDFKit / pdf_make         |

---

## 🗂️ Folder Structure

project-root/
├── backend/
│ └── controllers, routes, models, services
├── frontend/
│ └── views (EJS), public/
├── ai-modules/
│ └── nlp-processor.js, speech-to-text.js
├── docs/
│ └── API_DOCS.md, FLOW_DIAGRAMS.md
└── README.md


---

## ⚙️ Setup Instructions

1. Clone the repo  
  git clone https://github.com/abhradip001/doctalk-ai.git


2. Install dependencies  
   `npm install`

3. Add `.env` file for API keys (MongoDB, OpenAI, etc.)

4. Start server  
   `node server.js`

---

## 👨‍💼 Admin Login

- Email: `admin@clinic.com`  
- Password: `admin123`

---

## 📸 Screenshots

*(Insert screenshots of home, AI assistant, doctor booking, etc.)*

---

## 📃 License

MIT © 2025 [Your Name]
