# Deployment Configuration - NFC Tag Notification System

## Quick Start

### 1. Set Environment Variables

Create `.env` file in project root:

```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database (PostgreSQL on Render.com)
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis Cache (Redis Cloud)
REDIS_URL=redis://:password@host:6379/0

# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id

# Apple Push Notification Service (APNs)
IOS_BUNDLE_ID=com.example.nfctag
APPLE_TEAM_ID=ABCDE12345
APNS_KEY_ID=KEY123456
APNS_CERTIFICATE_PATH=/app/certs/apns-cert.pem
APNS_KEY_PATH=/app/certs/apns-key.pem

# Encryption
ENCRYPTION_KEY=your-32-byte-hex-string-for-aes256

# Monitoring
SENTRY_DSN=https://key@sentry.io/project
LOGGLY_TOKEN=your-loggly-token

# Feature Flags
FEATURE_FLAG_NFC_ENABLED=true
FEATURE_FLAG_NOTIFICATIONS_ENABLED=true
```

See `.env.example` for reference template.

### 2. Deploy on Render.com

```bash
# 1. Connect GitHub repository to Render.com
# https://dashboard.render.com

# 2. Create PostgreSQL database
# Dashboard → New → PostgreSQL
# - Name: nfc-tag-db
# - PostgreSQL Version: 15
# - Region: US (Oregon) or closest to your users
# Copy DATABASE_URL

# 3. Create Redis cache
# Dashboard → New → Redis
# - Name: nfc-tag-cache
# - Region: Same as database
# Copy REDIS_URL

# 4. Create Web Service
# Dashboard → New → Web Service
# - Name: nfc-tag-api
# - Runtime: Node
# - Build Command: npm install && npm run build
# - Start Command: npm start
# - Plan: Free (or Paid if needed)

# 5. Add environment variables to Web Service
# Settings → Environment Variables
# Add all variables from .env
```

### 3. Deploy Backend

```bash
# Automatic deployment (on git push)
git push origin main

# Or manual deployment
# Render.com Dashboard → Web Service → Manual Deploy

# Verify deployment
curl https://nfc-tag-api.onrender.com/health
```

---

## Environment Configuration Templates

### Development (.env.development)

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Local PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/nfc_tag_dev

# Local Redis
REDIS_URL=redis://localhost:6379/0

# Firebase (development project)
FIREBASE_PROJECT_ID=nfc-tag-dev
FIREBASE_API_KEY=AIzaSyD...

# APNs (sandbox)
APPLE_TEAM_ID=TEST123456
IOS_BUNDLE_ID=com.example.nfctag.dev

# Encryption key (development only)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef

# Monitoring (disabled)
SENTRY_DSN=
LOGGLY_TOKEN=
```

### Staging (.env.staging)

```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Staging PostgreSQL (Render.com)
DATABASE_URL=postgresql://user:password@dpg-staging.onrender.com:5432/staging

# Staging Redis (Redis Cloud)
REDIS_URL=redis://:password@staging-redis.cloud.redislabs.com:12345/0

# Firebase (staging project)
FIREBASE_PROJECT_ID=nfc-tag-staging
FIREBASE_API_KEY=AIzaSyD...

# APNs (sandbox)
APPLE_TEAM_ID=STAGING123
IOS_BUNDLE_ID=com.example.nfctag.staging

# Encryption key (staging)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Monitoring
SENTRY_DSN=https://staging@sentry.io/1234
LOGGLY_TOKEN=staging-token
```

### Production (.env.production)

```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn

# Production PostgreSQL (Render.com or AWS RDS)
DATABASE_URL=postgresql://user:password@prod-db.onrender.com:5432/production

# Production Redis (Redis Cloud)
REDIS_URL=redis://:password@prod-redis.cloud.redislabs.com:12345/0

# Firebase (production project)
FIREBASE_PROJECT_ID=nfc-tag-prod
FIREBASE_API_KEY=AIzaSyD...

# APNs (production)
APPLE_TEAM_ID=PROD123456
IOS_BUNDLE_ID=com.example.nfctag
APNS_CERTIFICATE_PATH=/app/certs/apns-prod.pem
APNS_KEY_PATH=/app/certs/apns-key-prod.pem

# Encryption key (production - GENERATE SECURELY)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Monitoring
SENTRY_DSN=https://prod@sentry.io/5678
LOGGLY_TOKEN=prod-token
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing: `npm run test`
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npm run build`
- [ ] Code linted: `npm run lint`
- [ ] Environment variables configured in target service
- [ ] Database migrations reviewed
- [ ] Rollback plan documented
- [ ] Team notified of deployment
- [ ] Backup taken (if production)

### Deployment Steps

```bash
# 1. Verify current version
npm run build
npm run test

# 2. Commit and tag
git add .
git commit -m "Deploy v1.0.0"
git tag -a v1.0.0 -m "Release v1.0.0"

# 3. Push to main (triggers auto-deploy on Render.com)
git push origin main
git push origin v1.0.0

# 4. Monitor deployment logs
# Render.com Dashboard → Web Service → Logs
# Wait for "Deploy Complete" message (~5-10 minutes)

# 5. Verify health check
curl https://nfc-tag-api.onrender.com/health
# Expected response:
# {"status":"healthy","services":{"database":"connected","cache":"connected","fcm":"ready","apns":"ready"}}

# 6. Run smoke tests
./scripts/smoke-tests.sh
```

### Post-Deployment

- [ ] Health check returns `healthy`
- [ ] Database migrations completed
- [ ] No error spikes in monitoring (Sentry)
- [ ] Users can log in and scan NFC tags
- [ ] Notifications being delivered
- [ ] Performance metrics within targets (latency <500ms)

### Rollback (If Issues)

```bash
# 1. Identify last stable commit
git log --oneline | head -5

# 2. Revert to previous version
git revert HEAD
git push origin main

# 3. Monitor logs for recovery
# Should auto-redeploy on Render.com

# 4. Restore database (if data corruption)
# Render.com Dashboard → PostgreSQL → Backups → Restore
```

---

## Secrets Management

### GitHub Secrets (for CI/CD)

Store sensitive values in GitHub repository:

1. **Settings** → **Secrets and variables** → **Actions**
2. Add secrets:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `FIREBASE_API_KEY`
   - `APNS_CERTIFICATE`
   - `APNS_KEY`
   - `ENCRYPTION_KEY`
   - `SENTRY_DSN`
   - `LOGGLY_TOKEN`

### Render.com Environment Variables

1. **Dashboard** → **Web Service** → **Settings**
2. **Environment Variables** section
3. Add each variable (values automatically encrypted at rest)

### Never in Version Control

❌ Do NOT commit:
- `.env` files (actual values)
- API keys
- Private certificates
- Database passwords
- Encryption keys

✅ Use:
- `.env.example` (template without secrets)
- GitHub Secrets (CI/CD)
- Render.com Environment Variables (runtime)

---

## Render.com Setup Instructions

### PostgreSQL Setup

**Step 1: Create Database**
1. Render.com Dashboard → **New** → **PostgreSQL**
2. Configuration:
   - Name: `nfc-tag-db`
   - Database: `nfc_tag`
   - User: `postgres`
   - Region: US (Oregon) [pick closest to users]
   - PostgreSQL Version: 15
   - Plan: **Free** (512MB storage)

**Step 2: Configure Backups**
- Automatic daily backups: ✓ Enabled
- Backup retention: 7 days

**Step 3: Get Connection String**
- Copy connection string from dashboard
- Format: `postgresql://user:password@host:5432/database`
- Store in Render.com Web Service → Environment Variables as `DATABASE_URL`

### Redis Cache Setup

**Step 1: Create Cache**
1. Render.com Dashboard → **New** → **Redis**
2. Configuration:
   - Name: `nfc-tag-cache`
   - Region: Same as PostgreSQL
   - Plan: **Free** (30MB)

**Step 2: Get Connection String**
- Copy connection string
- Format: `redis://:password@host:port`
- Store as `REDIS_URL`

### Web Service Setup

**Step 1: Connect GitHub**
1. Render.com Dashboard → **New** → **Web Service**
2. Connect to GitHub repository
3. Select branch: `main`

**Step 2: Configure Build & Start**
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Node Version**: 18 or 20

**Step 3: Set Environment Variables**
1. **Settings** → **Environment Variables**
2. Add all variables from `.env.production`
3. Include:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `FIREBASE_*` variables
   - `APPLE_*` variables
   - `ENCRYPTION_KEY`
   - `SENTRY_DSN`
   - `LOGGLY_TOKEN`

**Step 4: Add Cron Job for Database Backups**
- Settings → Cron Jobs
- Job: Daily backup at 02:00 UTC
- Command: `pg_dump $DATABASE_URL > backup.sql`

### Monitoring Setup

**Sentry (Error Tracking)**
1. https://sentry.io → Create project
2. Select Platform: **Node.js**
3. Copy DSN URL
4. Add to Render.com as `SENTRY_DSN`

**Loggly (Log Aggregation)**
1. https://www.loggly.com → Sign up (free tier)
2. Configure Log Input
3. Copy token
4. Add to Render.com as `LOGGLY_TOKEN`

---

## Railway Deployment (Alternative)

Railway is an alternative free-tier platform to Render.com.

### Railway Setup

**Step 1: Create Project**
1. https://railway.app → Create new project
2. Connect GitHub repository

**Step 2: Add PostgreSQL**
1. **Add Service** → **PostgreSQL**
2. Configuration:
   - Database: `nfc_tag`
   - Auto-generate credentials

**Step 3: Add Redis**
1. **Add Service** → **Redis**
2. Auto-configuration

**Step 4: Add Environment Variables**
1. **Variables** tab
2. Add all from `.env.production`

**Step 5: Deploy**
- Railway auto-deploys on git push
- Logs visible in dashboard

---

## Firebase Setup

### Firebase Project Creation

1. https://firebase.google.com → Go to Console
2. **Create Project**
   - Project name: `nfc-tag`
   - Google Analytics: Optional
3. Enable these services:
   - **Cloud Messaging** (for FCM notifications)
   - **Remote Config** (for feature flags)

### Cloud Messaging Setup

**Step 1: Get Credentials**
1. Project Settings → **Service Accounts**
2. Click **Generate Key**
3. Select format: **JSON**
4. Save to `firebase-key.json`

**Step 2: Get Project ID**
1. Project Settings → **General**
2. Copy **Project ID**
3. Add to Render.com: `FIREBASE_PROJECT_ID=your-project-id`

**Step 3: Initialize in Code**
```typescript
// src/config/firebase.ts
import admin from 'firebase-admin';
import * as serviceAccount from './firebase-key.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});
```

### iOS APNs Configuration

**Step 1: Add iOS App**
1. Firebase Console → **Add App** → **iOS**
2. Bundle ID: `com.example.nfctag`
3. Download **GoogleService-Info.plist**
4. Add to iOS Xcode project

**Step 2: Upload APNs Certificate**
1. Firebase Console → Cloud Messaging
2. **Apple Configuration**
3. Upload:
   - APNs Key (.p8 file from Apple Developer)
   - Team ID
   - Key ID

---

## Apple Developer Setup

### APNs Certificate Preparation

**Step 1: Create Key on Apple Developer**
1. https://developer.apple.com → Certificates
2. Create new **Authentication Key**
3. Check **Apple Push Notifications service (APNs)**
4. Download `.p8` file (save safely)
5. Note: Key ID and Team ID

**Step 2: Generate HMAC Keys for NFC Tags**

```bash
# Generate household-specific HMAC keys (32 bytes)
openssl rand -hex 32 > household_1_hmac.key

# Store encrypted in database
# Never commit .key files to Git
```

**Step 3: iOS App Configuration**

In Xcode project:
```swift
// Info.plist
<key>NSNFCReaderUsageDescription</key>
<string>We use NFC to scan task tags</string>

// Capabilities
✓ Push Notifications
✓ Background Modes > Remote notifications
```

---

## Database Initialization

### First-Time Setup

```bash
# 1. Connect to PostgreSQL
psql $DATABASE_URL

# 2. Create initial schema
\i migrations/001_initial_schema.sql

# 3. Verify tables
\dt

# 4. Verify indexes
\di

# 5. Exit
\q

# 6. Run application
npm start
```

### Migration on Deployment

```bash
# Automatic during application startup
npm start
# Application runs migrations automatically on boot
```

---

## Scaling Considerations

### Free Tier Limits

| Resource | Free Tier Limit | Limit Type | Cost if Exceeded |
|----------|-----------------|-----------|-----------------|
| PostgreSQL Storage | 512 MB | Hard | Upgrade to paid tier |
| PostgreSQL Connections | 2 | Hard | Upgrade tier |
| Redis Connections | 30 | Hard | Upgrade tier |
| Firebase Messaging | Unlimited | None | Always free |
| Render.com Compute | 750 hours/month | Soft (auto-sleep) | No cost, but service sleeps after 15min inactivity |
| Render.com Bandwidth | 100GB | Soft | Standard rates apply |

### When to Upgrade

**PostgreSQL**: 
- Upgrade to Paid tier if > 512MB data or > 2 concurrent connections
- Estimated cost: $15-30/month

**Redis**:
- Upgrade if > 30 concurrent connections
- Estimated cost: $5-15/month

**Render.com**:
- Upgrade if need: Always-on (no auto-sleep), higher compute
- Estimated cost: $7-25/month

**Total Monthly Cost**:
- Free tier: $0
- Basic paid: $30-50/month
- Production: $100+/month (with redundancy)

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Redis 6+

### Setup

```bash
# 1. Clone repository
git clone https://github.com/yourname/nfc-tag.git
cd nfc-tag

# 2. Install dependencies
npm install

# 3. Create .env.development
cp .env.example .env
# Edit .env with local database URLs

# 4. Start PostgreSQL
# macOS: brew services start postgresql
# Linux: sudo service postgresql start
# Windows: Use Docker: docker run -d -p 5432:5432 postgres:15

# 5. Start Redis
# macOS: brew services start redis
# Linux: sudo service redis-server start
# Windows: Use Docker: docker run -d -p 6379:6379 redis:7

# 6. Run migrations
npm run migration:run

# 7. Start development server
npm run dev
# Server runs on http://localhost:3000

# 8. Run tests
npm run test

# 9. Run linter
npm run lint
```

---

## Troubleshooting Deployment

### Deployment Fails with "Build Command Failed"

```bash
# Check build logs in Render.com Dashboard
# Common issues:
# 1. npm install failed: Check package.json for typos
# 2. npm run build failed: Run locally first
npm run build

# 3. Missing env vars: Verify all required env vars set
echo $DATABASE_URL
echo $REDIS_URL
```

### Application Won't Start

```bash
# Check start logs
# Common issues:
# 1. Database connection: Verify DATABASE_URL correct
psql $DATABASE_URL -c "SELECT 1"

# 2. Redis connection: Verify REDIS_URL correct
redis-cli -u $REDIS_URL PING

# 3. Port already in use: Use different PORT
```

### Health Check Failing

```bash
# Check health endpoint
curl https://nfc-tag-api.onrender.com/health

# If database unhealthy:
# - Check PostgreSQL status
# - Verify DATABASE_URL

# If Redis unhealthy:
# - Check Redis Cloud status
# - Verify REDIS_URL

# If FCM/APNs unhealthy:
# - Check Firebase credentials
# - Verify FIREBASE_PROJECT_ID
```

---

## Deployment Logs

### View Logs

**Render.com**:
1. Dashboard → Web Service → Logs
2. Filter by date/time
3. Search for errors

**Sentry**:
1. https://sentry.io → Issues
2. Recent errors with stack traces
3. Affected users

**Loggly**:
1. https://www.loggly.com → Search
2. Query logs: `status:error`
3. Analyze patterns

### Log Levels

- **ERROR**: Critical failures requiring immediate attention
- **WARN**: Concerning issues that don't block operation
- **INFO**: Normal operational events
- **DEBUG**: Detailed diagnostic information (dev only)

---

## Rollback Procedures

### Rollback to Previous Version

```bash
# 1. Identify last stable commit
git log --oneline | head -10

# 2. Revert to specific commit
git revert <commit-hash>
git push origin main

# 3. Render.com auto-redeploys
# Check dashboard for deployment status

# 4. Verify health
curl https://nfc-tag-api.onrender.com/health
```

### Database Rollback

```bash
# If data corrupted during migration:
# 1. Render.com PostgreSQL Dashboard
# 2. Click "Restore from Backup"
# 3. Select date before migration
# 4. Re-apply only validated migrations

# For manual restore:
pg_restore -d $DATABASE_URL backup_20240115.sql
```

---

## References

- [Render.com Docs](https://render.com/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Redis Docs](https://redis.io/documentation)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**Last Updated**: January 2024
**Version**: 1.0
**Next Review**: April 2024
