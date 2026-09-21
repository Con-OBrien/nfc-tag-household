# NFC Tag Notification System - API Documentation

## Overview
Complete REST API documentation for the NFC tag notification system. All endpoints require authentication via `x-user-id` and `x-household-id` headers.

## Base URL
- Development: `http://localhost:3000`
- Production: `https://api.nfc-tag.app`

## Authentication
All endpoints (except `/health`) require the following headers:
- `x-user-id`: UUID of the authenticated user
- `x-household-id`: UUID of the household context
- `Authorization`: Bearer token (optional, for future OAuth support)

## Rate Limiting
- **Default**: 100 requests per minute per user
- **NFC Scan Endpoint**: 1 scan per task per user per 30 seconds
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Exceeded**: Returns `429 Too Many Requests`

## Error Responses
All error responses follow this format:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "timestamp": 1234567890000,
  "path": "/api/endpoint"
}
```

### Common HTTP Status Codes
- `200 OK`: Request successful
- `201 Created`: Resource created
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User lacks permission for this resource
- `404 Not Found`: Resource not found
- `409 Conflict`: Request conflicts with current state
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: External service unavailable

---

## Endpoints

### Health & Monitoring

#### GET `/health`
Check system health and service connectivity.

**Authentication**: Not required

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": 1234567890000,
  "services": {
    "database": "connected",
    "cache": "connected",
    "fcm": "ready",
    "apns": "ready"
  },
  "uptime": 3600000
}
```

**Error Responses**:
- `503 Service Unavailable`: One or more critical services unavailable

---

### Events & NFC Scanning

#### POST `/events/tag-scanned`
Process an NFC tag scan event.

**Authentication**: Required

**Request Body**:
```json
{
  "tagId": "string",
  "tagSignature": "string (64-char hex)",
  "taskId": "uuid",
  "scannedAt": 1234567890000,
  "clientVersion": "1.0.0"
}
```

**Response** (200 OK):
```json
{
  "eventId": "uuid",
  "taskId": "uuid",
  "status": "success",
  "action": "execute",
  "timestamp": 1234567890000,
  "notificationsSent": 3
}
```

**Error Responses**:
- `400 Bad Request`: Invalid tag format or missing fields
- `403 Forbidden`: User not in household
- `404 Not Found`: Task not found or inactive
- `409 Conflict`: Duplicate scan (duplicate protection)
- `429 Too Many Requests`: Rate limit exceeded

**Notes**:
- Signature must be valid HMAC-SHA256 in constant-time comparison
- Task must be active and user must have execute permission
- Duplicate detection: scans within 30 seconds are rejected
- Triggers automatic notification delivery to household members

---

#### GET `/events/history`
Retrieve event history for the household.

**Authentication**: Required

**Query Parameters**:
- `limit`: Number of events (default: 50, max: 500)
- `offset`: Pagination offset (default: 0)
- `startDate`: ISO 8601 timestamp (optional, lower bound)
- `endDate`: ISO 8601 timestamp (optional, upper bound)
- `userId`: Filter by user (optional)
- `taskId`: Filter by task (optional)

**Response** (200 OK):
```json
{
  "events": [
    {
      "eventId": "uuid",
      "taskId": "uuid",
      "userId": "uuid",
      "action": "execute",
      "timestamp": 1234567890000,
      "taskName": "Feed the dog"
    }
  ],
  "total": 150,
  "offset": 0,
  "limit": 50
}
```

**Error Responses**:
- `400 Bad Request`: Invalid date format or parameters
- `403 Forbidden`: User not in household

---

#### GET `/events/my-history`
Retrieve event history for the authenticated user only.

**Authentication**: Required

**Query Parameters**: Same as `/events/history`

**Response** (200 OK): Same format as `/events/history`

---

### Tasks

#### POST `/tasks`
Create a new task in the household.

**Authentication**: Required (Household owner or admin)

**Request Body**:
```json
{
  "name": "Feed the dog",
  "description": "Feed Lenny his dinner",
  "category": "pets",
  "assignedTo": "uuid (optional, defaults to creator)"
}
```

**Response** (201 Created):
```json
{
  "taskId": "uuid",
  "name": "Feed the dog",
  "description": "Feed Lenny his dinner",
  "category": "pets",
  "createdBy": "uuid",
  "createdAt": 1234567890000,
  "isActive": true
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields or invalid data
- `403 Forbidden`: User lacks permission (not owner/admin)

---

#### GET `/tasks`
List all tasks in the household.

**Authentication**: Required

**Query Parameters**:
- `category`: Filter by category (optional)
- `active`: Filter by active status (true/false, default: true)

**Response** (200 OK):
```json
{
  "tasks": [
    {
      "taskId": "uuid",
      "name": "Feed the dog",
      "category": "pets",
      "createdBy": "uuid",
      "isActive": true,
      "lastExecutedAt": 1234567890000,
      "executionCount": 42
    }
  ],
  "total": 8
}
```

---

#### GET `/tasks/:taskId`
Get details of a specific task.

**Authentication**: Required

**Response** (200 OK):
```json
{
  "taskId": "uuid",
  "name": "Feed the dog",
  "description": "Feed Lenny his dinner",
  "category": "pets",
  "createdBy": "uuid",
  "createdAt": 1234567890000,
  "isActive": true,
  "lastExecutedAt": 1234567890000,
  "executionCount": 42,
  "tagId": "string (optional, if NFC tag assigned)"
}
```

**Error Responses**:
- `403 Forbidden`: User not in household
- `404 Not Found`: Task not found

---

#### PUT `/tasks/:taskId`
Update a task.

**Authentication**: Required (Task creator or household admin)

**Request Body**:
```json
{
  "name": "Updated name (optional)",
  "description": "Updated description (optional)",
  "category": "updated-category (optional)"
}
```

**Response** (200 OK): Updated task object

**Error Responses**:
- `400 Bad Request`: Invalid update data
- `403 Forbidden`: User lacks permission
- `404 Not Found`: Task not found

---

#### DELETE `/tasks/:taskId`
Deactivate a task (soft delete - preserves history).

**Authentication**: Required (Task creator or household admin)

**Response** (204 No Content)

**Error Responses**:
- `403 Forbidden`: User lacks permission
- `404 Not Found`: Task not found

---

### Users & Households

#### POST `/households`
Create a new household.

**Authentication**: Required (any user)

**Request Body**:
```json
{
  "name": "The Smith Family"
}
```

**Response** (201 Created):
```json
{
  "householdId": "uuid",
  "name": "The Smith Family",
  "createdBy": "uuid",
  "createdAt": 1234567890000,
  "memberCount": 1
}
```

---

#### GET `/households/:householdId`
Get household details.

**Authentication**: Required (household member)

**Response** (200 OK):
```json
{
  "householdId": "uuid",
  "name": "The Smith Family",
  "createdBy": "uuid",
  "createdAt": 1234567890000,
  "members": [
    {
      "userId": "uuid",
      "email": "alice@example.com",
      "role": "owner",
      "joinedAt": 1234567890000
    }
  ]
}
```

---

#### POST `/households/:householdId/members`
Invite a user to the household.

**Authentication**: Required (household owner)

**Request Body**:
```json
{
  "email": "bob@example.com",
  "role": "member"
}
```

**Response** (201 Created):
```json
{
  "userId": "uuid",
  "email": "bob@example.com",
  "role": "member",
  "invitedAt": 1234567890000,
  "status": "pending"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid email or role
- `403 Forbidden`: User not household owner
- `409 Conflict`: User already in household

---

#### DELETE `/households/:householdId/members/:userId`
Remove a member from the household.

**Authentication**: Required (household owner)

**Response** (204 No Content)

**Error Responses**:
- `403 Forbidden`: User not household owner
- `404 Not Found`: Member not found

---

#### PUT `/households/:householdId/members/:userId/role`
Update a member's role.

**Authentication**: Required (household owner)

**Request Body**:
```json
{
  "role": "owner" | "member"
}
```

**Response** (200 OK):
```json
{
  "userId": "uuid",
  "role": "owner",
  "updatedAt": 1234567890000
}
```

---

### Preferences

#### GET `/preferences`
Get notification preferences for the current user.

**Authentication**: Required

**Response** (200 OK):
```json
{
  "userId": "uuid",
  "notificationsEnabled": true,
  "quietHours": {
    "enabled": true,
    "startTime": "22:00",
    "endTime": "08:00"
  },
  "mutedTasks": ["uuid", "uuid"],
  "pushToken": "**masked**",
  "tokenUpdatedAt": 1234567890000
}
```

---

#### PUT `/preferences`
Update notification preferences.

**Authentication**: Required

**Request Body**:
```json
{
  "notificationsEnabled": true,
  "quietHours": {
    "enabled": true,
    "startTime": "22:00",
    "endTime": "08:00"
  },
  "mutedTasks": ["uuid"]
}
```

**Response** (200 OK): Updated preferences object

**Validation**:
- `quietHours.startTime` and `endTime` must be HH:MM format
- `mutedTasks` must contain valid task UUIDs

---

#### POST `/preferences/push-token`
Update push notification token.

**Authentication**: Required

**Request Body**:
```json
{
  "token": "fcm-token-or-apns-token",
  "platform": "android" | "ios" | "web"
}
```

**Response** (200 OK):
```json
{
  "token": "**masked**",
  "platform": "ios",
  "updatedAt": 1234567890000
}
```

**Notes**:
- Tokens are encrypted at rest in database
- Old tokens are marked inactive, not deleted
- Platform detection is automatic from token format

---

### NFC Tags

#### POST `/nfc-tags/validate`
Validate an NFC tag signature.

**Authentication**: Required

**Request Body**:
```json
{
  "tagId": "string",
  "signature": "64-char hex string",
  "timestamp": 1234567890000
}
```

**Response** (200 OK):
```json
{
  "valid": true,
  "tagId": "string",
  "validUntil": 1234567890000
}
```

**Error Responses**:
- `400 Bad Request`: Invalid signature format
- `403 Forbidden`: Invalid signature (constant-time comparison)

---

#### POST `/nfc-tags/register`
Register a new NFC tag for a task.

**Authentication**: Required (household owner)

**Request Body**:
```json
{
  "taskId": "uuid",
  "tagId": "string"
}
```

**Response** (201 Created):
```json
{
  "tagId": "string",
  "taskId": "uuid",
  "signature": "64-char hex string",
  "createdAt": 1234567890000
}
```

---

#### DELETE `/nfc-tags/:tagId`
Deactivate an NFC tag.

**Authentication**: Required (household owner)

**Response** (204 No Content)

---

## Example Requests

### Example 1: Create a Task and Execute via NFC Scan

```bash
# Create task
curl -X POST http://localhost:3000/tasks \
  -H "x-user-id: $USER_ID" \
  -H "x-household-id: $HOUSEHOLD_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Feed the dog",
    "category": "pets"
  }'

# Response:
# {"taskId": "123e4567-e89b-12d3-a456-426614174000", ...}

# Scan NFC tag
curl -X POST http://localhost:3000/events/tag-scanned \
  -H "x-user-id: $USER_ID" \
  -H "x-household-id: $HOUSEHOLD_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "tagId": "A1B2C3D4...",
    "tagSignature": "...",
    "taskId": "123e4567-e89b-12d3-a456-426614174000",
    "scannedAt": 1234567890000
  }'
```

### Example 2: Set Quiet Hours

```bash
curl -X PUT http://localhost:3000/preferences \
  -H "x-user-id: $USER_ID" \
  -H "x-household-id: $HOUSEHOLD_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "quietHours": {
      "enabled": true,
      "startTime": "22:00",
      "endTime": "08:00"
    }
  }'
```

### Example 3: Get Event History

```bash
curl http://localhost:3000/events/history \
  -H "x-user-id: $USER_ID" \
  -H "x-household-id: $HOUSEHOLD_ID" \
  -G \
  --data-urlencode "startDate=2024-01-01T00:00:00Z" \
  --data-urlencode "endDate=2024-01-31T23:59:59Z"
```

---

## Pagination

All list endpoints support limit/offset pagination:

```json
{
  "items": [...],
  "total": 150,
  "offset": 0,
  "limit": 50,
  "hasMore": true
}
```

---

## Versioning

API versioning via Accept header:
- `Accept: application/vnd.nfc-tag.v1+json` (current version)
- Deprecated endpoints still supported during transition (v0 → v1)
- Version sunset: 90 days notice before deprecation

---

## Support

For API issues or questions:
- GitHub Issues: https://github.com/yourusername/nfc-tag/issues
- Email: support@nfc-tag.app
