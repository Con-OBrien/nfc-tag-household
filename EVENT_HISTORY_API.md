# Event History API Documentation

**Task ID:** 25  
**Requirements:** 10.4, 10.5, 10.6, 10.7, 10.8  
**Status:** ✅ Implemented with comprehensive testing

## Overview

The Event History API provides endpoints for querying immutable event audit trails with support for:
- Reverse chronological ordering (newest events first)
- Date range filtering (up to 90 days)
- Action type filtering (execute, acknowledge, undo, comment)
- User-based event history across multiple households
- Pagination with configurable limits
- Strict household isolation enforcement

## API Endpoints

### 1. GET /api/households/:householdId/events

**Summary:** Retrieve event history for a specific household with advanced filtering and pagination.

**Authentication:** Required (JWT token or session)

**Path Parameters:**
- `householdId` (string, required): UUID of the household

**Query Parameters:**
- `action` (string, optional): Filter by event action type
  - Valid values: `execute`, `acknowledge`, `undo`, `comment`
  - Example: `?action=execute`

- `startDate` (number, optional): Unix timestamp (milliseconds) for range start (inclusive)
  - Example: `?startDate=1704067200000`

- `endDate` (number, optional): Unix timestamp (milliseconds) for range end (inclusive)
  - Example: `?endDate=1704153600000`
  - Note: Must be >= startDate

- `actor` (string, optional): Filter by userId who performed the action
  - Example: `?actor=user_123`

- `skip` (number, optional, default: 0): Pagination offset
  - Example: `?skip=20`

- `limit` (number, optional, default: 50): Maximum events per response
  - Maximum: 100
  - Example: `?limit=25`

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "eventId": "evt_20240115_001",
        "userId": "user_alice_123",
        "taskId": "task_lenny_dinner",
        "householdId": "hh_alice_bob",
        "action": "execute",
        "timestamp": 1705324800000,
        "metadata": {
          "deviceType": "nfc-reader"
        }
      },
      {
        "eventId": "evt_20240115_002",
        "userId": "user_bob_456",
        "taskId": "task_lenny_dinner",
        "householdId": "hh_alice_bob",
        "action": "acknowledge",
        "timestamp": 1705324700000,
        "metadata": {}
      }
    ],
    "total": 247,
    "skip": 0,
    "limit": 2
  },
  "timestamp": 1705324900000
}
```

**Error Responses:**

400 Bad Request - Invalid parameters:
```json
{
  "success": false,
  "error": "startDate must be a valid millisecond timestamp",
  "timestamp": 1705324900000
}
```

401 Unauthorized - Not authenticated:
```json
{
  "success": false,
  "error": "User not authenticated",
  "timestamp": 1705324900000
}
```

403 Forbidden - Not a household member:
```json
{
  "success": false,
  "error": "User is not a member of this household",
  "timestamp": 1705324900000
}
```

**Examples:**

Get all execute events in last 24 hours:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/households/hh_123/events?action=execute&startDate=1705238400000&endDate=1705324800000"
```

Get page of events with pagination:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/households/hh_123/events?skip=50&limit=25"
```

Get events from specific user:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/households/hh_123/events?actor=user_alice_123"
```

### 2. GET /api/households/:householdId/events/:eventId

**Summary:** Retrieve a single event by ID with full details.

**Authentication:** Required (JWT token or session)

**Path Parameters:**
- `householdId` (string, required): UUID of the household
- `eventId` (string, required): UUID of the event

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "eventId": "evt_20240115_001",
    "userId": "user_alice_123",
    "taskId": "task_lenny_dinner",
    "householdId": "hh_alice_bob",
    "action": "execute",
    "timestamp": 1705324800000,
    "metadata": {
      "deviceType": "nfc-reader",
      "notes": "Successfully completed task"
    }
  },
  "timestamp": 1705324900000
}
```

**Error Responses:**

404 Not Found - Event or household doesn't exist:
```json
{
  "success": false,
  "error": "Event not found",
  "timestamp": 1705324900000
}
```

### 3. GET /api/users/me/events

**Summary:** Retrieve authenticated user's personal event history across all their households.

**Authentication:** Required (JWT token or session)

**Query Parameters:**
- `action` (string, optional): Filter by event action type
  - Valid values: `execute`, `acknowledge`, `undo`, `comment`

- `startDate` (number, optional): Unix timestamp (milliseconds) for range start
  - Example: `?startDate=1704067200000`

- `endDate` (number, optional): Unix timestamp (milliseconds) for range end
  - Example: `?endDate=1704153600000`

- `skip` (number, optional, default: 0): Pagination offset

- `limit` (number, optional, default: 50): Maximum events per response (max: 100)

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "eventId": "evt_20240115_003",
        "userId": "user_alice_123",
        "taskId": "task_balcony_clean",
        "householdId": "hh_alice_bob",
        "action": "execute",
        "timestamp": 1705324800000,
        "metadata": {}
      },
      {
        "eventId": "evt_20240114_001",
        "userId": "user_alice_123",
        "taskId": "task_grocery_shopping",
        "householdId": "hh_alice_family",
        "action": "acknowledge",
        "timestamp": 1705238400000,
        "metadata": {}
      }
    ],
    "total": 156,
    "skip": 0,
    "limit": 2
  },
  "timestamp": 1705324900000
}
```

**Notes:**
- Returns events from all households the user is a member of
- Results maintain reverse chronological order across all households
- Aggregates events before pagination

**Examples:**

Get all user's acknowledge events in last 7 days:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/users/me/events?action=acknowledge&startDate=1704719200000&endDate=1705324800000"
```

## Filtering and Sorting

### Action Type Filtering
Supported action types:
- `execute`: User triggered a task via NFC scan or direct action
- `acknowledge`: User acknowledged completion of a task
- `undo`: User undid a previously executed task
- `comment`: User added a comment or note to a task

### Date Range Filtering
- **Format**: Unix milliseconds (e.g., `new Date().getTime()`)
- **Range**: Up to 90 days maximum to prevent resource exhaustion
- **Inclusivity**: Both startDate and endDate are inclusive
- **Validation**: startDate must be <= endDate

### Reverse Chronological Ordering
- All events returned sorted by timestamp in descending order
- Newest events appear first
- Applies to both household and user event queries
- Maintained across multiple households in user event aggregation

## Pagination

All event endpoints support pagination using `skip` and `limit` parameters:

- **Default limit**: 50 events per response
- **Maximum limit**: 100 events per response
- **Skip offset**: 0-based index

Example: Get events 50-75 (25 events starting at offset 50)
```bash
?skip=50&limit=25
```

## Data Model

### TaskEvent Object

```typescript
{
  // Unique identifier for this event
  eventId: string;
  
  // User who triggered the event
  userId: string;
  
  // Task being acted upon
  taskId: string;
  
  // Household this event belongs to
  householdId: string;
  
  // Type of action performed
  action: "execute" | "acknowledge" | "undo" | "comment";
  
  // When event occurred (Unix milliseconds)
  timestamp: number;
  
  // Optional metadata specific to action
  metadata?: {
    // For acknowledgments
    acknowledged?: boolean;
    
    // For comments/notes
    notes?: string;
    
    // Device type
    deviceType?: "mobile" | "web" | "nfc-reader";
    
    // Any other custom metadata
    [key: string]: unknown;
  };
}
```

## Performance Characteristics

### Query Execution Time
- Household events: < 100ms for typical queries (< 30 days)
- User events: < 500ms for typical queries (< 30 days, multiple households)
- Depends on event volume and date range

### Database Indexes
- `(householdId, timestamp)`: Household event queries
- `(householdId, userId, timestamp)`: User event queries
- `(taskId, householdId, timestamp)`: Task event queries

### Pagination Performance
- Recommend limit <= 50 for optimal performance
- Maximum limit 100 per request
- Use skip/limit for large datasets, not full scans

## Security Considerations

### Household Isolation
- User membership verified before returning events
- Cannot access events from households they don't belong to
- Returns 403 Forbidden if access attempt made

### Authentication
- All endpoints require authentication
- Returns 401 Unauthorized if not authenticated
- Uses session/JWT token validation

### Rate Limiting
- Recommend implementing rate limits (e.g., 100 requests/minute)
- 90-day date window prevents DOS attacks
- 100-event page size limits response sizes

### Data Privacy
- Event details are private to household members only
- User IDs are visible within shared household context
- Email/phone not returned in event data

## Error Handling

### Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request - Invalid parameters | Fix request parameters and retry |
| 401 | Unauthorized - Not authenticated | Include valid authentication token |
| 403 | Forbidden - Not household member | Cannot access this household |
| 404 | Not Found - Event/household missing | Verify IDs and retry |
| 500 | Server Error | Retry after brief delay |

### Validation Errors

**Missing parameters:**
```json
{
  "success": false,
  "error": "householdId is required"
}
```

**Invalid pagination:**
```json
{
  "success": false,
  "error": "skip and limit must be valid integers"
}
```

**Invalid date range:**
```json
{
  "success": false,
  "error": "startDate must be before endDate"
}
```

## Testing

### Unit Tests
17 unit tests covering:
- Reverse chronological ordering
- Date range filtering
- Action type filtering
- Pagination logic
- Household isolation
- Event aggregation

### Integration Tests
26 integration tests covering:
- Parameter validation
- Request/Response behavior
- Response format validation
- HTTP status codes
- Authentication requirements
- Error scenarios

**Total:** 43 passing tests

## Implementation Details

### Reverse Chronological Ordering
- All repository queries order by `timestamp DESC`
- Ensures newest events always returned first
- Implemented at database level for performance

### Date Range Queries
- Uses database indexes for efficient filtering
- Validates date ranges before execution
- Supports up to 90-day windows

### User Event Aggregation
- Fetches user's household list first
- Queries events for each household
- Combines results and sorts by timestamp
- Applies pagination on combined results

## Related Endpoints

- `POST /api/events/tag-scanned`: Create new events from NFC scans
- `GET /api/tasks/:taskId`: Get task details
- `GET /api/households/:householdId`: Get household info

## Changelog

### Version 1.0 (Initial Release)
- ✅ Household event history endpoint
- ✅ User personal event history endpoint
- ✅ Date range filtering
- ✅ Action type filtering
- ✅ Pagination support
- ✅ Reverse chronological ordering
- ✅ Household isolation enforcement
- ✅ Comprehensive test coverage (43 tests)

## Contact & Support

For implementation issues or questions about the event history API:
1. Check this documentation
2. Review test files for usage examples
3. Review EventController source code
4. Contact the development team
