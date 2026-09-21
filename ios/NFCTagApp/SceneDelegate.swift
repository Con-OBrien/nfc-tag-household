import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    
    var window: UIWindow?
    
    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        let window = UIWindow(windowScene: windowScene)
        
        // Create root view controller
        let rootViewController = createRootViewController()
        window.rootViewController = rootViewController
        
        self.window = window
        window.makeKeyAndVisible()
        
        // Handle notification that launched the app
        if let notificationResponse = connectionOptions.notificationResponse {
            handleNotification(notificationResponse.notification)
        }
    }
    
    func sceneDidDisconnect(_ scene: UIScene) {
        // Called as the scene is being released by the system
        // Cleanup any resources specific to this scene
    }
    
    func sceneDidBecomeActive(_ scene: UIScene) {
        // Called when the scene has moved from an inactive state to an active state
        // Use this method to restart any tasks that were paused
    }
    
    func sceneWillResignActive(_ scene: UIScene) {
        // Called when the scene will move from an active state to an inactive state
        // This may occur due to temporary interruptions (ex. an incoming phone call)
    }
    
    func sceneWillEnterForeground(_ scene: UIScene) {
        // Called as the scene transitions from the background to the foreground
        // Use this method to undo the changes made on entering the background
    }
    
    func sceneDidEnterBackground(_ scene: UIScene) {
        // Called as the scene transitions from the foreground to the background
        // Use this method to save data, release shared resources
    }
    
    // MARK: - Private Methods
    
    /// Create root view controller
    private func createRootViewController() -> UIViewController {
        let storyboard = UIStoryboard(name: "Main", bundle: nil)
        
        // Create navigation controller with home view controller
        if let homeVC = storyboard.instantiateViewController(withIdentifier: "HomeViewController") {
            let navigationController = UINavigationController(rootViewController: homeVC)
            return navigationController
        }
        
        // Fallback if storyboard fails
        return UIViewController()
    }
    
    /// Handle notification received
    private func handleNotification(_ notification: UNNotification) {
        let userInfo = notification.request.content.userInfo
        
        if let taskId = userInfo["taskId"] as? String {
            navigateToTaskDetails(taskId: taskId)
        }
    }
    
    /// Navigate to task details screen
    private func navigateToTaskDetails(taskId: String) {
        guard let window = window,
              let navigationController = window.rootViewController as? UINavigationController else {
            return
        }
        
        // This would typically instantiate and push a task details view controller
        // let taskDetailsVC = TaskDetailsViewController(taskId: taskId)
        // navigationController.pushViewController(taskDetailsVC, animated: true)
        
        print("Navigating to task details for: \(taskId)")
    }
}
