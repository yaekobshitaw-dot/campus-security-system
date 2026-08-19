# Admin Password Reset - Implementation Guide

## Summary

A secure admin password reset mechanism has been implemented without modifying any database schema, deleting accounts, or weakening security.

**Implementation:**
- Created: `backend/src/scripts/resetAdminPassword.js`
- Uses: bcryptjs (same hashing as existing system)
- No hardcoded passwords
- Runtime password input only
- Preserves admin account, email, and role
- Includes verification after update

---

## Prerequisites

Before resetting the admin password, ensure:

1. **MariaDB/MySQL is running** on port 3306
   ```powershell
   # Check if MariaDB is running (XAMPP)
   # Should show "MariaDB" in Services or XAMPP Control Panel
   ```

2. **Backend dependencies are installed**
   ```powershell
   cd backend
   npm install
   ```

3. **Environment variables are set**
   - Ensure `.env` file exists in `backend/` directory
   - Required variables:
     ```
     DB_NAME=campus_security
     DB_USER=root
     DB_PASSWORD=your_password (if set)
     DB_HOST=127.0.0.1
     DB_PORT=3306
     ```

---

## Exact PowerShell Commands

### Option 1: Command-line Argument (Recommended for scripts)
```powershell
cd "C:\Users\User\Documents\campus-security-system\backend"
node src/scripts/resetAdminPassword.js --password "YourNewSecurePassword123"
```

### Option 2: Environment Variable (Recommended for security)
```powershell
$env:ADMIN_PASSWORD = "YourNewSecurePassword123"
cd "C:\Users\User\Documents\campus-security-system\backend"
node src/scripts/resetAdminPassword.js
```

### Option 3: Inline Environment Variable (One-liner)
```powershell
cd "C:\Users\User\Documents\campus-security-system\backend" ; $env:ADMIN_PASSWORD = "YourNewSecurePassword123" ; node src/scripts/resetAdminPassword.js
```

---

## Password Requirements

- **Minimum 8 characters** (enforced by script)
- Should contain uppercase, lowercase, numbers, and special characters
- Example: `SecureAdmin2024!@#`

---

## Expected Output

When successful, you'll see:

```
✅ Database connection successful
ℹ️  Found admin user: admin@campus.edu (System Administrator)
ℹ️  Hashing new password...
✅ Admin password updated successfully
✅ Password verification successful

📋 Summary:
   Email: admin@campus.edu
   Name: System Administrator
   Role: admin
   Status: active
   Updated at: 2026-08-18T14:30:45.000Z

✅ Admin password reset completed successfully
```

---

## Verification Steps

### 1. Test Login with New Password

Start the backend:
```powershell
cd backend
npm run dev
```

Then test login via API:
```powershell
$body = @{
    email = "admin@campus.edu"
    password = "YourNewSecurePassword123"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5002/api/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

Should return: `{ "success": true, "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", ... }`

### 2. Verify in Database

Connect to database and check admin user:
```sql
SELECT user_id, email, name, role, is_active, updated_at 
FROM users 
WHERE role = 'admin';
```

Should show the admin user with current `updated_at` timestamp.

### 3. Verify Password Hash Changed

Before reset, the password_hash was different. After reset, verify by:
```powershell
# Run the script again with same password - should update timestamp
node src/scripts/resetAdminPassword.js --password "YourNewSecurePassword123"
```

---

## Security Considerations

1. **Never commit passwords to git**
   - Don't paste passwords in code or config files
   - Use command-line arguments or environment variables only

2. **Environment variable cleanup**
   - Variable is set only for the current PowerShell session
   - Closes automatically when terminal closes
   - Not stored in PowerShell history if you clear it

3. **Audit trail**
   - Password hash updates are logged with `updated_at` timestamp
   - Database records show when update occurred

4. **Recovery**
   - If you forget the new password, run reset script again
   - No data loss occurs
   - Admin account remains intact

---

## Troubleshooting

### Error: "No admin user found in database"
- **Cause:** Database is empty or no admin user exists
- **Solution:** Create an admin account first via registration or direct database insert
  ```sql
  INSERT INTO users (user_id, email, name, role, password_hash, is_active, created_at, updated_at)
  VALUES (UUID(), 'admin@campus.edu', 'System Administrator', 'admin', 'TEMP_HASH', 1, NOW(), NOW());
  ```
  Then run reset script to set proper password.

### Error: "Password must be at least 8 characters"
- **Cause:** Password provided is too short
- **Solution:** Use password with minimum 8 characters

### Error: "Database connection failed"
- **Cause:** MariaDB/MySQL not running or credentials incorrect
- **Solution:**
  1. Start MariaDB (XAMPP Control Panel)
  2. Verify `.env` contains correct DB credentials
  3. Test connection: `mysql -h 127.0.0.1 -u root -p campus_security`

### Error: "Cannot find module 'bcryptjs'"
- **Cause:** Dependencies not installed
- **Solution:**
  ```powershell
  cd backend
  npm install
  ```

---

## Implementation Details

**File Created:**
- Location: `backend/src/scripts/resetAdminPassword.js`
- Size: ~120 lines
- Dependencies: bcryptjs, sequelize (already installed)

**Features:**
- ✅ Uses bcryptjs with salt=10 (same as User model)
- ✅ Accepts password via command-line or environment variable
- ✅ Finds admin by role (not hardcoded email)
- ✅ Verifies password after update (comparePassword method)
- ✅ Graceful error handling with clear messages
- ✅ Database connection validation
- ✅ No sensitive data in logs (password not logged)

**No modifications to:**
- ❌ Backend code/logic
- ❌ User model
- ❌ Database schema
- ❌ Authentication logic
- ❌ Web dashboard
- ❌ Docker configuration

---

## Next Steps

1. **Reset your admin password:**
   ```powershell
   cd "C:\Users\User\Documents\campus-security-system\backend"
   node src/scripts/resetAdminPassword.js --password "YourNewSecurePassword"
   ```

2. **Start backend and login:**
   ```powershell
   npm run dev
   # Navigate to web dashboard and login with new password
   ```

3. **Save the new password securely**
   - Use a password manager
   - Do not store in code, config files, or terminal history

---

## Support

For issues:
1. Check database is running: `mysql -h 127.0.0.1 -u root`
2. Verify credentials in `.env`
3. Check admin user exists: `SELECT COUNT(*) FROM users WHERE role='admin';`
4. Review script output for specific error messages
