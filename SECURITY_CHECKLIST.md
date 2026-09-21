# Security Checklist - Before Going Public

Use this checklist to verify all security measures are in place before pushing to GitHub.

## Pre-Push Verification

### Environment Variables & Secrets

- [ ] No .env file exists in repository (or is in .gitignore)
- [ ] No .env.development, .env.staging, .env.production files exist
- [ ] .env.example contains only placeholder values (no real secrets)
- [ ] JWT_SECRET removed from auth.ts fallback
- [ ] ENCRYPTION_KEY removed from code (only in env vars)
- [ ] No hardcoded API keys in source files
- [ ] No hardcoded database passwords in source files

### Certificates & Keys

- [ ] No .pem files in repository
- [ ] No .key files in repository  
- [ ] No *.p12 or *.pfx files in repository
- [ ] No irebase-key.json file in repository
- [ ] No pns-cert.pem or pns-key.pem in repository
- [ ] certs/ and secrets/ directories in .gitignore

### File Permissions

- [ ] Private key files are not world-readable (on Unix systems)
- [ ] Secret files are not synced to cloud storage
- [ ] No sensitive files in IDE workspace files

### Git History

- [ ] Ran \git log -p --all -S 'secret' | head -20\ (no real secrets found)
- [ ] Ran \git log -p --all -S 'password' | head -20\ (no real secrets found)
- [ ] Ran \git log -p --all -S 'api' | head -20\ (checked manually)
- [ ] No credentials committed in any branch
- [ ] No credential commits in tags

### Source Code Review

- [ ] Searched for hardcoded \process.env\ defaults
- [ ] Verified auth.ts uses only environment variables
- [ ] Verified database config uses environment variables
- [ ] Verified Firebase config uses environment variables
- [ ] Checked all imports for exposed credentials

### Configuration Files

- [ ] .gitignore includes all secret file patterns
- [ ] .gitignore includes INTERNAL_SECURITY.md
- [ ] .gitignore includes DEPLOYMENT_GUIDE.md
- [ ] .gitignore includes SECRETS.md (if created)
- [ ] No template configs expose real values

### Documentation

- [ ] DEPLOYMENT_CONFIGURATION.md uses generic names (no real project IDs)
- [ ] DEPLOYMENT_CONFIGURATION.md doesn't list actual API keys
- [ ] API_DOCUMENTATION.md doesn't mention secret values
- [ ] README.md doesn't include setup credentials
- [ ] Code comments don't reference production credentials

### GitHub Configuration

- [ ] Repository is PUBLIC (not private unless necessary)
- [ ] No sensitive information in repository description
- [ ] No sensitive information in README
- [ ] Branch protection rules configured if needed

## Pre-Deployment Verification

### GitHub Secrets Setup

- [ ] GitHub Secrets configured: DATABASE_URL
- [ ] GitHub Secrets configured: REDIS_URL
- [ ] GitHub Secrets configured: FIREBASE_PROJECT_ID
- [ ] GitHub Secrets configured: FIREBASE_API_KEY
- [ ] GitHub Secrets configured: JWT_SECRET
- [ ] GitHub Secrets configured: ENCRYPTION_KEY
- [ ] GitHub Secrets configured: SENTRY_DSN
- [ ] GitHub Secrets configured: LOGGLY_TOKEN
- [ ] GitHub Secrets configured: APPLE_TEAM_ID
- [ ] GitHub Secrets configured: APNS_KEY_ID

### Render.com Setup

- [ ] Environment variables added to Web Service
- [ ] DATABASE_URL points to production database
- [ ] REDIS_URL points to production cache
- [ ] All required env vars present
- [ ] No test/development values in production

### Firebase Configuration

- [ ] Firebase project exists and is configured
- [ ] API key restricted to authorized domains (if applicable)
- [ ] APNs configuration uploaded to Firebase
- [ ] iOS app bundle ID matches \IOS_BUNDLE_ID\ env var
- [ ] Firebase credentials NOT in repository

### Apple Developer Setup

- [ ] APNs Authentication Key generated
- [ ] Key ID saved (as \APNS_KEY_ID\)
- [ ] Team ID saved (as \APPLE_TEAM_ID\)
- [ ] Key file stored securely (not in Git)
- [ ] Certificate uploaded to Firebase

## Post-Push Actions

### Verification After Push

- [ ] Code builds successfully on Render.com
- [ ] Application starts without configuration errors
- [ ] No credentials exposed in build logs
- [ ] Health check endpoint returns \healthy\
- [ ] Database connection succeeds
- [ ] Redis connection succeeds

### Monitoring

- [ ] Sentry is collecting errors (test with API call)
- [ ] Loggly is receiving logs
- [ ] No sensitive data in any log messages
- [ ] No passwords or tokens in error messages

### Security Scanning

- [ ] GitHub secret scanning is enabled
- [ ] No secrets detected by automated scanning
- [ ] Dependabot is configured (for dependency updates)
- [ ] Code scanning enabled (if available)

## Ongoing Security Maintenance

### Monthly

- [ ] Review GitHub Secrets access list
- [ ] Check Render.com environment variables haven't been modified
- [ ] Verify no new .env files accidentally created
- [ ] Review recent commits for sensitive data

### Quarterly

- [ ] Rotate all secrets:
  - [ ] JWT_SECRET
  - [ ] ENCRYPTION_KEY
  - [ ] Database password
  - [ ] Redis password
  - [ ] Firebase API key

- [ ] Rotate APNs key (annually or as needed)
- [ ] Update .gitignore with any new sensitive patterns
- [ ] Review and update INTERNAL_SECURITY.md access list

### Annually

- [ ] Full security audit
- [ ] Renew APNs certificate
- [ ] Review all credentials across services
- [ ] Update security documentation

## Incident Response

### If a secret is exposed:

1. **STOP** - Don't use the secret further
2. **VERIFY** - Confirm it was actually exposed and via what method
3. **ALERT** - Notify team immediately
4. **REVOKE** - Rotate/regenerate the compromised secret
5. **UPDATE** - Update all systems using the secret
6. **MONITOR** - Check logs for unauthorized access
7. **DOCUMENT** - Log the incident and response
8. **PREVENT** - Add patterns to pre-commit hook

### Secrets that must be rotated immediately:

- JWT_SECRET
- ENCRYPTION_KEY
- Database password
- Firebase API key
- APNs key (if exposed)

### Services to check for abuse:

- Sentry - unauthorized error activity
- Loggly - unusual log volume or queries
- Database - unauthorized queries or data access
- Firebase - unusual messaging volumes
- Render.com - unexpected deployments

## Testing

### Before each deployment:

- [ ] Run \
pm run build\ successfully
- [ ] Run \
pm run lint\ with no errors
- [ ] Run \
pm run test\ with all tests passing
- [ ] Verify no console errors with secrets
- [ ] Test \/health\ endpoint returns healthy status

### Test secret rotation:

- [ ] Update JWT_SECRET in Render.com
- [ ] Restart application
- [ ] Verify new tokens are generated with new secret
- [ ] Verify old tokens still validate (for grace period)

## Documentation References

- [DEPLOYMENT_CONFIGURATION.md](./DEPLOYMENT_CONFIGURATION.md) - Setup guide (public)
- [INTERNAL_SECURITY.md](./INTERNAL_SECURITY.md) - Secret management (private, not committed)
- [.gitignore](./.gitignore) - Files excluded from Git
- [.env.example](./.env.example) - Template for environment variables

## Questions?

If you're unsure about security implications of any change:
1. Err on the side of caution
2. Ask the team lead
3. Check OWASP guidelines for the specific risk
4. Document your decision

---

**Last Updated**: 2024-01-XX
**Version**: 1.0
**Reviewed By**: [Name/Date]
