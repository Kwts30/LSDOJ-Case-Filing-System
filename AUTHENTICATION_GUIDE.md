# Authentication & Admin System Guide

## Overview

The DOJ Auto-Fillup System now includes a complete authentication and admin management system with role-based access control, document logging, and comprehensive reporting.

---

## Authentication System

### Login Page
- **URL**: `http://localhost:3000/auth/login`
- **Default Admin Credentials**:
  - Username: `kdelosreyes`
  - Password: `12345678`
- Auto-created on first server startup

### Key Features
- **Session-based authentication**: Uses express-session with HTTP-only, secure cookies
- **User roles**: `user` and `admin`
- **Activity logging**: Every login/logout is logged
- **Rate limiting**: 50 requests per hour per IP+Session

---

## User Management (Admin Only)

### Access
- URL: `/admin/users`
- Requires: Admin role

### Capabilities
- **List all users**: View all accounts with their details
- **Edit users**: Modify name, email, role, and active status
- **Create users**: Add new user accounts (admin can't self-register)
- **Deactivate users**: Soft delete (archive) users instead of permanent deletion
- **Track changes**: All modifications logged in activity logs

### User Fields
- **Username**: Login credential (unique, lowercase)
- **Email**: User email (unique)
- **Password**: Hashed with bcryptjs (salt rounds: 10)
- **Role**: `user` or `admin`
- **First/Last Name**: User display information
- **Active Status**: Enable/disable account
- **Last Login**: Timestamp of last login
- **Created Date**: Account creation timestamp

---

## Document Logging & Tracking

### What Gets Logged

Every time a document is generated, the system records:
- **Document Type**: birth, marriage, business, origland, transferland
- **Issuer Name**: Extracted from form data
- **Client Name**: Username of the person who generated it
- **User ID**: Link to the generating user
- **Timestamp**: When document was generated
- **IP Address**: Source IP address
- **User Agent**: Browser/client information
- **Form Data**: Complete submission data

### Access

Only **Admins** can view generated documents:
- URL: `/admin/documents`
- Lists all generated certificates with metadata

---

## Admin Dashboard

### Dashboard Home
- **URL**: `/admin/dashboard`
- **Accessible to**: Admin users only

### Dashboard Metrics
1. **Total Users**: Count of all user accounts
2. **Active Users**: Count of users with isActive=true
3. **Generated Documents**: Total certificates created
4. **Activity Logs**: Total log entries

### Dashboard Sections
1. **Statistics Cards**: Quick overview of system metrics
2. **Documents by Type**: Breakdown of certificate types generated
3. **Quick Links**: Navigation to reports, documents, logs, user management

---

## Reports & Analytics

### Admin Reports
**URL**: `/admin/reports`

#### Available Reports
1. **Documents by Type**
   - Count of birth, marriage, business, land title documents
   - Shows distribution of document types

2. **Documents by User**
   - How many documents each user has generated
   - Helps track user productivity

3. **Documents by Date**
   - Timeline view of last 30 days
   - Shows daily document generation trends

### Export Features
- **Export to CSV**: Download reports as comma-separated values
- Formats:
  - `/admin/export/report?type=documents` - All documents
  - `/admin/export/report?type=activity` - Activity logs
  - `/admin/export/report?type=users` - User list

---

## Activity Logs & Monitoring

### Activity Log
**URL**: `/admin/activity-logs`

### Actions Logged
- `login`: User logs in
- `logout`: User logs out
- `generate_document`: Certificate created
- `edit_user`: Admin modifies user
- `create_user`: Admin creates new user
- `delete_user`: Admin deactivates user

### Log Information
- User ID
- Action type
- Action details
- Result (success/failed)
- IP address
- Timestamp

### Automatic Cleanup
- Activity logs older than **90 days** are automatically deleted
- Configured via MongoDB TTL index

---

## User Monitoring & Analytics

### Analytics Dashboard
**URL**: `/admin/analytics`

### Metrics
1. **User Activity**: Count of actions per user (most active first)
2. **Login Activity**: Total number of logins across all users
3. **Document Creation Activity**: Total documents generated

---

## Security Features

### Password Security
- Hashed with **bcryptjs** (salt rounds: 10)
- Never stored in plain text
- Passwords cannot be retrieved, only reset

### Session Security
- **HTTP-only cookies**: Prevents JavaScript access
- **Secure cookies** (production): HTTPS-only transmission
- **Session expiration**: 1 hour timeout
- **Session encryption**: Express-session provides built-in encryption

### Access Control
- **Role-based**: All admin endpoints require `requireRole('admin')`
- **Authentication**: All protected endpoints require `authenticateUser`
- **Audit trail**: All admin actions logged

### Input Validation
- Form inputs validated with express-validator
- Maximum length: 500 characters
- XSS patterns blocked: `<script>`, `javascript:`, `onerror`, etc.
- HTML-escaped in EJS templates

### HTTPS Protection
- Cookies marked secure (production environment)
- Content Security Policy headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

---

## User Profile

### Access
- URL: `/auth/profile`
- Shows logged-in user information:
  - Username
  - Email
  - First/Last Name
  - Role (User/Admin)

### Profile Features
- View current account details
- Access dropdown menu in header
- Quick admin dashboard access (if admin)
- Logout button

---

## First-Time Setup

### Installation Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start MongoDB** (required)
   ```bash
   # Local: If installed
   mongod

   # Docker: Start container
   docker run -d -p 27017:27017 --name mongo mongo:latest

   # Cloud: MongoDB Atlas
   # Configure MONGODB_URI in .env
   ```

3. **Create .env file**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI
   ```

4. **Start Server**
   ```bash
   npm start
   ```

5. **First Login**
   - Go to http://localhost:3000
   - Redirected to login page
   - Admin account created automatically:
     - Username: `kdelosreyes`
     - Password: `12345678`
   - Login as admin

### Database Initialization

On first server startup:
- MongoDB collections created automatically:
  - `users` - User accounts
  - `generated_documents` - Certificates
  - `activity_logs` - Audit trail (auto-expires after 90 days)
  - `rate_limit` - Rate limiting data (auto-expires after 1 hour)
- Indexes created for performance
- Admin account created if no users exist

---

## Common Tasks

### Change Admin Password

1. Login as admin
2. Go to `/admin/users`
3. Find admin account (kdelosreyes)
4. Click Edit
5. (Note: Password change not yet implemented - requires future enhancement)

### Create New User

1. Login as admin
2. Go to `/admin/users`
3. Click "Create User" button
4. Fill in:
   - Username (unique)
   - Email (unique)
   - Password
   - First/Last Name
   - Role (User or Admin)
5. Click Create

### View Generated Documents

1. Login as admin
2. Go to `/admin/dashboard`
3. Click "View Documents" link
4. Or navigate to `/admin/documents`

### Generate Report

1. Login as admin
2. Go to `/admin/dashboard`
3. Click "Reports" link
4. Or navigate to `/admin/reports`
5. Select report type and export as CSV

### Monitor User Activity

1. Login as admin
2. Go to `/admin/dashboard`
3. Click "Activity Logs" link
4. Or navigate to `/admin/activity-logs`
5. View all logged actions

---

## API Endpoints

### Public Endpoints
- `GET /auth/login` - Login page
- `POST /auth/login` - Login submission
- `POST /auth/logout` - Logout
- `GET /health` - Health check

### Authenticated Endpoints
- `GET /` - Main application
- `POST /api/generate` - Generate certificate
- `GET /api/status` - API status
- `GET /auth/profile` - User profile

### Admin Endpoints
- `GET /admin/dashboard` - Dashboard
- `GET /admin/documents` - Document list
- `GET /admin/reports` - Reports
- `GET /admin/activity-logs` - Activity logs
- `GET /admin/analytics` - Analytics
- `GET /admin/users` - User management
- `POST /admin/users` - Create user
- `GET /admin/users/:id` - Edit user form
- `PUT /admin/users/:id` - Save user changes
- `DELETE /admin/users/:id` - Deactivate user
- `GET /admin/export/report` - Export reports

---

## Troubleshooting

### MongoDB Connection Error
```
⚠ MongoDB not available, rate limiting will be skipped
```

**Solution**: Ensure MongoDB is running on localhost:27017 or update MONGODB_URI in .env

### Login Loop
- Clear cookies in browser
- Check if session secret is correct
- Ensure database is initialized

### Admin Routes Not Working
- Verify user role is 'admin' in database
- Check if user is logged in
- Look for errors in server logs

### Activity Logs Not Appearing
- Ensure MongoDB is connected
- Check `activity_logs` collection exists
- Verify timestamps are correct

---

## Future Enhancements

- [ ] Password reset functionality
- [ ] Email verification for new accounts
- [ ] Two-factor authentication (2FA)
- [ ] API key system for programmatic access
- [ ] User invitation via email
- [ ] PDF report export
- [ ] Dashboard charts/graphs
- [ ] User audit history (activity timeline per user)
- [ ] Bulk user import/export
- [ ] Custom role definitions
- [ ] IP whitelist/blacklist
- [ ] Session management (view active sessions, logout remotely)

---

## Database Schema

### Users Collection
```
{
  _id: ObjectId,
  username: String (unique),
  email: String (unique),
  passwordHash: String,
  role: String ("user" or "admin"),
  firstName: String,
  lastName: String,
  isActive: Boolean,
  lastLogin: Date,
  loginAttempts: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Generated Documents Collection
```
{
  _id: ObjectId,
  documentType: String,
  issuerName: String,
  clientName: String,
  userId: ObjectId,
  formData: Object,
  createdAt: Date,
  ipAddress: String,
  userAgent: String,
  fileSize: Number
}
```

### Activity Logs Collection
```
{
  _id: ObjectId,
  userId: ObjectId,
  action: String,
  details: String,
  result: String,
  ipAddress: String,
  userAgent: String,
  timestamp: Date (TTL: 90 days)
}
```

### Rate Limit Collection
```
{
  _id: ObjectId,
  identifier: String,
  ip: String,
  sessionId: String,
  createdAt: Date (TTL: 1 hour),
  endpoint: String,
  method: String
}
```

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review server logs
3. Check MongoDB connection
4. Open GitHub issue
