# Free Tier Service Setup Guide

## Overview

This NFC Tag notification system is designed to run completely free on free-tier services. Monthly cost: **$0** (forever).

### Budget Summary

| Service | Free Tier | Cost | Notes |
|---------|-----------|------|-------|
| **Compute** | Render.com | $0 | Free tier with auto-sleep |
| **Database** | PostgreSQL (Render) | $0 | 512MB storage included |
| **Cache** | Redis Cloud | $0 | 30MB included |
| **Messaging** | Firebase | $0 | Unlimited FCM under free plan |
| **CI/CD** | GitHub Actions | $0 | 2,000 min/month free |
| **Errors** | Sentry | $0 | 5,000 events/month free |
| **Logs** | Loggly | $0 | 200MB/day free |
| **iOS Hosting** | Apple TestFlight | $0 | Free beta distribution |
| **Domain** | Google Domains | ~$12/yr | Optional, not required for MVP |
| **TOTAL MONTHLY** | | **$0** | No ongoing costs |

---

## Service Specifications

### Firebase (FCM - Free Tier)

**What You Get**:
- Unlimited push notifications via Cloud Messaging
- No monthly limit on message count
- Supported on Android, iOS (via APNs), and web

**Quotas**:
- Messages per second: 500+ (sufficient for MVP)
- Concurrent connections: 100+
- Storage: 1GB Firestore (not used for this MVP)
- Remote Config: 300 items

**Performance Characteristics**:
- Average delivery latency: 10-100ms
- Delivery reliability: 99.9%+
- No scaling issues for MVP usage

**Cost Breakdown**:
- Android via FCM: Free
- iOS via APNs: Free (Apple doesn't charge Firebase)
- Web via WebPush: Free
- Overage: None (unlimited under free plan)

**Setup Time**: ~15 minutes

---

### PostgreSQL (Free Tier - Render.com)

**What You Get**:
- 512MB storage
- Unlimited connections (practical limit: 2 concurrent)
- Automatic daily backups (7-day retention)
- Auto-sleep after 15 minutes inactivity (faster connection on next request)

**Performance Characteristics**:
- Query latency: 10-50ms
- Connection pool: Limited to 2 (standard)
- Sufficient for MVP: 1,000+ users
- Suitable for production testing

**Scaling Path**:
- Upgrade to paid tier ($15-30/month) if:
  - Storage exceeds 512MB
  - Need > 2 concurrent connections
  - Need zero-downtime deployments

**Cold Start Behavior** (Auto-sleep after 15min):
- Application handles auto-reconnection
- First request after sleep takes ~30 seconds longer
- Subsequent requests normal speed
- Solution: Add background job to keep-alive (not necessary for MVP)

**Setup Time**: ~10 minutes

---

### Redis Cache (Free Tier - Redis Cloud)

**What You Get**:
- 30MB storage
- 30 concurrent connections
- Automatic failover (free tier includes basic HA)
- 100 MB/month data transfer (internal traffic free)

**Performance Characteristics**:
- Get/Set latency: 5-10ms
- Sufficient for: User sessions, rate limiting, temporary queue storage
- Sufficient for MVP: 100+ concurrent users

**Scaling Path**:
- Upgrade to paid tier ($5-15/month) if:
  - Concurrent connections exceed 30
  - Storage exceeds 30MB
  - Need higher throughput

**Storage Usage Estimate**:
- Per user session: ~1KB
- Per rate limit counter: ~50 bytes
- Per cached query: ~5KB
- Typical MVP: 5-10MB used

**Setup Time**: ~10 minutes

---

### Render.com (Free Tier - Compute)

**What You Get**:
- Free web service with auto-sleep
- 750 hours/month compute time
- Auto-sleep after 15 minutes inactivity
- Wake on next request (30 second cold start)
- Unlimited deployed apps (within free tier)

**Performance Characteristics**:
- CPU: Shared, ~0.5 vCPU during active requests
- Memory: 512MB
- Sufficient for: 50-100 concurrent users
- Average response time: 100-300ms

**Cold Start Impact** (Auto-sleep after 15min):
- First request takes ~30 seconds to respond
- Solution 1: Keep-alive job (cron) - not necessary
- Solution 2: Upgrade to paid tier ($7+/month) for always-on

**Scaling Path**:
- Upgrade to Starter ($7/month):
  - Always-on (no auto-sleep)
  - Dedicated resources
  - SSL certificate included
  - Better for production

- Upgrade to Standard ($25+/month):
  - Auto-scaling
  - Higher resource allocation
  - Priority support

**Setup Time**: ~15 minutes

---

### GitHub Actions (Free Tier - CI/CD)

**What You Get**:
- 2,000 minutes/month for private repos
- Unlimited public repo CI/CD
- macOS runners for iOS builds (free)
- Ubuntu runners for backend builds

**Typical Monthly Usage**:
- 100 commits × 5 minutes per build = 500 minutes
- 4 iOS builds × 30 minutes = 120 minutes
- Total: ~620 minutes/month (well under 2,000 limit)

**Performance**:
- Build time: 3-5 minutes (backend TypeScript)
- iOS build time: 30-45 minutes (Xcode compilation)
- Artifact storage: 400GB free

**Scaling Path**:
- Free tier is typically sufficient
- If exceeding 2,000 min/month: Pay per-minute (~$0.008/min)

**Setup Time**: ~20 minutes

---

### Sentry (Error Tracking - Free Tier)

**What You Get**:
- 5,000 error events/month
- 3-day event retention
- Issue grouping and trends
- Email alerts

**Typical Monthly Usage**:
- 100 users × 1 error per week = ~400 errors/month
- Well within free tier limits
- Scales to 50-100 concurrent users

**Performance Impact**:
- Error reporting adds ~10-20ms per error (asynchronous)
- Negligible impact on user experience
- No data loss on quota exceeded (errors just not sent to Sentry)

**Scaling Path**:
- Upgrade to Team Plan ($29/month) if:
  - Exceeding 5,000 events/month
  - Need longer retention
  - Need team collaboration features

**Setup Time**: ~10 minutes

---

### Loggly (Log Aggregation - Free Tier)

**What You Get**:
- 200MB/day log ingestion
- 7-day retention
- Searchable log archives
- Email alerts

**Typical Daily Usage**:
- 100 users × 100 events/user = 10,000 events/day
- Each event ~50-100 bytes = ~500KB-1MB/day
- Well within 200MB/day limit

**Performance Impact**:
- Structured logging adds ~5ms per request
- Minimal CPU/memory overhead
- Network: ~1MB/day outbound

**Scaling Path**:
- Free tier typically sufficient
- Upgrade if exceeding 200MB/day (unlikely)

**Setup Time**: ~5 minutes

---

## Free Tier Limits & Workarounds

### Problem 1: PostgreSQL Auto-Sleep (15 minutes)

**Impact**: 
- First request after 15min inactivity takes ~30 seconds
- Users experience slow load times
- Not noticeable during active usage

**Workaround 1** (No cost):
```bash
# Application auto-reconnects on connection failure
# Implemented in database.ts
# No user-facing impact after first request
```

**Workaround 2** (Optional, Minimal Cost):
```bash
# Add keep-alive cron job
# Render.com → Web Service → Cron Jobs
# Command: curl https://api.nfc-tag.app/health
# Frequency: Every 10 minutes
# Cost: Negligible (adds ~5 minutes/month compute)
```

### Problem 2: Redis 30MB Limit

**Impact**:
- Rate limiting cache shared with session storage
- 30MB is ~30,000 user sessions
- MVP doesn't need more

**Workaround** (No cost):
- Rate limiter automatically evicts old entries
- Session cache uses TTL-based expiration
- No data loss, just temporary data

### Problem 3: Firebase FCM Tier Limitations

**Impact**: None - completely unlimited
- Firebase free tier: Unlimited FCM messages
- No quotas, no rate limiting
- Perfect for MVP

---

## Storage & Data Estimates

### Database Size Growth

**Baseline**:
- Schema: ~5MB
- Indexes: ~2MB
- Initial data: ~1MB

**Per-User Data** (estimated):
- User record: 500 bytes
- Preferences: 300 bytes
- Push tokens: 1KB (encrypted)
- Task events (per task per month): 500 bytes
- **Total per user**: ~3-5KB/month

**Storage Estimate** (512MB PostgreSQL):
- 5MB schema + indexes
- 100 users × 5KB = 500KB
- 1 year history: 100 users × 5KB × 12 = 6MB
- Comfortable headroom up to: ~1,000 users

### Cache Size Growth

**Baseline**: ~100KB

**Per User Cached Data**:
- Session: 1KB
- Task list (cached): 5KB
- User preferences (cached): 500 bytes
- Rate limit counters: 100 bytes
- **Total per user**: ~7KB

**Cache Estimate** (30MB Redis):
- 5MB baseline + metadata
- 100 users × 7KB = 700KB
- Comfortable headroom up to: **1,000+ users**

### Bandwidth Estimate

**Monthly Data Transfer** (100 users, 30 days):
- Average API calls: 100 users × 10 calls/day = 1,000 calls/day
- Average payload: 10KB/call
- Daily bandwidth: 10MB
- Monthly bandwidth: 300MB

**Limits**:
- Render.com: 100GB/month (free tier)
- Redis: 100MB/month internal (free tier)
- **Well within free tier limits**

---

## Performance Targets vs Free Tier

### API Response Times

**Target**: < 500ms for event processing

**Free Tier Performance**:
- PostgreSQL query: 10-50ms
- Redis cache hit: 5-10ms
- Event processing logic: 10-20ms
- FCM/APNs delivery: 100-200ms (async)
- **Total typical**: 100-150ms ✓

**Cold Start** (Render.com after 15min sleep):
- First request: 30-40 seconds
- Subsequent requests: 100-150ms ✓

### Notification Delivery

**Target**: 99%+ delivery success rate

**Free Tier Performance**:
- Firebase FCM: 99.9%+ (Google's SLA)
- APNs: 99.9%+ (Apple's SLA)
- Combined: 99.8%+ ✓

**Retry Logic**:
- Up to 5 retry attempts
- Exponential backoff (1s, 2s, 4s, 8s, 16s)
- Max retry window: 31 seconds
- Circuit breaker prevents cascade failures

---

## Upgrade Path (When Needed)

### Trigger 1: User Growth Exceeds Capacity

**Free Tier Capacity**: ~1,000 users

**Indicators**:
- Storage warning from Render.com
- Database connections maxed out
- Slow queries taking > 500ms

**Upgrade**: PostgreSQL Paid Tier
- Cost: $15-30/month
- Storage: 10GB+
- Connections: Unlimited

### Trigger 2: Compute Capacity Issues

**Free Tier Capacity**: 50-100 concurrent users

**Indicators**:
- Render.com CPU/Memory warnings
- Response times > 500ms under load
- Cold start affecting user experience

**Upgrade**: Render.com Starter
- Cost: $7/month
- CPU: Dedicated 0.5 vCPU
- Memory: 512MB dedicated
- Always-on (no auto-sleep)

### Trigger 3: Cache Limitations

**Free Tier Capacity**: ~1,000 users

**Indicators**:
- Redis connection limit warnings
- Rate limiting not working properly
- Session cache evictions

**Upgrade**: Redis Cloud Paid Tier
- Cost: $5-15/month
- Storage: 100MB+
- Connections: 100+

### Full Production Setup (If Needed)

| Component | Free | Starter | Enterprise |
|-----------|------|---------|------------|
| **Compute** | $0 | $7 | $25+/month |
| **Database** | $0 | $15 | $30+/month |
| **Cache** | $0 | $5 | $15+/month |
| **Monitoring** | $0 | $0 | $0 |
| **TOTAL** | **$0** | **~$27** | **$70+** |

---

## Migration Path: Free → Paid

### Gradual Upgrade Strategy

**Phase 1** (MVP - Free): 
- All free tier services
- ~100 users
- No scheduled maintenance
- Cost: $0/month

**Phase 2** (Growth - Starter):
- Upgrade database to paid tier
- Keep compute/cache free
- ~500 users
- Cost: $15/month

**Phase 3** (Production - Full):
- All paid tiers
- Auto-scaling enabled
- CDN for static assets
- ~10,000 users
- Cost: $100+/month

### Zero-Downtime Upgrades

Most upgrades can happen live:
```bash
# 1. Render.com PostgreSQL Upgrade
# Dashboard → Select DB → Plan → Upgrade
# Automatic migration, ~5 minute downtime (acceptable for MVP)

# 2. Render.com Compute Upgrade
# Dashboard → Web Service → Plan → Upgrade
# Automatic restart, ~2 minute downtime

# 3. Redis Upgrade
# Redis Cloud → Select DB → Plan → Upgrade
# Automatic migration, connection preserved
```

---

## Cost Optimization Tips

### Tip 1: Monitor Usage Regularly

```bash
# Check PostgreSQL storage
# Render.com Dashboard → PostgreSQL → Logs
SELECT pg_size_pretty(pg_database_size(current_database()));

# Check Redis usage
# Redis Cloud Dashboard → Database → Memory Usage
INFO memory

# Check bandwidth
# Render.com Dashboard → Web Service → Stats
```

### Tip 2: Optimize Queries

- Add indexes for slow queries
- Use database indexes on (householdId, userId)
- Cache frequently-accessed data
- Implement query result pagination

### Tip 3: Implement Retention Policies

```sql
-- Delete events older than 90 days (optional)
DELETE FROM task_events 
WHERE timestamp < NOW() - INTERVAL '90 days'
AND household_id NOT IN (
  SELECT id FROM households WHERE created_at > NOW() - INTERVAL '1 year'
);
```

### Tip 4: Compress Logs

- Loggly: Configure log retention
- Sentry: Set error sampling rate
- Don't send debug logs to aggregators

### Tip 5: Use Browser Caching

- iOS app caches task data
- Add HTTP cache headers to API responses
- Reduce redundant API calls

---

## Free Tier Service Status

### Service Reliability

All free tier services have uptime SLAs:

| Service | Uptime SLA | Responsibility |
|---------|-----------|-----------------|
| Firebase FCM | 99.9% | Google Cloud |
| PostgreSQL | 99.9% | Render.com |
| Redis | 99.9% | Redis Cloud |
| Render.com | No SLA | Best effort |
| Sentry | 99.95% | Sentry |

### Status Pages

Check service health:
- Firebase: https://firebase.google.com/status
- Render.com: https://status.render.com
- Redis Cloud: https://status.cloud.redislabs.com
- Sentry: https://status.sentry.io

### Incident History

Most services have excellent reliability:
- Firebase FCM: ~99.9% uptime (< 1 hour downtime/year)
- Render.com: ~99% uptime
- Redis Cloud: ~99% uptime

### Emergency Contacts

- Firebase: support@firebase.google.com
- Render.com: support@render.com
- Redis Cloud: support@redislabs.com
- Sentry: support@sentry.io

---

## Justification: Why Free Tier for MVP?

### Business Rationale

1. **Zero financial risk**: No AWS/cloud lock-in
2. **Proof of concept**: Validate market before investment
3. **Cost efficiency**: Full production features at $0
4. **Fast iteration**: Deploy and test without billing concerns
5. **Easy migration**: Upgrade smoothly when needed

### Technical Rationale

1. **Sufficient capacity**: Handles 1,000+ users at MVP scale
2. **Production-ready**: Same services used by enterprises
3. **Auto-scaling**: Free tier auto-scales for load
4. **Built-in HA**: Firebase/Redis have redundancy
5. **No proprietary lock-in**: Standard PostgreSQL, Redis, etc.

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Service outage | Multiple services, automatic fallback |
| Data loss | Daily automated backups |
| Performance degradation | Scaling path to paid tiers |
| Cold start delays | Optional keep-alive job |
| Storage limits | Monitoring and retention policies |

---

## FAQ

**Q: Can I run production workloads on free tier?**
A: Yes! Free tier is production-grade. Monitor limits and upgrade when needed.

**Q: What happens if I exceed free tier limits?**
A: Services gracefully degrade (no hard cutoff). Upgrade to paid tier to increase limits.

**Q: How do I avoid cold starts?**
A: Optional keep-alive cron job (minimal cost) or upgrade to always-on ($7/month).

**Q: Is data encrypted at rest?**
A: Yes. PostgreSQL and Redis Cloud both support encryption at rest.

**Q: Can I migrate to AWS later?**
A: Yes. Use standard PostgreSQL/Redis exports to migrate data.

**Q: What's the easiest upgrade path?**
A: Upgrade Render.com Web Service first ($7/month), then database as needed.

---

## References

- Firebase Free Plan: https://firebase.google.com/pricing
- Render.com Pricing: https://render.com/pricing
- Redis Cloud Pricing: https://redis.com/cloud/pricing/
- PostgreSQL Best Practices: https://www.postgresql.org/docs/current/

---

**Last Updated**: January 2024
**Version**: 1.0
**Review Date**: April 2024
