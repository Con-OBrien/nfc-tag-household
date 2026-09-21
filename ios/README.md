# NFC Tag iOS App

A native iOS app for household task management using NFC tags and push notifications.

## Project Structure

```
ios/
├── NFCTagApp/
│   ├── AppDelegate.swift              # App initialization, Firebase setup, push notification handling
│   ├── SceneDelegate.swift            # Scene lifecycle management
│   ├── Info.plist                     # App configuration and permissions
│   ├── GoogleService-Info.plist       # Firebase configuration (download from Firebase Console)
│   ├── ViewController.swift           # Main UI for app
│   ├── NFCReaderViewController.swift  # NFC scanning UI
│   └── Assets/                        # Images, colors, fonts
├── NFCTagAppTests/                    # Unit tests
├── NFCTagAppUITests/                  # UI tests
├── NFCTagReader.swift                 # NFC abstraction layer (Core NFC wrapper)
├── Podfile                            # CocoaPods dependencies
├── Podfile.lock                       # Locked dependency versions
├── FIREBASE_SETUP.md                  # Firebase configuration guide
├── README.md                          # This file
└── ExportOptions.plist                # Build archive export settings
```

## Features

### NFC Tag Scanning
- **Core NFC Framework** (iOS 13+)
- NDEF message parsing and validation
- Signature verification with HMAC-SHA256
- Duplicate scan detection (30-second window)

### Push Notifications
- **Firebase Cloud Messaging (FCM)** integration
- **Apple Push Notification (APNs)** delivery
- Foreground and background notification handling
- Deep linking to task details
- Custom notification actions (snooze, dismiss)

### Offline Support
- Local caching with Core Data
- Offline queue for pending scans
- Automatic sync on reconnection

### Firebase Integration
- **Cloud Messaging**: Push delivery (free unlimited)
- **Remote Config**: Feature flags and A/B testing
- **Analytics**: Basic usage tracking

## Requirements

- **iOS 13.0+** (Core NFC support)
- **Xcode 15.0+**
- **CocoaPods 1.12+**
- **Apple Developer Account** (for APNs certificates)
- **Firebase Account** (free tier available)

## Installation

### 1. Clone Repository
```bash
git clone <repo-url>
cd ios
```

### 2. Install Dependencies
```bash
pod install
```

### 3. Configure Firebase
Follow the guide in [FIREBASE_SETUP.md](./FIREBASE_SETUP.md):
- Create Firebase project
- Download `GoogleService-Info.plist`
- Set up APNs certificate
- Configure Xcode project

### 4. Open Project
```bash
open NFCTagApp.xcworkspace
```
**Note**: Always use `.xcworkspace`, not `.xcodeproj`

### 5. Configure Signing
- Select **NFCTagApp** target
- Go to **Signing & Capabilities**
- Select your Apple Developer Team
- Ensure provisioning profile includes Push Notifications

### 6. Build and Run
```bash
# Build for simulator
xcodebuild build -workspace NFCTagApp.xcworkspace -scheme NFCTagApp -destination 'platform=iOS Simulator,name=iPhone 15'

# Or use Xcode UI:
# Product → Build (Cmd+B)
# Product → Run (Cmd+R)
```

## Development

### Architecture

```
┌─────────────────────────────────────┐
│         iOS App UI Layer            │
│  (ViewController, Screens)          │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│     NFC Tag Reader Service          │
│   (NFCTagReader abstraction)        │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│       Backend API Client            │
│   (Network requests to /api)        │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│    Firebase Cloud Messaging         │
│   (Push notifications via APNs)     │
└─────────────────────────────────────┘
```

### Key Classes

#### NFCTagReader
Encapsulates Core NFC functionality:
```swift
let reader = NFCTagReader()
reader.setOnTagRead { tagData in
    print("Tag read: \(tagData.taskId)")
}
reader.setOnError { error in
    print("Error: \(error)")
}
try reader.startNFCSession()
```

#### AppDelegate
- Firebase initialization
- Push token management
- Notification routing

#### SceneDelegate
- App lifecycle management
- Window setup
- Deep link handling

### API Integration

The app communicates with the backend at `/api/events/tag-scanned`:

```swift
let payload = [
    "taskId": tagData.taskId,
    "nonce": tagData.nonce,
    "signature": tagData.signature
]

URLSession.shared.request(
    method: .post,
    url: URL(string: "https://api.example.com/api/events/tag-scanned")!,
    parameters: payload
)
```

### Configuration

Update these values in your app:

**Backend URL** (AppDelegate or Config.swift):
```swift
let BACKEND_URL = "https://api.example.com"  // Production
// let BACKEND_URL = "http://localhost:3000"  // Development
```

**Firebase Project** (GoogleService-Info.plist):
- Download from Firebase Console
- Replace `YOUR_CLIENT_ID`, `YOUR_API_KEY`, etc.

## Testing

### Unit Tests
```bash
xcodebuild test \
  -workspace NFCTagApp.xcworkspace \
  -scheme NFCTagApp \
  -destination 'platform=iOS Simulator,name=iPhone 15'
```

### UI Tests
```bash
xcodebuild test \
  -workspace NFCTagApp.xcworkspace \
  -scheme NFCTagAppUITests \
  -destination 'platform=iOS Simulator,name=iPhone 15'
```

### Code Coverage
```bash
xcodebuild test \
  -workspace NFCTagApp.xcworkspace \
  -scheme NFCTagApp \
  -enableCodeCoverage YES \
  -destination 'platform=iOS Simulator,name=iPhone 15'
```

### Manual Testing

**Test NFC Tag Reading:**
1. Build and run on iOS device or simulator with NFC hardware
2. Go to NFC Scan screen
3. Bring device close to NFC tag
4. Tag data should be read and displayed

**Test Push Notifications:**
1. Send test notification from Firebase Console
2. Copy device token from Xcode console when app launches
3. Send notification to that device token
4. Verify notification appears

**Test Offline Mode:**
1. Enable airplane mode
2. Scan NFC tag - should queue locally
3. Disable airplane mode
4. App should sync queued scans

## Deployment

### Build for Distribution

#### Archive for TestFlight
```bash
xcodebuild archive \
  -workspace NFCTagApp.xcworkspace \
  -scheme NFCTagApp \
  -configuration Release \
  -archivePath build/NFCTagApp.xcarchive
```

#### Export IPA
```bash
xcodebuild -exportArchive \
  -archivePath build/NFCTagApp.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/ipa
```

### Submission to App Store

1. Archive the app
2. Validate in Xcode (Window → Organizer)
3. Upload to App Store Connect
4. Create app listing and submit for review

## Performance Considerations

### Optimization Tips

1. **NFC Session Management**
   - Stop NFC session when not needed
   - Only one NFC session active at a time
   - Handle timeouts gracefully

2. **Push Notifications**
   - Request permissions at optimal time
   - Cache notification settings locally
   - Use remote config for feature toggling

3. **Network Requests**
   - Implement request retry logic
   - Cache API responses with TTL
   - Queue requests when offline

4. **Memory**
   - Release large objects in `sceneDidEnterBackground`
   - Use weak references in callbacks
   - Monitor memory usage in Xcode Instruments

## Troubleshooting

### App Won't Build
- [ ] Run `pod install` (don't use `pod update`)
- [ ] Clean build: `Cmd+Shift+K`
- [ ] Delete DerivedData: `rm -rf ~/Library/Developer/Xcode/DerivedData`
- [ ] Verify Xcode 15+ installed

### Push Notifications Not Working
- [ ] Check APNs certificate uploaded in Firebase Console
- [ ] Verify device token printed in Xcode console
- [ ] Check notification permissions in Settings → Notifications
- [ ] Verify provisioning profile includes Push Notifications capability

### NFC Tags Not Reading
- [ ] Device must support NFC (iPhone 7+)
- [ ] Check `NFCReaderUsageDescription` in Info.plist
- [ ] Verify NFC session is active
- [ ] Try with different NFC tags

### Compilation Errors
- [ ] Pod version conflicts: `pod install --repo-update`
- [ ] Swift version mismatch: Check Xcode Swift version
- [ ] Missing frameworks: Check Xcode build settings

## Monitoring and Analytics

### Firebase Console

Monitor in real-time:
- **Cloud Messaging**: Message delivery status
- **Analytics**: User engagement and events
- **Crashlytics**: App crashes and errors
- **Performance**: App startup and runtime metrics

### Debug Logging

Enable verbose logging for debugging:

```swift
// In AppDelegate
import os.log

let logger = Logger(subsystem: "com.household.nfc-tag-app", category: "nfc")
logger.debug("NFC session started")
```

## Security Considerations

### Sensitive Data
- Push tokens stored securely in Keychain
- API credentials never committed to git
- SSL/TLS for all backend communication
- Signature validation for NFC tags

### Code Signing
- Use Apple Developer Team for signing
- Update provisioning profiles regularly
- Use different certificates for Dev/Prod

## License

[Your License Here]

## Support

For issues or questions:
- Check Firebase Console for messaging logs
- Review Xcode console output
- File issues on GitHub repository

## Contributing

1. Create feature branch
2. Make changes and test thoroughly
3. Submit pull request with description
4. GitHub Actions will run automated tests

---

**Last Updated**: January 2025
**iOS Version**: 13.0+
**Xcode Version**: 15.0+
