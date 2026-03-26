# DOJ Auto-Fillup System v2.0 - Node.js Edition

A production-grade, secure document auto-generation system with Express.js backend, EJS templating, MongoDB rate limiting, and comprehensive security measures. Generates high-resolution PNG documents for FiveM roleplay servers.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Security Features](#security-features)
- [Rate Limiting](#rate-limiting)
- [Project Structure](#project-structure)
- [Technologies](#technologies)
- [Troubleshooting](#troubleshooting)

---

## ✨ Features

### Core Features
- **5 Document Types**: Birth Certificate, Marriage Certificate, Business Permit, Original Land Title, Transfer Land Title
- **Live Preview Canvas**: Real-time document preview as you type
- **Client-Side Rendering**: Canvas rendering happens in the browser (no server strain)
- **High Resolution**: Generates 2480x3508px PNG documents

### Security Features
- **Rate Limiting**: 50 requests/hour per user (IP + Session tracking via MongoDB)
- **Input Validation**: Sanitized form inputs with express-validator
- **XSS Protection**: EJS template escaping + Helmet.js CSP headers
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, HSTS
- **CORS Protection**: Configurable CORS settings
- **Session Management**: Secure HTTP-only cookies with expiration

### Infrastructure
- **Express.js**: Lightweight, production-ready web framework
- **EJS Templating**: Clean, modular view templates
- **MongoDB Integration**: Optional persistent rate limiting storage
- **Compression**: Response compression for faster delivery
- **Logging**: Morgan HTTP request logging
- **Error Handling**: Global error handler with environment-aware responses

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Client (Browser)              │
│   - HTML5 Forms (EJS Rendered)          │
│   - Canvas API for Document Rendering   │
│   - Vanilla JavaScript (app.js)         │
│   - CSS3 Styling                        │
└────────────────┬────────────────────────┘
                 │ HTTP Requests
                 ▼
┌─────────────────────────────────────────┐
│        Express.js Server                │
├──────────────────────────────────────── ┤
│  Middleware Stack:                      │
│  ├─ Helmet (Security Headers)           │
│  ├─ Morgan (Logging)                    │
│  ├─ Session Management                  │
│  ├─ Rate Limiting (IP + Session)        │
│  ├─ Input Validation & Sanitization     │
│  └─ Error Handling                      │
├──────────────────────────────────────── ┤
│  Routes:                                │
│  ├─ GET /           → Render Form       │
│  ├─ POST /api/generate → Validate       │
│  ├─ GET /health     → Health Check      │
│  └─ Static Assets   → /public           │
└────────────────┬────────────────────────┘
                 │ Documents & Assets
                 ▼
         ┌───────────────┐
         │    MongoDB    │
         │ (Rate Limits) │
         └───────────────┘
```

---

## 🚀 Installation

### Prerequisites
- **Node.js** v16.0.0 or higher
- **npm** or **yarn** (comes with Node.js)
- **MongoDB** (optional, for persistent rate limiting) - MongoDB Atlas connection string

### Step 1: Clone the Repository

```bash
git clone https://github.com/Kwts30/DOJ_Auto-FIllup_System.git
cd DOJ_Auto-FIllup_System
```

### Step 2: Install Dependencies

```bash
npm install
```

Expected output: `added 138 packages, found 0 vulnerabilities`

### Step 3: Create Environment File

```bash
cp .env.example .env
```

Edit `.env` and configure variables (see [Configuration](#configuration))

### Step 4: Start the Server

```bash
npm start
```

Expected output:
```
╔════════════════════════════════════════╗
║   DOJ Auto-Fillup System v2.0.0       ║
║   🚀 Server running on port 3000      ║
║   📊 Rate Limit: 50 requests/hour      ║
║   🗄️  MongoDB: Connected              ║
║   🔗 http://localhost:3000             ║
╚════════════════════════════════════════╝
```

Open your browser to **http://localhost:3000**

---

## ⚙️ Configuration

### Environment Variables (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB (for rate limiting persistence)
MONGODB_URI=mongodb://localhost:27017/doj-auto-fillup
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/doj-auto-fillup

# Rate Limiting
RATE_LIMIT_WINDOW=3600        # 1 hour in seconds
RATE_LIMIT_MAX_REQUESTS=50    # 50 requests per hour per user

# Session
SESSION_SECRET=your-super-secret-key-change-in-production
```

### Development vs Production

**Development** (NODE_ENV=development):
- Request logging enabled
- Detailed error messages with stack traces
- Live reload recommended (use `npm run dev` with nodemon)

**Production** (NODE_ENV=production):
- Errors don't expose stack traces
- HTTPS enforced
- Secure cookies only
- Rate limiting strictly enforced

### MongoDB Setup

**Local MongoDB:**
```bash
# If you have MongoDB installed locally
docker run -d -p 27017:27017 --name mongo mongo:latest
```

**MongoDB Atlas (Cloud):**
1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a cluster
3. Get connection string
4. Set `MONGODB_URI` in `.env`

---

## 📖 Usage

### For End Users

1. Open http://localhost:3000
2. Choose document type from sidebar (Birth, Marriage, Business, Land Title)
3. Fill in required fields
4. Watch live preview update in real-time
5. Click "Generate [Document]" to download PNG
6. Repeat up to 50 times per hour

### For Developers

**Development with Live Reload:**
```bash
npm run dev
# Opens with nodemon for auto-restart on file changes
```

**Production Deployment:**
```bash
NODE_ENV=production npm start
```

**Health Check:**
```bash
curl http://localhost:3000/health
# Returns: {"status":"healthy","uptime":123.45,"version":"2.0.0"}
```

---

## 🔌 API Endpoints

### GET /
Renders the main form page.

**Response:** HTML (200 OK)

```bash
curl http://localhost:3000/
```

### POST /api/generate
Validates form data and returns validation status.

**Request Body:**
```json
{
  "formType": "birth",
  "state_file_num": "123456",
  "name_first": "John",
  "name_last": "Doe",
  ...
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Form validated successfully",
  "formType": "birth",
  "timestamp": "2025-03-26T04:30:00.000Z"
}
```

**Response (Missing Fields):**
```json
{
  "error": "Missing required fields",
  "missingFields": ["state_file_num", "name_first"],
  "message": "Please fill in: state_file_num, name_first"
}
```

**Response (Rate Limited):**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 50 requests per hour allowed.",
  "retryAfter": 3600
}
```

### GET /api/status
Returns API status and available formats.

**Response:**
```json
{
  "status": "ok",
  "version": "2.0.0",
  "timestamp": "2025-03-26T04:30:00.000Z",
  "availableFormats": ["birth", "marriage", "business", "origland", "transferland"]
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600.5,
  "timestamp": "2025-03-26T04:30:00.000Z",
  "version": "2.0.0"
}
```

---

## 🔒 Security Features

### Rate Limiting (50/hour per user)

**Tracking Method:** IP Address + Session ID

```
Max Requests: 50 per hour
Window: 3600 seconds
Identifier: {IP}:{SessionID}
Storage: MongoDB (optional)
Headers Returned:
  - X-RateLimit-Limit: 50
  - X-RateLimit-Remaining: 47
  - X-RateLimit-Reset: 2025-03-26T05:30:00Z
  - Retry-After: 3600
```

**Example Rate Limit Response (429 Too Many Requests):**
```bash
curl http://localhost:3000/ -H "X-Forwarded-For: 192.168.1.1"
# After 50 requests in 1 hour from same IP

HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 0
Retry-After: 3600

{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 50 requests per hour allowed.",
  "retryAfter": 3600
}
```

### Input Validation & Sanitization

- **XSS Prevention**: HTML escaping on all user inputs
- **Max Length**: 500 characters per field
- **Pattern Matching**: Rejects suspicious patterns:
  - `<script>`, `javascript:`, `onerror`, `onclick`, `<iframe>`, `eval`

### Security Headers (Helmet.js)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' cdnjs.cloudflare.com; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### HTTPS in Production

Recommended: Use behind a reverse proxy (nginx, Caddy) with HTTPS.

---

## 📊 Rate Limiting Details

### How It Works

1. **Request arrives** → Middleware extracts IP and session ID
2. **Check MongoDB** → Count requests from this identifier in last hour
3. **Limit check** → If count >= 50, return 429
4. **Allow request** → Record timestamp in database
5. **Database cleanup** → TTL index auto-deletes records after 1 hour

### Resetting Limits

Limits automatically reset after 1 hour. No admin action needed.

To manually reset (if needed):
```bash
# Connect to MongoDB
mongo doj-auto-fillup

# Clear rate limit collection
db.rate_limit.deleteMany({})
```

---

## 📁 Project Structure

```
DOJ_Auto-FIllup_System/
├── server.js                    # Main Express entry point
├── package.json                 # Dependencies & scripts
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
│
├── views/                       # EJS Templates
│   ├── index.ejs                # Main layout
│   └── partials/
│       ├── header.ejs
│       ├── sidebar.ejs
│       ├── footer.ejs
│       ├── modals.ejs
│       ├── overlay.ejs
│       └── forms/
│           ├── birth.ejs
│           ├── marriage.ejs
│           ├── business.ejs
│           ├── origland.ejs
│           └── transferland.ejs
│
├── public/                      # Static files (served to client)
│   ├── css/
│   │   └── style.css            # Main stylesheet
│   ├── js/
│   │   ├── app.js               # Client-side app logic
│   │   └── script.js            # Original script (backup)
│   └── assets/
│       ├── doj.png
│       ├── lossantos.webp
│       ├── birthcert.png
│       ├── marriagecert.png
│       ├── business permit.png
│       ├── business permitLE.png
│       ├── origcert_title.jpg
│       └── transfercert_title.jpg
│
├── middleware/                  # Express middleware
│   ├── rateLimit.js             # Rate limiting (50/hour)
│   └── security.js              # Security headers, input validation
│
├── routes/                      # Express routes
│   ├── index.js                 # GET /
│   ├── api.js                   # POST /api/generate, GET /api/status
│   └── health.js                # GET /health
│
├── config/                      # Configuration
│   └── constants.js             # Fields, dimensions, validation rules
│
├── utils/                       # Utilities (future use)
│   └── [validators.js]
│
├── README.md                    # This file
└── LICENSE                      # MIT License
```

---

## 🛠️ Technologies

### Backend
- **Express.js** - Web framework
- **EJS** - Templating engine
- **MongoDB** - Rate limiting storage (optional)
- **Helmet.js** - Security headers
- **express-validator** - Input validation
- **Morgan** - HTTP logging
- **Compression** - Response compression

### Frontend
- **HTML5** - Markup
- **CSS3** - Styling (responsive design)
- **Vanilla JavaScript** - Canvas rendering, form handling
- **Canvas 2D API** - Document rendering
- **Font Awesome 6.4** - Icons

### Scripts
- `npm start` - Production server
- `npm run dev` - Development with live reload
- `npm test` - Run tests (when added)

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using port 3000
lsof -i :3000

# Use different port
PORT=3001 npm start
```

### MongoDB Connection Failed
```
⚠ MongoDB not available, rate limiting will be skipped
```
This is normal! Server still works, just rate limiting is temporarily off-memory.

### EACCES Permission Denied
```bash
# Fix permissions on Linux/Mac
sudo chown -R $(whoami) ~/.npm
npm install
```

### Canvas Import Issues
Canvas dependency was removed (client-side rendering only). If you see canvas errors, delete `node_modules` and reinstall.

### CORS Errors
If frontend makes cross-domain requests, configure CORS in `server.js`:
```javascript
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

---

## 📝 License

MIT License © 2025 KWTS

Permission granted to use, modify, and distribute for non-commercial purposes. Proper credit required.

---

## 📞 Support

- **Issues**: Open a GitHub issue
- **Features**: Submit pull requests
- **Questions**: Check troubleshooting section

---

## 🎯 Roadmap

- [ ] PDF export (instead of PNG only)
- [ ] MongoDB Atlas integration guide
- [ ] Docker deployment guide
- [ ] Database persistence for user history
- [ ] Custom template upload
- [ ] Admin dashboard
- [ ] User authentication
- [ ] Batch document generation
- [ ] API key system for programmatic access

---

**Last Updated:** March 26, 2025
**Version:** 2.0.0
**Status:** Production Ready
