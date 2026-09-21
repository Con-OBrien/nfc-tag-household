# Firebase Configuration for iOS App - Free Tier Setup

This document outlines the setup process for configuring Firebase Cloud Messaging (FCM) and Firebase Remote Config on the iOS app using the **free tier plan**.

## Overview

The iOS app uses Firebase for:
- **Cloud Messaging (FCM)**: Push notification delivery to iOS devices via APNs
- **Remote Config**: Feature flags and app configuration management
- **Analytics**: Optional analytics tracking (free tier limited to basic events)

All services are configured to work within Firebase's generous **free tier**, which includes:
- **Unlimited** FCM messaging
- **1GB** Realtime Database storage
- **Remote Config**: 300 configurations per app
- **Analytics**: 500 events per user per day

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Required for APNs certificates
   - Required for code signing and provisioning profiles
   
2. **Firebase Project**
   - Create at [Firebase Console](https://console.firebase.google.com)
   - Free tier recommended for development/testing

3. **CocoaPods**
   - Install via: `sudo gem install cocoapods`

## Step 1: Create Firebase Project

1. Visit [Firebase Console](https://console.firebase.google.com)
2. Click **"Create a project"**
3. Enter project name (e.g., "NFC-Tag-Notifications")
4. Accept the terms and create the project
5. Wait for project initialization (~1 minute)

## Step 2: Register iOS App in Firebase

1. In Firebase Console, click the **iOS+** button to add an iOS app
2. Enter **Bundle ID**: `com.household.nfc-tag-app`
3. Enter **App Nickname**: "NFC Tag App"
4. Click **Register app**
5. Download **GoogleService-Info.plist**
   - Save to: `ios/NFCTagApp/GoogleService-Info.plist`
6. Skip "Add Firebase SDK" (we'll use CocoaPods)
7. Complete project setup

## Step 3: Set Up APNs Certificate

Firebase uses Apple Push Notification service (APNs) to deliver messages to iOS devices.

### 3a. Create Certificate Signing Request (CSR)

1. On macOS, open **Keychain Access**
2. Go to **Keychain Access** → **Certificate Assistant** → **Request a Certificate from a Certificate Authority**
3. Enter:
   - **User Email Address**: your Apple Developer email
   - **Common Name**: "APNs Cert for NFC Tag App"
   - **Request is**: "Saved to disk"
4. Save the CSR file (e.g., `APNs.certSigningRequest`)

### 3b. Create APNs Certificate in Apple Developer

1. Visit [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates)
2. Click **+** to create new certificate
3. Select **Apple Push Services** (or **Apple Push Notification service (Sandbox)**)
4. Select your App ID: `com.household.nfc-tag-app`
5. Upload the CSR file from Step 3a
6. Download the certificate (.cer file)
7. Double-click to install in Keychain Access

### 3c. Export APNs Certificate for Firebase

1. Open **Keychain Access**
2. Find your APNs certificate (usually shows as "Apple Push Services")
3. Right-click and select **Export**
4. Save as `.p8` file or export the private key
5. Set a password when prompted (remember this password)

### 3d. Upload to Firebase

1. In Firebase Console → **Project Settings** → **Cloud Messaging** tab
2. Scroll to **iOS app configuration**
3. Click **Upload** under "APNs Certificates"
4. Upload the exported certificate (.p12 or .p8)
5. Enter the password if prompted
6. Firebase will confirm successful upload

## Step 4: Install Firebase SDK via CocoaPods

1. Navigate to `ios/` directory:
   ```bash
   cd ios
   ```

2. Install CocoaPods dependencies:
   ```bash
   pod install
   ```

3. Always use the `.xcworkspace` file when opening the project in Xcode:
   ```bash
   open NFCTagApp.xcworkspace
   ```

## Step 5: Configure Xcode Project

### 5a. Add GoogleService-Info.plist

1. Open `NFCTagApp.xcworkspace` in Xcode
2. Right-click on the project and select **Add Files to "NFCTagApp"**
3. Select the `GoogleService-Info.plist` file downloaded in Step 2
4. Ensure it's added to the **NFCTagApp** target

### 5b. Enable Push Capabilities

1. Select the **NFCTagApp** project in Xcode
2. Select the **NFCTagApp** target
3. Go to **Signing & Capabilities**
4. Click **+ Capability**
5. Add **Push Notifications**
6. Add **Background Modes** and select:
   - ☑ Remote notifications
   - ☑ Background fetch

### 5c. Configure App ID

1. Visit [Apple Developer App IDs](https://developer.apple.com/account/resources/identifiers/list)
2. Select `com.household.nfc-tag-app`
3. Ensure **Push Notifications** is enabled
4. Download and install the updated provisioning profile in Xcode

## Step 6: Update AppDelegate Configuration

The `AppDelegate.swift` is pre-configured to:

1. Initialize Firebase on app launch
2. Request user permission for push notifications
3. Handle FCM token registration
4. Handle APNs device token registration
5. Process notifications in foreground and background

**No code changes needed** - AppDelegate is already configured.

## Step 7: Test Firebase Messaging

### 7a. Send Test Message from Firebase Console

1. In Firebase Console → **Cloud Messaging**
2. Click **Send your first message**
3. Create a test notification:
   - Title: "Test Notification"
   - Body: "Firebase is configured!"
   - Additional options: Add custom data key `"taskId": "test-123"`
4. Select **Send to a specific device**
5. Paste a registered device token (see Step 7b)
6. Click **Review** and **Publish**

### 7b. Get Device Token

When the app launches:
- Check Xcode console for: `Firebase Cloud Messaging Token: ...`
- Copy this token for testing

## Step 8: Configure Remote Config (Optional)

Firebase Remote Config allows feature flags and A/B testing without app updates.

### 8a. Set Up Feature Flags

1. In Firebase Console → **Remote Config**
2. Click **Create configuration**
3. Add parameters:
   - `nfc_scanning_enabled` (boolean, default: true)
   - `notification_retry_limit` (number, default: 3)
   - `offline_mode_enabled` (boolean, default: false)
4. Click **Publish changes**

### 8b. Access Remote Config in App

```swift
let remoteConfig = RemoteConfig.remoteConfig()
remoteConfig.fetchAndActivate { status, error in
    if let error = error {
        print("Error fetching remote config: \(error)")
        return
    }
    
    let nfcEnabled = remoteConfig.configValue(forKey: "nfc_scanning_enabled").boolValue
    let retryLimit = remoteConfig.configValue(forKey: "notification_retry_limit").numberValue.intValue
    
    print("NFC Enabled: \(nfcEnabled), Retry Limit: \(retryLimit)")
}
```

## Step 9: Free Tier Quotas and Limits

### Cloud Messaging (FCM)
- ✅ Unlimited messages per day
- ✅ Unlimited devices
- ✅ No bandwidth charges
- **Limit**: 100,000 message impressions/day (Spark plan)

### Remote Config
- ✅ Unlimited configurations
- ✅ 300 parameters per app (Spark plan)
- ✅ 1,000 rollouts per day

### Analytics
- ✅ Basic analytics included
- **Limit**: 500 events per user per day

## Step 10: Monitoring and Debugging

### Enable Firebase Analytics Debug Mode

```swift
// In AppDelegate.didFinishLaunchingWithOptions
import FirebaseAnalytics
Analytics.setAnalyticsCollectionEnabled(true)
```

### Monitor Messages in Firebase Console

1. Go to **Cloud Messaging** → **Logs** tab
2. View delivery status, failures, and detailed metrics
3. Check **Analytics** for engagement tracking

## Step 11: Production Considerations

### For Production Release:

1. **Switch to Production APNs**
   - Replace sandbox APNs certificate with production certificate
   - Update provisioning profile to production

2. **Set Up Error Tracking**
   - Firebase Console → **Quality** → **Crashlytics**
   - Automatically tracks crashes and errors

3. **Monitor Free Tier Usage**
   - Go to **Project Settings** → **Usage and Billing**
   - Track storage, API calls, and other metrics
   - Free tier automatically upgrades if limits exceeded

4. **Enable Security Rules** (if using Realtime Database)
   - Restrict database access to authenticated users only
   - Example rule structure in Firebase Console

## Troubleshooting

### Issue: "GoogleService-Info.plist not found"
- **Solution**: Ensure the file is added to Xcode target → Build Phases → Copy Bundle Resources

### Issue: "Firebase SDK not linking"
- **Solution**: Run `pod install` and always open `.xcworkspace` file

### Issue: "Push notifications not being delivered"
- **Solution**: 
  1. Verify APNs certificate is uploaded in Firebase Console
  2. Check device token registration in Xcode console
  3. Verify provisioning profile includes Push Notifications
  4. Check notification settings in device Settings → Notifications

### Issue: "Permission denied for analytics"
- **Solution**: Update `Info.plist` with analytics privacy descriptions

## Next Steps

1. Test with the backend API:
   ```bash
   curl -X POST http://localhost:3000/api/events/tag-scanned \
     -H "Content-Type: application/json" \
     -d '{"taskId": "...", "nonce": "...", "signature": "..."}'
   ```

2. Monitor notifications in Firebase Console

3. Set up error monitoring with Crashlytics

## References

- [Firebase iOS Setup Guide](https://firebase.google.com/docs/ios/setup)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Remote Config Guide](https://firebase.google.com/docs/remote-config)
- [Apple Push Notification Guide](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server)
- [Firebase Free Plan Documentation](https://firebase.google.com/docs/projects/billing/firebase-pricing)
