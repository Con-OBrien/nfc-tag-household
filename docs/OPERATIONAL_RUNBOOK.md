# NFC Tag Notification System - Operational Runbook

## System Overview

### Architecture Layers

```
┌─────────────────────────────────────────┐
│     iOS Mobile Client (Core NFC)        │
│  - NFC tag scanning (Core NFC Framework)│
│  - Push notification reception (APNs)   │
│  - Offline queue & sync                 │
└──────────────┬──────────────────────────┘
               │ HTTPS + Headers
┌──────────────▼──────────────────────────┐
│     REST API Gateway (Port 3000)        │
│  - Authentication (JWT/headers)         │
│  - Rate limiting                        │
│  - Request validation                   │
└──────────────┬──────────────────────────┘
               │ TCP
┌──────────────▼──────────────────────────────────┐
│         Event Processing Layer                  │
│  ├─ NFC Reader (tag validation)                 │
│  ├─ EventProcessor (duplicate detection)        │
│  ├─ TaskValidator (permissions check)           │
│  └─ NotificationService (FCM/APNs routing)      │
└──────────────┬───────────────────────────────────┘
               │
     ┌─────────┼─────────┬──────────┐
     │         │         │          │
┌────▼──┐ ┌───▼─────┐ ┌─▼──────┐ ┌▼────────┐
│PostgreSQL Redis   │FCM     │APNs
│        │Cache    │Service │Service
└────────┘─────────┴────────┴─────────
```

### Data Flow

1. **NFC Scan**: User taps NFC tag with iOS device
2. **Tag Reading**: Core NFC Framework reads NDEF message
3. **API Call**: iOS app sends POST `/events/tag-scanned`
4. **Validation**: EventProcessor validates tag signature
5. **Duplicate Detection**: Checks for recent identical scans (30s window)
6. **Permission Check**: TaskValidator verifies user can execute task
7. **Event Logging**: TaskEvent created and persisted
8. **Notification**: NotificationService identifies eligible recipients
9. **Preference Filtering**: Applies user notification preferences
10. **Delivery**: Routes to FCM (Android) or APNs (iOS)
11. **Retry**: DeliveryRetryService handles failures

---

## Component Interactions

### EventProcessor ↔ TaskValidator ↔ NotificationService

```
NFC Scan Event
    │
    ▼
[EventProcessor]
├─ Duplicate detection (30s window)
├─ User context enrichment
└─ Valid → pass to TaskValidator
    │
    ▼
[TaskValidator]
├─ Task exists & active check
├─ User household membership
├─ User execute permission
└─ Valid → emit to NotificationService
    │
    ▼
[NotificationService]
├─ Identify household members
├─ Exclude task executor
├─ Apply preferences (quiet hours, muted tasks)
├─ Route to FCM or APNs
└─ Log delivery status
```

### Push Token Lifecycle

```
User Login
    │
    ▼
[Receive new FCM/APNs token]
    │
    ▼
[POST /preferences/push-token]
    │
    ▼
[Encrypt token at rest]
    │
    ▼
[Store in database]
├─ Mark new token as active
├─ Mark old token as inactive (keep for rotation)
└─ Ready for notifications
```

---

## Operational Monitoring

### Health Check Endpoints

**System Health**:
```bash
GET /health
Response:
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "cache": "connected",
    "fcm": "ready",
    "apns": "ready"
  }
}
```

**Key Metrics to Monitor**:
- Event processing latency (target: <500ms)
- Query latency (target: <100ms)
- Notification delivery success rate (target: 99%+)
- Active household count
- Daily active users (DAU)
- Failed events queue length

### Monitoring Stack (Free Tier Tools)

#### Error Tracking (Sentry)
- Configuration: `SENTRY_DSN` environment variable
- Tracks: Unhandled exceptions, API errors, performance issues
- Free tier: 5,000 events/month
- Setup: https://sentry.io (free plan)

#### Log Aggregation (Loggly)
- Configuration: `LOGGLY_TOKEN` environment variable
- Tracks: Structured logs, debug info, audit trails
- Free tier: 200MB/day, 7-day retention
- Setup: https://www.loggly.com (free plan)

#### Example Log Entries
```
[INFO] Event processed: eventId=evt_xxx taskId=task_xxx duration=245ms
[WARN] Notification delivery retried: token=***masked** attempt=2
[ERROR] Database connection failed: reconnecting in 5s
[AUDIT] User added to household: user=user_xxx household=hh_xxx role=member
```

---

## Common Issues & Troubleshooting

### Issue 1: Notifications Not Received

**Symptoms**: 
- Events processed successfully
- No push notifications arriving on iOS device

**Diagnosis Steps**:
1. Check `/health` endpoint - verify APNs service is "ready"
2. Verify user has notifications enabled: `GET /preferences`
3. Check quiet hours: ensure current time is not in quiet hours window
4. Check muted tasks: verify task is not in muted list
5. Verify push token is recent: `tokenUpdatedAt` < 7 days
6. Check error logs: `LOGGLY_TOKEN` logs for delivery errors

**Recovery**:
```bash
# Re-register push token
curl -X POST https://api.nfc-tag.app/preferences/push-token \
  -H "x-user-id: $USER_ID" \
  -H "x-household-id: $HOUSEHOLD_ID" \
  -d '{"token": "new_apns_token", "platform": "ios"}'

# Verify preferences
curl https://api.nfc-tag.app/preferences \
  -H "x-user-id: $USER_ID" \
  -H "x-household-id: $HOUSEHOLD_ID"
```

---

### Issue 2: Rate Limiting Blocking Users

**Symptoms**:
- 429 Too Many Requests errors
- Users suspended temporarily

**Diagnosis**:
- Rate limit: 1 scan per task per user per 30 seconds
- User suspension: After 5 violations in 1 hour
- Recovery: Automatic after 15-minute cooldown

**Recovery**:
```bash
# Check current rate limit status
# (Future endpoint - currently not exposed)

# Manual reset: Re-login user (generates new session)
POST /auth/login
```

**Prevention**:
- Educate users: Avoid repeated rapid scans
- Add UI feedback in iOS app: "Task already recorded (30s cooldown)"

---

### Issue 3: Database Connection Timeouts

**Symptoms**:
- 503 Service Unavailable
- PostgreSQL connection pool exhausted
- Logs: "ECONNREFUSED 127.0.0.1:5432"

**Diagnosis**:
```bash
# Check database status (Render.com dashboard)
# Verify DATABASE_URL is correct
echo $DATABASE_URL

# Monitor connection pool
# (Internal metric - check application logs)
```

**Recovery**:
1. **Free Tier Sleep**: Render.com free tier auto-sleeps after 15min inactivity
   - Solution: App attempts automatic reconnect (implemented in connection pool)
   - Time to recover: ~30 seconds
   - No manual action needed

2. **Connection Pool Exhausted**:
   - Increase pool size in `database.ts`
   - Default: 20 connections, Max: 50
   - Restart application: `npm start`

3. **Persistent Failures**:
   - Check database logs: Render.com dashboard
   - Verify DATABASE_URL environment variable
   - Restart database: Render.com Console → Restart

---

### Issue 4: NFC Tag Not Reading

**Symptoms**:
- iOS app: "Unable to read tag"
- No event posted to API

**Diagnosis** (iOS Device):
- Update to iOS 13+ (Core NFC requires iOS 13+)
- Ensure NFC is enabled in iOS Settings → Privacy → NFC
- Verify app has NFC permission
- Try re-opening app

**Diagnosis** (Tag):
- Verify tag is NDEF type II (standard)
- Check tag is not deactivated: `DELETE /nfc-tags/{tagId}`
- Verify tag signature is valid
- Try alternative tag reader (Android app or web simulator)

**Recovery**:
```bash
# Re-register tag if deactivated
POST /nfc-tags/register
{
  "taskId": "task_uuid",
  "tagId": "new_tag_id"
}
```

---

### Issue 5: Event Processing Latency High

**Symptoms**:
- Events taking >500ms to process
- Users notice delays between scan and notification
- Metrics: `Event processed: duration=2500ms`

**Diagnosis**:
1. Check event processor throughput
2. Verify no database query bottlenecks
3. Check Redis cache hit rate
4. Monitor FCM/APNs API response times

**Recovery**:
- **Database**: Add index on (householdId, userId) if not present
- **Cache**: Verify Redis is connected (`/health`)
- **Concurrency**: Increase Node.js worker threads (if multi-core system)
- **FCM/APNs**: Temporary delays may recover automatically

---

### Issue 6: Circuit Breaker Triggered

**Symptoms**:
- External service (FCM/APNs) failures trigger circuit breaker
- Notifications queued for retry
- Logs: "Circuit breaker OPEN for FCMService"

**Diagnosis**:
- Check service status: https://firebase.google.com/status
- Verify credentials (FIREBASE_PROJECT_ID, etc.)
- Check network connectivity to service

**Recovery**:
```bash
# Manual circuit breaker reset (if available)
# (Future endpoint)
POST /admin/circuit-breaker/reset
{ "service": "fcm" }

# Automatic recovery: 60 seconds after last failure
# Retries queued notifications: DeliveryRetryService
```

---

## Backup & Recovery Procedures

### PostgreSQL Backup (Render.com)

**Automated Backups**:
- Render.com performs daily backups
- Retention: 7 days (free tier)
- Access: Render.com Dashboard → Database → Backups

**Manual Backup**:
```bash
# Export database
pg_dump postgresql://<user>:<password>@<host>:5432/<db> > backup.sql

# Verify backup
file backup.sql  # Should show "ASCII text"
wc -l backup.sql # Should show substantial line count
```

**Restore from Backup**:
```bash
# Connect to PostgreSQL
psql postgresql://<user>:<password>@<host>:5432/<db>

# Drop and recreate schema
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

# Restore from backup
psql postgresql://<user>:<password>@<host>:5432/<db> < backup.sql
```

### Redis Cache Backup (Redis Cloud)

**Redis Persistence**:
- Default: Automatic persistence enabled
- Free tier: Max 100MB
- Manual snapshots: Via Redis Cloud console

**Cache Recovery**:
- Cache is ephemeral - rebuilds on first access
- No data loss risk from cache failure
- Event replay: Re-scan NFC tags or replay events

---

## Disaster Recovery

### RTO/RPO Targets
- **RTO (Recovery Time Objective)**: 1 hour
- **RPO (Recovery Point Objective)**: 1 hour (daily backups)

### Recovery Procedures

#### Scenario 1: Database Corrupted
1. Render.com Dashboard → Restore from Daily Backup
2. Verify data integrity: Run consistency checks
3. Notify users of potential data loss window (1 hour)

#### Scenario 2: Application Server Down
1. Redeploy on Render.com: `git push heroku main`
2. Verify health: `curl https://api.nfc-tag.app/health`
3. Estimated recovery time: 5-10 minutes

#### Scenario 3: Cascading Failures (FCM + APNs down)
1. Check service status pages
2. Circuit breakers automatically activate
3. Notifications queued for retry (up to 5 attempts)
4. No user action required - automatic recovery when services restore

---

## Performance Tuning

### Database Query Optimization

**Indexed Queries** (should use indexes):
```sql
-- All fast (indexed)
SELECT * FROM tasks WHERE householdId = ? AND isActive = true;
SELECT * FROM events WHERE householdId = ? AND userId = ? ORDER BY timestamp DESC;
SELECT * FROM users WHERE householdId = ? AND role = 'owner';
```

**Slow Query Threshold**: > 100ms

**Index Check**:
```bash
# List all indexes
\di  # In psql

# Expected indexes:
- tasks(householdId, isActive)
- events(householdId, userId, timestamp)
- users(householdId, role)
- taskEvents(taskId, timestamp)
```

### Cache Strategy

**Cached Data**:
- Task list per household (TTL: 5 minutes)
- User preferences (TTL: 10 minutes)
- Household members list (TTL: 10 minutes)

**Cache Invalidation**:
- Task created/updated → invalidate household cache
- User preferences updated → invalidate user cache
- Household member added/removed → invalidate household cache

### Connection Pooling

**PostgreSQL Pool**:
- Min connections: 5
- Max connections: 20
- Idle timeout: 30 seconds
- Connection reuse: Enabled

**Configuration** (src/config/database.ts):
```typescript
pool: {
  max: 20,          // Maximum connections
  min: 5,           // Minimum idle connections
  idleTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
}
```

---

## Maintenance Tasks

### Weekly
- [ ] Review error logs (Sentry): Look for recurring errors
- [ ] Check database size: Ensure < 512MB (free tier limit)
- [ ] Verify backups: Confirm daily backup completed
- [ ] Monitor DAU: Check growth trends

### Monthly
- [ ] Performance baseline: Run load tests
- [ ] Security audit: Review access logs
- [ ] Dependency updates: Check for critical patches
- [ ] Cost review: Verify free tier usage

### Quarterly
- [ ] Disaster recovery drill: Test backup restoration
- [ ] Capacity planning: Estimate growth needs
- [ ] Security penetration testing: Run security tests
- [ ] Documentation review: Update runbooks as needed

---

## Escalation Procedures

### Level 1 (User-Facing Issue)
- Issue: Single user report of missing notification
- Action: Verify user preferences, re-register push token
- Timeline: < 5 minutes
- Owner: Support team

### Level 2 (Service Degradation)
- Issue: > 5% of notifications failing
- Action: Check circuit breakers, verify FCM/APNs status
- Timeline: < 15 minutes
- Owner: On-call engineer

### Level 3 (Service Outage)
- Issue: API unavailable or all notifications failing
- Action: Check database status, verify service connectivity
- Timeline: < 1 hour RTO
- Owner: Engineering team lead + CTO

---

## Contact & Support

**On-Call Rotation**: [Team calendar link]
**Escalation Email**: ops@nfc-tag.app
**Emergency Hotline**: [Phone number if applicable]
**Status Page**: https://status.nfc-tag.app

---

**Last Updated**: January 2024
**Version**: 1.0
**Next Review**: April 2024
