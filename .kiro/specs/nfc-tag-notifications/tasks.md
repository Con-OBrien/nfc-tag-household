# Implementation Plan: NFC Tag Notifications System (Windows + iOS + Free Tier)

## Overview

This implementation plan breaks down the NFC Tag Notifications System into discrete, manageable tasks optimized for **Windows-based backend development**, **iOS-only mobile support**, and **free tier cloud services**. The plan covers backend API development on Windows using Node.js/TypeScript, PostgreSQL/Redis on free tiers, GitHub Actions CI/CD for iOS builds, and efficient notification delivery via Firebase Cloud Messaging.

The system architecture consists of five primary layers: iOS NFC Interface Layer (Core NFC only), Event Processing Layer, Notification Service, Data Persistence Layer (PostgreSQL), and User Management. All backend tasks are Windows-compatible, and mobile integration is iOS-specific with optional web fallback support. Tasks are organized to implement each layer systematically, with property-based tests validating correctness properties defined in the design document.

**Key Optimizations**:
- All backend tasks fully compatible with Windows (Node.js, TypeScript, PostgreSQL, Redis)
- iOS-only mobile support using Core NFC framework
- Free tier services: Render.com or Railway for PostgreSQL, Redis Cloud free tier, Firebase free plan, GitHub Actions
- GitHub Actions workflows for automated iOS CI/CD builds and testing
- No Android-specific code or cross-platform complexity

## Tasks

### Phase 1: Project Setup and Core Infrastructure

- [ ] 1. Initialize project structure and dependencies
  - Set up TypeScript project with Express.js or NestJS backend framework
  - Configure build tools, linting (ESLint), and code formatting (Prettier)
  - Set up testing framework (Jest) and property-based testing library (fast-check)
  - Create project directory structure following domain-driven design principles
  - Install core dependencies: database drivers (PostgreSQL/MongoDB), authentication libraries
  - _Requirements: General setup_

- [ ] 2. Set up database and connection layer
  - Create PostgreSQL or MongoDB database with connection pooling
  - Set up database migration system (e.g., TypeORM migrations or Prisma)
  - Configure development, test, and production database environments
  - Create connection wrapper with error handling and retry logic
  - _Requirements: 13.1, 13.2, 13.3_

- [ ] 3. Create core TypeScript interfaces and type definitions
  - Define `NFCTagData`, `TaskEvent`, `Task`, `HouseholdUser`, `Household` interfaces
  - Define all request/response types for API endpoints
  - Create error and validation types
  - Set up type validation utilities
  - _Requirements: 1.1, 2.1, 3.1_

- [ ] 4. Set up authentication and session management
  - Implement user authentication service (Firebase Auth or JWT-based)
  - Create session token generation and validation
  - Set up middleware for request authentication
  - Implement role-based access control checks
  - _Requirements: 11.1, 11.2, 11.3_

### Phase 2: Data Persistence Layer

- [ ] 5. Implement TaskRepository for task data management
  - Create database schema for tasks table with indexes on (householdId, taskId, userId)
  - Implement `findTaskById()` method with household isolation
  - Implement `findTasksByHousehold()` with filtering by category and active status
  - Implement `createTask()` with validation and atomic write
  - Implement `updateTask()` for task metadata updates
  - Implement `deactivateTask()` preserving historical records
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 13.1_

- [ ]* 5.1 Write property test for task repository idempotence
  - **Property 5: Event Audit Trail Completeness**
  - **Validates: Requirements 7.1, 7.5, 13.1, 13.2**
  - Use fast-check to generate task creation and update sequences
  - Verify that concurrent task operations maintain consistency

- [ ] 6. Implement EventRepository for audit trail logging
  - Create database schema for taskEvents table with indexes on (householdId, taskId, userId, timestamp)
  - Implement `logEvent()` with immutable audit entries (no update/delete)
  - Implement `getEventHistory()` returning events in reverse chronological order
  - Implement `getEventsByUser()` filtering by user across households
  - Implement `queryEventsByDateRange()` with efficient date filtering
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 13.1_

- [ ]* 6.1 Write property test for event audit trail immutability
  - **Property 5: Event Audit Trail Completeness**
  - **Validates: Requirements 10.2, 10.3, 13.1**
  - Generate task events and verify they cannot be modified
  - Verify all event details are persisted exactly once

- [ ] 7. Implement UserRepository for user and household member management
  - Create database schema for users and households tables
  - Implement `findUserById()` with push token and preferences
  - Implement `findUsersInHousehold()` with role filtering
  - Implement `updateUserPushToken()` marking old tokens as inactive
  - Implement `updateUserPreferences()` for notification settings
  - Create schema for user notification preferences (quiet hours, muted tasks)
  - _Requirements: 8.1, 8.2, 8.3, 9.1, 12.1, 12.2, 12.3, 12.4, 13.1_

- [ ]* 7.1 Write property test for household isolation
  - **Property 4: Household Isolation**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 8.2**
  - Generate queries from users in different households
  - Verify that users can only access their own household data

- [ ] 8. Implement HouseholdRepository for household management
  - Create database schema for household settings and member lists
  - Implement `createHousehold()` with unique identifier assignment
  - Implement `addUserToHousehold()` with default role assignment
  - Implement `removeUserFromHousehold()` revoking access
  - Implement `getHouseholdInfo()` with member list and settings
  - Implement `updateUserRole()` managing owner/member roles
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [ ] 9. Checkpoint - Verify database layer tests pass
  - Run all tests in tasks 5-8 and verify 100% pass rate
  - Verify schema migrations run successfully
  - Verify indexes are created and queries use them efficiently
  - Ask the user if questions arise.

### Phase 3: Core Event Processing

- [ ] 10. Implement NFC Reader Interface and tag validation
  - Create NFC reader wrapper for both iOS and Android
  - Implement `validateTagSignature()` using HMAC comparison (constant-time)
  - Implement tag data extraction and parsing
  - Add support for tag deactivation tracking
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 16.1, 16.2, 16.3, 16.4, 16.5_

- [ ]* 10.1 Write unit tests for NFC tag validation
  - Test valid and invalid signatures
  - Test corrupted tag data handling
  - Test signature verification with timing attack prevention

- [ ] 11. Implement Event Processor core logic
  - Create EventProcessor class with `processTagEvent()` method
  - Implement duplicate detection for scans within 30 seconds of same task/user
  - Implement user context enrichment (userId, householdId)
  - Create event integrity validation
  - Add event emission to notification queue
  - _Requirements: 2.1, 2.2, 2.3, 1.4, 2.5_

- [ ]* 11.1 Write property test for event processing idempotence
  - **Property 1: Tag Event Processing Idempotence**
  - **Validates: Requirements 1.4, 2.1, 2.5**
  - Use fast-check to generate duplicate NFC scan sequences
  - Verify that multiple identical scans create only one event

- [ ] 12. Implement Task Validator with permission checks
  - Create TaskValidator class implementing all validation methods
  - Implement `validateTaskExists()` checking active status
  - Implement `validateUserPermission()` checking household membership
  - Implement `validateTaskCanExecute()` with comprehensive permission checks
  - Implement `listAvailableTasks()` returning only executable tasks for user
  - Add detailed error messages for each validation failure
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ]* 12.1 Write property test for user authorization enforcement
  - **Property 3: User Authorization Enforcement**
  - **Validates: Requirements 3.2, 3.3, 3.7, 11.4, 11.5**
  - Generate random user/task combinations with and without permissions
  - Verify unauthorized users are always rejected consistently

- [ ] 13. Implement rate limiting and anti-abuse checks
  - Create rate limiter for scans (1 per task per user per 30 seconds)
  - Implement temporary suspension for repeated violations
  - Add rate limit tracking to cache (Redis or in-memory)
  - Implement exponential backoff for suspended users
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [ ]* 13.1 Write unit tests for rate limiting
  - Test scan frequency validation
  - Test suspension and expiration
  - Test concurrent scan attempts

- [ ] 14. Checkpoint - Verify event processing tests pass
  - Run all tests in tasks 10-13 and verify 100% pass rate
  - Verify duplicate detection works correctly
  - Verify all authorization failures are properly rejected
  - Ask the user if questions arise.

### Phase 4: Notification Service

- [ ] 15. Implement Notification Service core methods
  - Create NotificationService class with push service integration
  - Implement `sendNotification()` with FCM/APNs platform routing
  - Implement `sendToHouseholdMembers()` identifying eligible recipients
  - Add recipient exclusion logic for task executor
  - Create notification payload formatting with task details and deep links
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_

- [ ] 16. Implement user preference filtering for notifications
  - Implement notifications enabled/disabled check
  - Implement task muting check (exclude specific tasks)
  - Implement quiet hours check (24-hour format validation)
  - Create preference evaluation logic with early exit optimizations
  - _Requirements: 4.3, 4.4, 4.5, 4.6, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ]* 16.1 Write property test for notification delivery consistency
  - **Property 2: Notification Delivery Consistency**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.7, 9.2, 9.3, 9.4, 9.5, 9.6**
  - Generate household members with various preference configurations
  - Verify that eligible members receive notifications respecting preferences

- [ ] 17. Implement retry logic with exponential backoff
  - Create retry mechanism for failed deliveries (1s, 2s, 4s waits)
  - Implement max 3 attempts enforcement
  - Add failure logging with error classification
  - Create delivery status tracking in audit log
  - _Requirements: 5.4, 5.5, 5.6, 14.3, 14.4_

- [ ] 18. Implement FCM (Android) and APNs (iOS) integration
  - Create FCM client with API credentials
  - Create APNs client with certificate configuration
  - Implement platform detection from push token format
  - Add fallback handling for platform-specific failures
  - _Requirements: 5.3, 21.1, 21.2, 21.3_

- [ ]* 18.1 Write unit tests for FCM and APNs integration
  - Test successful delivery to both platforms
  - Test token expiration handling
  - Test payload formatting for each platform

- [ ] 19. Implement push token lifecycle management
  - Create token registration on user login
  - Implement token rotation tracking (old vs. new tokens)
  - Add automatic token deactivation on expiration errors
  - Implement account deletion token cleanup
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [ ]* 19.1 Write property test for push token rotation safety
  - **Property 6: Push Token Rotation Safety**
  - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
  - Generate token rotation sequences with concurrent notification delivery
  - Verify no notifications are lost during token transitions

- [ ] 20. Checkpoint - Verify notification service tests pass
  - Run all tests in tasks 15-19 and verify 100% pass rate
  - Test notification delivery with multiple recipients and preferences
  - Verify retry logic works correctly with failed deliveries
  - Ask the user if questions arise.

### Phase 5: User Management and Household Operations

- [ ] 21. Implement household creation and initialization
  - Create API endpoint for household creation
  - Implement creator assignment as initial owner
  - Set up default task categories
  - Initialize household settings
  - _Requirements: 8.1, 8.2, 20.1, 20.2_

- [ ] 22. Implement user invitation and membership management
  - Create API endpoint for inviting users to household
  - Implement user addition with default member role
  - Create role promotion/demotion functionality
  - Implement user removal with access revocation
  - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [ ] 23. Implement notification preference settings API
  - Create endpoints for getting/updating user preferences
  - Implement preference validation (quiet hours format, task muting)
  - Add real-time preference application
  - Create preference change audit logging
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

- [ ] 24. Implement task creation and management API endpoints
  - Create POST endpoint for task creation with validation
  - Create PUT endpoint for task updates
  - Create endpoint for task deactivation
  - Create GET endpoints for listing tasks by household/category
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

- [ ]* 24.1 Write unit tests for task management endpoints
  - Test task creation validation
  - Test permission checks for updates/deletion
  - Test category filtering

- [ ] 25. Implement event history query endpoints
  - Create endpoint for task event history (reverse chronological)
  - Create endpoint for user personal event history
  - Implement date range filtering
  - Implement action type filtering
  - _Requirements: 10.4, 10.5, 10.6, 10.7, 10.8_

- [ ]* 25.1 Write unit tests for event history queries
  - Test reverse chronological ordering
  - Test date range filtering
  - Test household isolation in queries

- [ ] 26. Checkpoint - Verify user management and API layer
  - Run all tests in tasks 21-25 and verify 100% pass rate
  - Verify household isolation in all endpoints
  - Verify role-based access control for all operations
  - Ask the user if questions arise.

### Phase 6: NFC Event Ingestion API

- [ ] 27. Implement POST /events/tag-scanned endpoint
  - Create main NFC scan event ingestion endpoint
  - Implement request parsing and validation
  - Wire event processor for tag-scanned events
  - Implement error response formatting
  - _Requirements: 1.1, 2.1, 3.1, 5.1_

- [ ] 28. Implement complete event processing pipeline
  - Wire NFC reader → Event Processor → Task Validator → Notification Service
  - Implement error handling at each stage with appropriate HTTP status codes
  - Add transaction management for event persistence
  - Implement success/failure response formatting
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ]* 28.1 Write integration test for complete event pipeline
  - Test successful end-to-end flow from scan to notification
  - Test failure scenarios at each stage
  - Test error recovery and retry logic

- [ ] 29. Implement event logging and observability
  - Add structured logging for event processing (latency, timestamps)
  - Implement authorization failure logging
  - Add database query logging
  - Create error logging with stack traces
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

- [ ] 30. Implement health check and monitoring endpoints
  - Create `/health` endpoint checking database and push service connectivity
  - Implement metrics collection for event processing latency
  - Add notification delivery success rate tracking
  - Create endpoints for accessing system metrics
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [ ] 31. Checkpoint - Verify API endpoints work end-to-end
  - Run all tests in tasks 27-30 and verify 100% pass rate
  - Test complete workflow from NFC scan to notification delivery
  - Test error scenarios and recovery mechanisms
  - Ask the user if questions arise.

### Phase 7: Security and Encryption

- [ ] 32. Implement HTTPS/TLS configuration
  - Configure TLS 1.2+ for all HTTP connections
  - Set up certificate management
  - Implement request/response encryption in transit
  - _Requirements: 18.1_

- [ ] 33. Implement encryption at rest for sensitive data
  - Create AES-256 encryption for push tokens in database
  - Implement field-level encryption for PII (email, phone)
  - Create encryption key management (rotation capability)
  - _Requirements: 18.2, 18.3, 18.4, 18.5_

- [ ] 34. Implement secure data deletion for account cleanup
  - Create secure deletion for push tokens on account deletion
  - Implement PII removal from audit logs (if needed for compliance)
  - Create retention policy enforcement (90 days minimum, archive older)
  - _Requirements: 18.4, 23.7_

- [ ] 35. Implement NFC tag security infrastructure
  - Create household-specific HMAC key generation and storage
  - Implement tag signature generation for new tags
  - Create tag deactivation endpoint
  - Implement key rotation with re-signing of existing tags
  - _Requirements: 16.1, 16.4, 16.6_

- [ ] 36. Checkpoint - Verify security measures are in place
  - Verify HTTPS enforced for all endpoints
  - Verify encryption at rest for sensitive fields
  - Verify tag signatures are properly validated
  - Ask the user if questions arise.

### Phase 8: iOS Mobile Client Integration and GitHub Actions CI/CD

- [ ] 37. Implement iOS NFC integration (Core NFC Framework)
  - Create NFC reader wrapper using Core NFC (iOS 13+)
  - Implement tag detection and NDEF message extraction
  - Add error handling for NFC-related failures (hardware not available, timeout, invalid tag)
  - Create NFC session lifecycle management (start/stop listening)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 21.4_

- [ ]* 37.1 Write unit tests for iOS NFC integration
  - Test tag detection and data extraction
  - Test error scenarios (invalid tags, hardware unavailable)
  - Test NFC session lifecycle

- [ ] 38. Implement optional web-based NFC fallback (for desktop testing)
  - Create web NFC API wrapper (Safari 14+, Chrome Android)
  - Implement graceful fallback UI when Core NFC unavailable
  - Mock NFC scanner for local development and testing
  - _Requirements: 21.6 (optional web support)_

- [ ] 39. Implement iOS-optimized NFC abstraction layer
  - Create unified NFC interface for iOS (primary) with optional web fallback
  - Implement platform detection and routing (iOS Core NFC → fallback)
  - Add notification handling from iOS push service
  - Eliminate cross-platform complexity (Android-specific code removed)
  - _Requirements: 21.1, 21.2, 21.3, 21.4_

- [ ] 40. Set up GitHub Actions CI/CD pipeline for iOS builds
  - Create GitHub Actions workflow for automated iOS builds
  - Configure macOS runner for Xcode compilation
  - Set up automatic code signing with GitHub Secrets
  - Implement automated testing on each push to develop branch
  - Configure artifact upload for build outputs
  - _Requirements: Automated CI/CD_

- [ ] 41. Implement iOS app configuration for free tier services
  - Configure Firebase Cloud Messaging (FCM) for free plan tier
  - Set up iOS app push certificate in Firebase Console
  - Implement push token registration on app launch
  - Configure remote config for feature flags (free tier)
  - _Requirements: 21.1, 21.2, 21.3, 5.3_

- [ ] 42. Implement offline queue and sync mechanism for iOS
  - Create local queue for failed/pending NFC scans (Core Data)
  - Implement queue persistence to device storage
  - Create sync mechanism with timestamp preservation
  - Test offline/online transitions with network toggling
  - _Requirements: 22.1, 22.2, 22.3_

- [ ]* 42.1 Write unit tests for iOS offline functionality
  - Test queue persistence and restoration
  - Test cache synchronization on reconnect
  - Test timestamp preservation for queued events

- [ ] 43. Implement cached task display for offline support (iOS)
  - Create local caching of task information using Core Data
  - Implement cache invalidation on sync
  - Disable task creation/modification when offline (read-only mode)
  - Show last-sync timestamp to user
  - _Requirements: 22.4, 22.5, 22.6_

- [ ] 44. Implement iOS push notification handler
  - Create notification reception handler for APNs/FCM on iOS
  - Implement deep link navigation to task details
  - Add notification action handling (dismiss, snooze)
  - Handle notification delivery when app in foreground/background
  - _Requirements: 5.1, 5.2, 21.1, 21.2, 21.3_

- [ ]* 44.1 Write integration test for iOS push notification flow
  - Test notification reception in foreground and background
  - Test deep link navigation
  - Test notification actions

- [ ] 45. GitHub Actions: Configure automated iOS testing
  - Set up unit test execution in CI pipeline
  - Configure code coverage reporting (Codecov integration)
  - Set up UI testing on physical simulator in CI
  - Create build failure notifications
  - _Requirements: Automated testing_

- [ ] 46. GitHub Actions: Set up iOS app store distribution (optional)
  - Configure TestFlight beta build distribution
  - Implement automatic version bumping
  - Create release notes generation from commits
  - Set up App Store Connect API integration
  - _Requirements: Optional deployment automation_

- [ ] 47. Checkpoint - Verify iOS mobile integration works
  - Test NFC scanning on iOS device
  - Test offline queue and sync functionality
  - Test push notification reception and handling
  - Verify GitHub Actions CI/CD pipeline executes successfully
  - Ask the user if questions arise.

### Phase 9: Error Handling and Recovery

- [ ] 48. Implement comprehensive error handling for NFC operations
  - Handle invalid/corrupted tag data with user-friendly errors
  - Implement tag expiration detection
  - Add retry logic for transient NFC failures (iOS-specific)
  - _Requirements: 1.5, 14.1_

- [ ] 49. Implement database error handling and recovery
  - Create retry mechanism for database connection failures (PostgreSQL)
  - Implement connection pool recovery (node-postgres)
  - Add transaction rollback on write failures
  - _Requirements: 13.3, 13.6, 13.7, 14.5_

- [ ] 50. Implement external service failure handling
  - Create fallback for FCM unavailability
  - Implement notification queuing during service outages (free tier limitations)
  - Add automatic retry on service restoration
  - _Requirements: 14.6, 14.7_

- [ ] 51. Implement inconsistency detection and alerting
  - Create data consistency checks (PostgreSQL constraints)
  - Add alerts for detected inconsistencies (email via SendGrid free tier)
  - Implement logging of inconsistent state
  - _Requirements: 14.4, 14.7_

- [ ] 52. Implement graceful degradation strategies
  - Create fallback notification channels (queuing for retry)
  - Implement feature flag system for selective disabling (Firebase Remote Config)
  - Add circuit breaker pattern for external dependencies
  - _Requirements: 22.1, 22.2, 22.3_

- [ ] 53. Checkpoint - Verify error handling comprehensive
  - Simulate various failure scenarios
  - Verify all errors are properly logged
  - Verify system recovers gracefully from failures
  - Ask the user if questions arise.

### Phase 10: Testing and Quality Assurance

- [ ] 54. Write comprehensive unit tests for all components
  - Create unit tests for NFC reader validation (iOS)
  - Create unit tests for event processor logic
  - Create unit tests for task validator
  - Create unit tests for notification service (mocking Firebase/FCM)
  - Target 80%+ code coverage for all core components
  - _Requirements: General QA_

- [ ]* 54.1 Write integration tests for full workflows
  - Test complete NFC scan → event → notification flow
  - Test concurrent user operations
  - Test error scenarios and recovery
  - Test household isolation enforcement

- [ ] 55. Create load testing scenarios
  - Create test scenarios for concurrent NFC scans
  - Test high-frequency task execution patterns
  - Measure event processing latency under load
  - Verify performance targets (500ms event processing, 100ms queries)
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [ ] 56. Create security testing scenarios
  - Test unauthorized access attempts
  - Test cross-household access attempts
  - Test rate limiting enforcement
  - Test signature validation bypass attempts
  - Test encryption of sensitive data
  - _Requirements: 16.1, 16.2, 16.3, 16.5, 16.6, 17.1, 17.2, 17.3_

- [ ]* 56.1 Write integration test for security policies
  - Test household isolation across all operations
  - Test permission enforcement in all scenarios
  - Verify all sensitive operations are logged

- [ ] 57. Create backward compatibility tests
  - Test API response parsing with older client versions
  - Verify schema migrations preserve data (PostgreSQL)
  - Test deprecated endpoint availability during transition
  - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

- [ ] 58. Final comprehensive checkpoint - All tests pass
  - Run complete test suite including unit, integration, property-based tests
  - Verify code coverage targets met (80%+)
  - Verify all performance targets met
  - Verify all security controls functional
  - Ask the user if questions arise and address any blockers.

### Phase 11: Documentation and Deployment Preparation

- [ ] 59. Create API documentation
  - Document all REST endpoints with request/response examples
  - Create error code documentation
  - Document authentication and authorization requirements
  - Create rate limiting documentation
  - _Requirements: General deliverable_

- [ ] 60. Create operational runbook
  - Document system architecture and component interactions
  - Create troubleshooting guide for common issues
  - Document monitoring and alerting setup (free tier)
  - Create backup and recovery procedures (PostgreSQL)
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

- [ ] 61. Create database migration scripts (PostgreSQL)
  - Document all schema changes with migration steps
  - Create rollback procedures for each migration
  - Test migrations on staging database
  - _Requirements: 13.1, 13.2, 13.3_

- [ ] 62. Prepare deployment configuration for Windows + free tier
  - Create environment configuration templates (dev/test/prod)
  - Document secret management (GitHub Secrets for CI/CD)
  - Create deployment scripts for Render.com or Railway (free PostgreSQL)
  - Document free tier service limits and workarounds
  - _Requirements: General deployment_

- [ ] 63. Document free tier service setup and monitoring
  - Firebase free plan quotas and optimization tips
  - Redis Cloud free tier configuration
  - PostgreSQL free tier best practices
  - GitHub Actions free tier CI/CD configuration
  - Monitoring and logging with free tools (Loggly, Sentry)
  - _Requirements: General deployment_

- [ ] 64. Final checkpoint - System ready for deployment
  - Verify all documentation is complete and accurate
  - Verify deployment scripts tested on free tier services
  - Verify all tests passing on clean environment
  - Verify iOS CI/CD pipeline working end-to-end
  - Ask the user if questions arise before go-live.

## Notes

- Tasks marked with `*` are optional test-related sub-tasks and can be skipped for faster MVP delivery, but are strongly recommended for production quality
- Each task references specific requirements for full traceability
- Core implementation tasks (without `*`) must be completed for system functionality
- Checkpoints are included at logical breaks to verify functionality before proceeding
- Property-based tests validate universal correctness properties across generated input ranges
- Performance targets: 500ms event processing, 100ms query latency for household tasks, 5-minute notification retry window

**Windows Development Setup**:
- Backend fully compatible with Windows (Node.js/TypeScript/Express.js on any OS)
- Use Windows Terminal for PowerShell/cmd execution
- PostgreSQL can be hosted on Render.com or Railway (free tier)
- Redis Cloud free tier for caching and session management
- All backend tasks work with standard npm/yarn on Windows

**iOS-Only Mobile Support**:
- Core NFC Framework (iOS 13+) for NFC scanning
- Firebase Cloud Messaging for push notifications
- Core Data for local offline storage
- GitHub Actions macOS runners for Xcode CI/CD builds
- TestFlight for beta distribution (free with Apple Developer account)
- Web fallback available for desktop/testing (optional)

**Free Tier Services Configuration**:
- **PostgreSQL**: Render.com or Railway free tier (512MB storage, auto-sleep)
- **Redis**: Redis Cloud free tier (30MB, 30 connections)
- **Firebase**: Free plan (FCM notifications, 1GB storage, 100 concurrent connections)
- **GitHub Actions**: 2,000 free minutes/month for private repos (sufficient for CI testing)
- **Monitoring**: Sentry free tier for error tracking, Loggly free tier for logs

**Migration from Cross-Platform to iOS**:
- Task 38: Android integration completely removed (no duplicate code)
- Task 39: Simplified to iOS + optional web (reduced complexity)
- Tasks 37-46: iOS-specific implementation using Core NFC, Core Data
- GitHub Actions workflows (40, 45, 46) handle iOS build automation without native Android requirement

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1", "2", "3", "4"]
    },
    {
      "id": 1,
      "tasks": ["5", "6", "7", "8"]
    },
    {
      "id": 2,
      "tasks": ["5.1", "6.1", "7.1"]
    },
    {
      "id": 3,
      "tasks": ["10", "11", "12", "13"]
    },
    {
      "id": 4,
      "tasks": ["10.1", "11.1", "12.1", "13.1"]
    },
    {
      "id": 5,
      "tasks": ["15", "16", "17", "18", "19"]
    },
    {
      "id": 6,
      "tasks": ["16.1", "18.1", "19.1"]
    },
    {
      "id": 7,
      "tasks": ["21", "22", "23", "24", "25"]
    },
    {
      "id": 8,
      "tasks": ["24.1", "25.1"]
    },
    {
      "id": 9,
      "tasks": ["27", "28", "29", "30"]
    },
    {
      "id": 10,
      "tasks": ["28.1"]
    },
    {
      "id": 11,
      "tasks": ["32", "33", "34", "35"]
    },
    {
      "id": 12,
      "tasks": ["37", "38", "39", "40", "41", "42"]
    },
    {
      "id": 13,
      "tasks": ["41.1"]
    },
    {
      "id": 14,
      "tasks": ["44", "45", "46", "47", "48"]
    },
    {
      "id": 15,
      "tasks": ["50", "51", "52", "53"]
    },
    {
      "id": 16,
      "tasks": ["50.1", "52.1"]
    },
    {
      "id": 17,
      "tasks": ["55", "56", "57", "58"]
    }
  ]
}
```

## Task Categories by System Component

### Backend API & Event Processing (Tasks 1-31)
- Core infrastructure, database layer, event processing pipeline, notification service, user management, API endpoints

### Mobile Client Integration (Tasks 37-43)
- iOS/Android NFC integration, offline support, push notification handling

### Quality Assurance & Security (Tasks 50-53)
- Comprehensive testing, security validation, performance verification

### Production Readiness (Tasks 54-59)
- Documentation, deployment preparation, operational readiness

## Estimated Effort by Component

- **Database Layer**: 3-4 days
- **Event Processing**: 2-3 days
- **Notification Service**: 3-4 days
- **User Management & API**: 2-3 days
- **Security & Encryption**: 1-2 days
- **Mobile Integration**: 3-4 days
- **Error Handling**: 1-2 days
- **Testing & QA**: 3-4 days
- **Documentation & Deployment**: 1-2 days
- **Total Estimated Effort**: 20-28 days

