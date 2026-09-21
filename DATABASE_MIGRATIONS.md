# Database Migrations - NFC Tag Notification System

## Overview

All database schema changes are tracked with migration files. This document describes the schema and migration procedures.

## Schema Structure

### Current Version: v1.0.0

---

## Migration: 001_initial_schema.sql

**Description**: Initial schema setup for MVP launch

**Migration Type**: CREATE (first deployment)

**Tables Created**:

### 1. households
```sql
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_by UUID NOT NULL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000
);

CREATE INDEX idx_households_created_by ON households(created_by);
CREATE INDEX idx_households_created_at ON households(created_at);
```

**Purpose**: Stores household (family/team) information

**Columns**:
- `id`: Unique household identifier
- `name`: Human-readable household name (e.g., "Smith Family")
- `created_by`: User ID of household creator
- `created_at`: Timestamp of creation (milliseconds)
- `updated_at`: Last update timestamp

**Constraints**:
- Primary key on `id`
- Foreign key reference from `created_by` to `users.id`

---

### 2. users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000
);

CREATE INDEX idx_users_household_id ON users(household_id);
CREATE INDEX idx_users_household_role ON users(household_id, role);
CREATE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_household_email ON users(household_id, email);
```

**Purpose**: User accounts and household membership

**Columns**:
- `id`: Unique user identifier
- `household_id`: Reference to household
- `email`: User email address (unique per household)
- `phone`: User phone number (optional)
- `role`: User role in household ("owner" or "member")
- `created_at`: Account creation time
- `updated_at`: Last profile update

**Constraints**:
- Foreign key: `household_id` → `households.id` (CASCADE delete)
- Unique: (household_id, email) - no duplicate emails per household

**Indexes**:
- `household_id`: Fast member list queries
- `(household_id, role)`: Fast role filtering
- `email`: Fast user lookup
- Unique `(household_id, email)`: Enforce uniqueness

---

### 3. tasks
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_tasks_household_id ON tasks(household_id);
CREATE INDEX idx_tasks_household_active ON tasks(household_id, is_active);
CREATE INDEX idx_tasks_category ON tasks(household_id, category);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
```

**Purpose**: Task definitions (e.g., "Feed the dog")

**Columns**:
- `id`: Unique task identifier
- `household_id`: Household this task belongs to
- `name`: Task name (e.g., "Feed Lenny")
- `description`: Detailed task description
- `category`: Task category (e.g., "pets", "chores")
- `created_by`: User who created this task
- `created_at`: Task creation timestamp
- `updated_at`: Last task update
- `is_active`: Soft delete flag (false = archived)

**Constraints**:
- Foreign key: `household_id` → `households.id` (CASCADE)
- Foreign key: `created_by` → `users.id` (RESTRICT - prevent user deletion)

**Indexes**:
- `household_id`: Fast household task lists
- `(household_id, is_active)`: Fast active task filtering
- `(household_id, category)`: Fast category filtering

---

### 4. task_events (Audit Trail)
```sql
CREATE TABLE task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(50) NOT NULL,
  timestamp BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000,
  metadata JSONB
);

CREATE INDEX idx_task_events_household ON task_events(household_id);
CREATE INDEX idx_task_events_task_id ON task_events(task_id);
CREATE INDEX idx_task_events_user_id ON task_events(user_id);
CREATE INDEX idx_task_events_household_user ON task_events(household_id, user_id);
CREATE INDEX idx_task_events_timestamp ON task_events(timestamp);
CREATE INDEX idx_task_events_household_timestamp ON task_events(household_id, timestamp DESC);
```

**Purpose**: Immutable audit trail of all task actions

**Columns**:
- `id`: Unique event identifier
- `household_id`: Household context
- `task_id`: Task being acted upon
- `user_id`: User performing action
- `action`: Action type ("execute", "create", "update", "archive")
- `timestamp`: When action occurred (milliseconds)
- `metadata`: JSON additional context (e.g., task name snapshot, change delta)

**Constraints**:
- Foreign keys use RESTRICT to prevent accidental data loss
- Immutable: No UPDATE or DELETE operations permitted on this table

**Indexes**:
- Multiple indexes for efficient query patterns:
  - By household
  - By task (history of task executions)
  - By user (user activity)
  - By timestamp (recent events)
  - Compound: (household, timestamp DESC) - most common query

**Security**: 
- Queries always filtered by `household_id` (no cross-household data leakage)

---

### 5. user_preferences
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start VARCHAR(5),  -- HH:MM format
  quiet_hours_end VARCHAR(5),    -- HH:MM format
  muted_tasks UUID[] DEFAULT ARRAY[]::UUID[],
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000
);

CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);
```

**Purpose**: User notification preferences

**Columns**:
- `id`: Preference record ID
- `user_id`: User these preferences belong to (UNIQUE)
- `notifications_enabled`: Whether user accepts notifications
- `quiet_hours_enabled`: Whether quiet hours active
- `quiet_hours_start`: Start time (e.g., "22:00")
- `quiet_hours_end`: End time (e.g., "08:00")
- `muted_tasks`: Array of task IDs to mute
- `created_at`, `updated_at`: Timestamps

**Constraints**:
- UNIQUE: One preference record per user
- Foreign key: `user_id` → `users.id` (CASCADE)

---

### 6. push_tokens (Encrypted)
```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_encrypted BYTEA NOT NULL,  -- AES-256 encrypted
  token_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for deduplication
  platform VARCHAR(20) NOT NULL,   -- "ios", "android", "web"
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000,
  last_used_at BIGINT,
  expires_at BIGINT
);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_hash ON push_tokens(token_hash);
CREATE INDEX idx_push_tokens_active ON push_tokens(user_id, is_active);
CREATE INDEX idx_push_tokens_platform ON push_tokens(platform);
```

**Purpose**: User push notification tokens (encrypted at rest)

**Columns**:
- `id`: Token record ID
- `user_id`: User this token belongs to
- `token_encrypted`: Encrypted push token (AES-256)
- `token_hash`: SHA-256 hash for lookups without decryption
- `platform`: Platform ("ios" = APNs, "android" = FCM, "web" = WebPush)
- `is_active`: Whether token can receive notifications
- `created_at`: Token registration time
- `last_used_at`: Last notification sent with this token
- `expires_at`: Token expiration (optional)

**Constraints**:
- Foreign key: `user_id` → `users.id` (CASCADE)
- Token lifecycle: active → inactive (never deleted, kept for audit)

**Security**:
- Token stored encrypted: `token_encrypted`
- Hash stored unencrypted: `token_hash` (for lookups without decryption key)
- Decryption key: `ENCRYPTION_KEY` environment variable (AES-256)

---

### 7. nfc_tags
```sql
CREATE TABLE nfc_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  tag_id VARCHAR(255) NOT NULL,
  signature_secret_encrypted BYTEA NOT NULL,  -- AES-256 encrypted HMAC key
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000,
  deactivated_at BIGINT
);

CREATE INDEX idx_nfc_tags_household ON nfc_tags(household_id);
CREATE INDEX idx_nfc_tags_task_id ON nfc_tags(task_id);
CREATE INDEX idx_nfc_tags_tag_id ON nfc_tags(tag_id);
CREATE UNIQUE INDEX idx_nfc_tags_household_tag ON nfc_tags(household_id, tag_id) WHERE is_active = true;
```

**Purpose**: NFC tag registrations with HMAC signing keys

**Columns**:
- `id`: Tag registration ID
- `household_id`: Household owning this tag
- `task_id`: Task this tag executes
- `tag_id`: Physical tag identifier
- `signature_secret_encrypted`: Encrypted HMAC key for tag signing
- `is_active`: Whether tag can execute tasks
- `created_at`: Registration time
- `deactivated_at`: Deactivation time (if applicable)

**Constraints**:
- Foreign keys for referential integrity
- Unique constraint: Per household, one tag per tag_id (when active)

**Security**:
- Signature secret encrypted: AES-256
- Only active tags can sign valid signatures

---

### 8. circuit_breaker_state
```sql
CREATE TABLE circuit_breaker_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name VARCHAR(100) NOT NULL UNIQUE,
  state VARCHAR(20) NOT NULL,  -- "CLOSED", "OPEN", "HALF_OPEN"
  failure_count INT NOT NULL DEFAULT 0,
  last_failure_at BIGINT,
  last_state_change_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000
);

CREATE INDEX idx_circuit_breaker_service ON circuit_breaker_state(service_name);
```

**Purpose**: Track circuit breaker state for external services (FCM, APNs)

**Columns**:
- `service_name`: Service identifier ("fcm", "apns")
- `state`: "CLOSED" (normal), "OPEN" (failing, skip calls), "HALF_OPEN" (testing recovery)
- `failure_count`: Count of recent failures
- `last_failure_at`: Timestamp of last failure
- `last_state_change_at`: When state last changed

---

## Migration Procedures

### Forward Migration (Upgrading)

**For PostgreSQL (TypeORM)**:

```bash
# 1. Create migration file
npx typeorm-cli migration:create -n MigrationName

# 2. Implement migration in src/migrations/
# (Use TypeQueryRunner API)

# 3. Test on staging database
npm run test:database

# 4. Run migration in production
npm run migration:run

# 5. Verify migration completed
SELECT * FROM migrations WHERE name = 'MigrationName';
```

**Manual SQL Migration**:

```bash
# Connect to database
psql $DATABASE_URL

# Run migration script
\i migrations/001_initial_schema.sql

# Verify tables
\dt  -- List tables
\di  -- List indexes

# Verify indexes exist
SELECT * FROM pg_indexes WHERE schemaname = 'public';
```

### Backward Migration (Rollback)

**Full Rollback** (restore from backup):

```bash
# If migration caused data corruption:
# 1. Contact database provider (Render.com)
# 2. Restore from previous daily backup
# 3. Re-apply only validated migrations
```

**Partial Rollback** (revert specific migration):

```bash
# TypeORM rollback
npm run migration:revert

# Manual SQL rollback
psql $DATABASE_URL
DROP TABLE IF EXISTS new_table CASCADE;
DROP INDEX IF EXISTS idx_new_index;
```

---

## Data Consistency & Constraints

### Referential Integrity

All tables use CASCADE on delete for non-critical relationships:

```
households (root)
  ├─ users (CASCADE delete)
  ├─ tasks (CASCADE delete)
  │   └─ task_events (RESTRICT delete)
  ├─ nfc_tags (CASCADE delete)
  └─ user_preferences (CASCADE delete)
```

**Preventing Accidental Data Loss**:
- User deletion: RESTRICT on `created_by` foreign key
- Task deletion: RESTRICT on `task_id` in task_events
- Ensures audit trail completeness

### Household Isolation

All queries must filter by `household_id` to prevent cross-household data leakage:

```sql
-- GOOD - Isolated query
SELECT * FROM tasks 
WHERE household_id = $1 AND is_active = true;

-- BAD - Cross-household query (NEVER USE)
SELECT * FROM tasks WHERE is_active = true;
```

### Immutable Audit Trail

`task_events` table is immutable:
- No UPDATE operations allowed
- No DELETE operations (except CASCADE from household delete)
- Enforced at application layer
- Policy: Log deletion attempts for security audit

---

## Performance Optimization

### Query Patterns & Indexes

**Pattern 1: Tasks by Household**
```sql
SELECT * FROM tasks 
WHERE household_id = ? AND is_active = true
ORDER BY created_at DESC;

-- Uses: idx_tasks_household_active
```

**Pattern 2: Recent Events**
```sql
SELECT * FROM task_events 
WHERE household_id = ? 
ORDER BY timestamp DESC 
LIMIT 50;

-- Uses: idx_task_events_household_timestamp
```

**Pattern 3: User Activity**
```sql
SELECT * FROM task_events 
WHERE household_id = ? AND user_id = ? 
ORDER BY timestamp DESC;

-- Uses: idx_task_events_household_user
```

### Index Maintenance

```bash
# Analyze tables for query planner
ANALYZE households;
ANALYZE users;
ANALYZE tasks;
ANALYZE task_events;

# Rebuild indexes (if fragmented)
REINDEX INDEX idx_tasks_household_active;

# Check index usage
SELECT * FROM pg_stat_user_indexes 
WHERE idx_scan = 0  -- Unused indexes
ORDER BY idx_scan DESC;
```

---

## Disaster Recovery

### Backup Strategy

**Automated (Render.com)**:
- Daily backups (7-day retention)
- Point-in-time recovery available

**Manual Backup**:
```bash
pg_dump $DATABASE_URL --format=custom > backup_$(date +%Y%m%d).sql
```

### Restoration

**From Render.com Console**:
1. Dashboard → Databases → Select DB
2. "Backups" tab → Select date
3. Click "Restore"

**Manual Restoration**:
```bash
pg_restore -d $DATABASE_URL backup_20240115.sql
```

---

## Schema Version History

| Version | Date       | Changes | Status |
|---------|-----------|---------|--------|
| 1.0.0   | 2024-01-15 | Initial schema | Active |
| 1.1.0   | Planned    | Add audit logging for API calls | Planned |
| 2.0.0   | Planned    | Sharding by household | Planned |

---

## Appendix: Schema Diagram

```
┌─────────────────────┐
│   households        │
├─────────────────────┤
│ id (PK)             │
│ name                │
│ created_by ──┐      │
│ created_at   │      │
└─────────────────────┘
       ▲ 1
       │
       │ CASCADE
       │
       │ N ┌─────────────────────┐
       ├──┤ users               │
       │  ├─────────────────────┤
       │  │ id (PK)             │
       │  │ household_id (FK) ──┼──┐
       │  │ email               │  │
       │  │ role                │  │
       │  │ created_at          │  │
       │  └─────────────────────┘  │
       │         ▲ 1               │
       │         │                 │
       │         │ CASCADE         │
       │         │                 │
       │         │ N               │
       │         ├─────────────────────────────────┐
       │         │                                 │
       │  ┌──────▼──────────────────┐   ┌──────────▼────────────────┐
       │  │ push_tokens             │   │ user_preferences          │
       │  ├─────────────────────────┤   ├───────────────────────────┤
       │  │ id (PK)                 │   │ id (PK)                   │
       │  │ user_id (FK) ────────┐  │   │ user_id (FK, UNIQUE) ─────┤
       │  │ token_encrypted      │  │   │ notifications_enabled     │
       │  │ platform             │  │   │ quiet_hours_*             │
       │  │ is_active            │  │   │ muted_tasks []            │
       │  └─────────────────────────┘   └───────────────────────────┘
       │                                    CASCADE
       │
       │  ┌──────────────────────────┐
       ├─ │ tasks                    │
       │  ├──────────────────────────┤
       │  │ id (PK)                  │
       │  │ household_id (FK) ────┐  │
       │  │ name                  │  │
       │  │ category              │  │
       │  │ created_by ────┐      │  │
       │  │ is_active      │      │  │
       │  └──────────────────────────┘
       │         ▲ 1                 ▲
       │         │                   │
       │         │ RESTRICT         │
       │         │                   │ 1
       │         │ CASCADE           │
       │         │                   │
       │         │  N                │ N
       │         ├─────────────────────────────────────┐
       │         │                                     │
       │  ┌──────▼──────────────────┐   ┌──────────────▼──────┐
       │  │ task_events             │   │ nfc_tags            │
       │  ├─────────────────────────┤   ├──────────────────────┤
       │  │ id (PK)                 │   │ id (PK)              │
       │  │ household_id (FK) ──────┤   │ household_id (FK) ───┤
       │  │ task_id (FK) ──┐        │   │ task_id (FK) ────────┤
       │  │ user_id (FK) ──┼────────┤   │ tag_id               │
       │  │ action         │        │   │ signature_secret_*   │
       │  │ timestamp      │        │   │ is_active            │
       │  └─────────────────────────┘   └──────────────────────┘
       │                  ▲ 1                  ▲ 1
       │                  │                    │
       │                  │ RESTRICT           │ CASCADE
       │                  │                    │
       │                  └────────┬───────────┘
       │                           │ RESTRICT
       └───────────────────────────┴──────────────────────────
```

---

## Migration Template

```sql
-- Migration: 002_add_feature.sql
-- Description: Add feature X
-- Created: 2024-01-20
-- Status: PENDING

BEGIN;

-- Create new table
CREATE TABLE feature_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  data JSONB,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now()) * 1000
);

-- Add indexes
CREATE INDEX idx_feature_logs_household ON feature_logs(household_id);

-- Verify
SELECT COUNT(*) FROM feature_logs;

COMMIT;

-- Rollback:
-- BEGIN;
-- DROP TABLE feature_logs CASCADE;
-- DROP INDEX idx_feature_logs_household;
-- COMMIT;
```

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Schema Version**: v1.0.0
