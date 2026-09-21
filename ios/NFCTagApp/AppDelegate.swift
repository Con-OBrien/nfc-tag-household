import UIKit
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    // MARK: - UIApplicationDelegate Methods
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        
        // Initialize Firebase
        FirebaseApp.configure()
        
        // Set up Firebase Messaging delegate
        Messaging.messaging().delegate = self
        
        // Set up User Notification delegate for handling notifications in foreground/background
        UNUserNotificationCenter.current().delegate = self
        
        // Request user permission for push notifications
        requestPushNotificationPermission(application)
        
        // Set up remote notification delivery
        application.registerForRemoteNotifications()
        
        return true
    }
    
    // MARK: - Remote Notification Handling
    
    /// Handle successful registration for remote notifications
    /// Stores the APNs device token for use with Firebase Cloud Messaging
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        // Convert device token to hex string
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("APNs Device Token: \(token)")
        
        // Set APNs token in Firebase Messaging
        Messaging.messaging().setAPNSToken(deviceToken, type: .prod)
        
        // Optionally store token on backend for direct APNs delivery
        // This is useful for testing and backup notification delivery
        storePushTokenOnBackend(token: token)
    }
    
    /// Handle failure to register for remote notifications
    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("Failed to register for remote notifications: \(error)")
        // Fallback: app will still receive notifications via FCM
    }
    
    /// Handle remote notification received (background or foreground)
    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        print("Received remote notification: \(userInfo)")
        
        // Parse notification payload
        if let taskId = userInfo["taskId"] as? String,
           let eventType = userInfo["eventType"] as? String {
            
            // Handle the notification event
            handleTaskNotification(taskId: taskId, eventType: eventType, userInfo: userInfo)
        }
        
        completionHandler(.newData)
    }
    
    // MARK: - Scene Configuration
    
    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
    
    func application(
        _ application: UIApplication,
        didDiscardSceneSessions sceneSessions: Set<UISceneSession>
    ) {
        // Called when the user discards a scene session
    }
    
    // MARK: - Private Methods
    
    /// Request user permission for push notifications
    private func requestPushNotificationPermission(_ application: UIApplication) {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge]
        ) { granted, error in
            DispatchQueue.main.async {
                if granted {
                    print("Push notification permission granted")
                    application.registerForRemoteNotifications()
                } else if let error = error {
                    print("Failed to request push notification permission: \(error)")
                } else {
                    print("Push notification permission denied by user")
                }
            }
        }
    }
    
    /// Store push token on backend server for APNs direct delivery
    /// Firebase Cloud Messaging can also deliver notifications, but having the APNs token
    /// allows for direct delivery and backup notification channels
    private func storePushTokenOnBackend(token: String) {
        // This would typically call an API endpoint to store the token
        // POST /api/users/{userId}/push-token
        // Example implementation:
        /*
        guard let userId = getCurrentUserId() else { return }
        
        let backendURL = URL(string: "https://api.example.com/api/users/\(userId)/push-token")!
        var request = URLRequest(url: backendURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: Any] = [
            "token": token,
            "platform": "ios",
            "timestamp": Date().timeIntervalSince1970
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        URLSession.shared.dataTask(with: request) { _, response, error in
            if let error = error {
                print("Failed to store push token on backend: \(error)")
            } else if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                print("Push token successfully stored on backend")
            }
        }.resume()
        */
    }
    
    /// Handle task notification received from backend
    private func handleTaskNotification(
        taskId: String,
        eventType: String,
        userInfo: [AnyHashable: Any]
    ) {
        print("Handling task notification - taskId: \(taskId), eventType: \(eventType)")
        
        // Parse deep link data
        let taskName = userInfo["taskName"] as? String ?? "Task"
        let description = userInfo["description"] as? String ?? ""
        
        // Send event to app for processing
        NotificationCenter.default.post(
            name: NSNotification.Name("TaskNotificationReceived"),
            object: nil,
            userInfo: [
                "taskId": taskId,
                "eventType": eventType,
                "taskName": taskName,
                "description": description
            ]
        )
    }
    
    /// Get current logged-in user ID (placeholder)
    private func getCurrentUserId() -> String? {
        // This would retrieve the current user ID from your auth system
        // return UserDefaults.standard.string(forKey: "userId")
        return nil
    }
}

// MARK: - MessagingDelegate (Firebase Cloud Messaging)

extension AppDelegate: MessagingDelegate {
    
    /// Called when a new FCM token is generated
    /// Store this token on your backend for targeting notifications
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        if let token = fcmToken {
            print("Firebase Cloud Messaging Token: \(token)")
            
            // Store FCM token on backend for future notification delivery
            storeFCMTokenOnBackend(token: token)
            
            // Also available via Messaging.messaging().fcmToken
        }
    }
    
    /// Store FCM token on backend for future notifications
    private func storeFCMTokenOnBackend(token: String) {
        // Similar to APNs token storage
        // POST /api/users/{userId}/push-token with platform: "fcm"
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension AppDelegate: UNUserNotificationCenterDelegate {
    
    /// Handle notification when app is in foreground
    /// By default, notifications are only shown when app is in background
    /// This method allows showing notifications even when app is active
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let userInfo = notification.request.content.userInfo
        print("Notification received in foreground: \(userInfo)")
        
        // Parse and handle notification
        if let taskId = userInfo["taskId"] as? String,
           let eventType = userInfo["eventType"] as? String {
            handleTaskNotification(taskId: taskId, eventType: eventType, userInfo: userInfo)
        }
        
        // Show the notification banner and sound even when app is in foreground
        // This is available on iOS 14+
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .sound, .badge])
        } else {
            // Fallback for older iOS versions - show alert
            completionHandler([.alert, .sound, .badge])
        }
    }
    
    /// Handle user interaction with notification (tap on notification)
    /// This is called when user taps on a notification
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        print("User tapped notification: \(userInfo)")
        
        // Handle different notification action types
        switch response.actionIdentifier {
        case UNNotificationDefaultActionIdentifier:
            // User tapped on the notification
            if let taskId = userInfo["taskId"] as? String {
                // Navigate to task details screen
                navigateToTaskDetails(taskId: taskId)
            }
            
        case "SNOOZE_ACTION":
            // User tapped snooze action
            if let taskId = userInfo["taskId"] as? String {
                scheduleNotificationReminder(taskId: taskId, delay: 300)  // 5 minutes
            }
            
        case "DISMISS_ACTION":
            // User dismissed the notification
            print("User dismissed notification")
            
        default:
            break
        }
        
        completionHandler()
    }
    
    /// Navigate to task details screen from notification
    private func navigateToTaskDetails(taskId: String) {
        print("Navigating to task details for taskId: \(taskId)")
        
        // This would typically interact with your app's navigation controller
        // to navigate to the task details screen
        // Example:
        // if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
        //    let window = windowScene.windows.first,
        //    let navController = window.rootViewController as? UINavigationController {
        //     let taskDetailsVC = TaskDetailsViewController(taskId: taskId)
        //     navController.pushViewController(taskDetailsVC, animated: true)
        // }
    }
    
    /// Schedule a reminder notification for later
    private func scheduleNotificationReminder(taskId: String, delay: TimeInterval) {
        let content = UNMutableNotificationContent()
        content.title = "Task Reminder"
        content.body = "Remember to complete your task"
        content.userInfo = ["taskId": taskId, "isReminder": true]
        content.sound = .default
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
        let request = UNNotificationRequest(identifier: "reminder-\(taskId)", content: content, trigger: trigger)
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Failed to schedule reminder: \(error)")
            } else {
                print("Reminder scheduled successfully")
            }
        }
    }
}
