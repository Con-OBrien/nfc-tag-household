import UIKit
import CoreNFC

/// Main view controller for NFC tag scanning
class ViewController: UIViewController {
    
    // MARK: - Outlets
    
    @IBOutlet weak var statusLabel: UILabel!
    @IBOutlet weak var taskNameLabel: UILabel!
    @IBOutlet weak var taskDescriptionLabel: UILabel!
    @IBOutlet weak var scanButton: UIButton!
    @IBOutlet weak var statusIndicator: UIView!
    @IBOutlet weak var lastScanTimeLabel: UILabel!
    
    // MARK: - Properties
    
    private let nfcReader = NFCTagReader()
    private let backendURL = "http://localhost:3000"  // Change to your backend URL
    
    private var lastScannedTagId: String?
    private var isScanning = false
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
        setupNFCReader()
        checkNFCAvailability()
        
        // Listen for task notifications
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleTaskNotification(_:)),
            name: NSNotification.Name("TaskNotificationReceived"),
            object: nil
        )
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
        nfcReader.stopNFCSession()
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        title = "NFC Task Scanner"
        
        // Configure status indicator
        statusIndicator.layer.cornerRadius = 6
        statusIndicator.backgroundColor = UIColor.systemGray3
        
        // Configure buttons
        scanButton.layer.cornerRadius = 8
        scanButton.backgroundColor = UIColor.systemBlue
        scanButton.setTitle("Start Scanning", for: .normal)
        scanButton.addTarget(self, action: #selector(scanButtonTapped), for: .touchUpInside)
        
        // Configure labels
        statusLabel.text = "Ready to scan NFC tags"
        statusLabel.textColor = UIColor.systemGray
        
        taskNameLabel.text = "No tag scanned"
        taskNameLabel.textColor = UIColor.systemGray
        
        taskDescriptionLabel.text = "Tap 'Start Scanning' and bring your device near an NFC tag"
        taskDescriptionLabel.textColor = UIColor.systemGray
    }
    
    private func updateStatus(_ message: String, isError: Bool = false) {
        DispatchQueue.main.async {
            self.statusLabel.text = message
            self.statusLabel.textColor = isError ? UIColor.systemRed : UIColor.systemGreen
            
            if isError {
                self.statusIndicator.backgroundColor = UIColor.systemRed
            } else {
                self.statusIndicator.backgroundColor = UIColor.systemGreen
            }
        }
    }
    
    // MARK: - NFC Setup
    
    private func setupNFCReader() {
        nfcReader.setOnTagRead { [weak self] tagData in
            self?.handleTagRead(tagData)
        }
        
        nfcReader.setOnError { [weak self] error in
            self?.handleNFCError(error)
        }
        
        nfcReader.setOnSessionEnded { [weak self] in
            self?.handleSessionEnded()
        }
    }
    
    private func checkNFCAvailability() {
        if !NFCTagReader.isNFCAvailable() {
            updateStatus("NFC not available on this device", isError: true)
            scanButton.isEnabled = false
        }
    }
    
    // MARK: - NFC Actions
    
    @objc private func scanButtonTapped() {
        if isScanning {
            nfcReader.stopNFCSession()
            isScanning = false
            scanButton.setTitle("Start Scanning", for: .normal)
        } else {
            do {
                try nfcReader.startNFCSession()
                isScanning = true
                scanButton.setTitle("Stop Scanning", for: .normal)
                updateStatus("Scanning for NFC tags...")
            } catch let error as NFCError {
                updateStatus("Error: \(error.localizedDescription)", isError: true)
            } catch {
                updateStatus("Error: \(error.localizedDescription)", isError: true)
            }
        }
    }
    
    // MARK: - Handle Tag Data
    
    private func handleTagRead(_ tagData: NFCTagData) {
        DispatchQueue.main.async {
            self.lastScannedTagId = tagData.tagId
            
            // Update UI with tag data
            self.updateStatus("Tag scanned successfully")
            self.taskNameLabel.text = "Task ID: \(tagData.taskId)"
            self.taskDescriptionLabel.text = "Nonce: \(tagData.nonce.prefix(16))..."
            
            // Update last scan time
            let formatter = DateFormatter()
            formatter.timeStyle = .medium
            self.lastScanTimeLabel.text = "Last scan: \(formatter.string(from: Date()))"
            
            // Send to backend
            self.sendTagDataToBackend(tagData)
        }
    }
    
    private func handleNFCError(_ error: NFCError) {
        DispatchQueue.main.async {
            self.updateStatus("NFC Error: \(error.localizedDescription)", isError: true)
            self.isScanning = false
            self.scanButton.setTitle("Start Scanning", for: .normal)
        }
    }
    
    private func handleSessionEnded() {
        DispatchQueue.main.async {
            self.isScanning = false
            self.scanButton.setTitle("Start Scanning", for: .normal)
            self.updateStatus("NFC session ended")
        }
    }
    
    // MARK: - Backend Communication
    
    private func sendTagDataToBackend(_ tagData: NFCTagData) {
        let endpoint = "\(backendURL)/api/events/tag-scanned"
        
        guard let url = URL(string: endpoint) else {
            updateStatus("Invalid backend URL", isError: true)
            return
        }
        
        // Prepare request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Create payload
        let payload: [String: Any] = [
            "taskId": tagData.taskId,
            "nonce": tagData.nonce,
            "signature": tagData.signature,
            "timestamp": tagData.timestamp
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        } catch {
            updateStatus("Error encoding payload", isError: true)
            return
        }
        
        // Send request
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    self?.updateStatus("Network error: \(error.localizedDescription)", isError: true)
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    self?.updateStatus("Invalid response", isError: true)
                    return
                }
                
                if (200...299).contains(httpResponse.statusCode) {
                    self?.updateStatus("Event sent successfully")
                    
                    // Parse response
                    if let data = data {
                        do {
                            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                                print("Backend response: \(json)")
                                
                                // Show event ID if available
                                if let eventId = json["eventId"] as? String {
                                    self?.taskDescriptionLabel.text = "Event ID: \(eventId)"
                                }
                            }
                        } catch {
                            print("Error parsing response: \(error)")
                        }
                    }
                } else {
                    self?.updateStatus("Server error: \(httpResponse.statusCode)", isError: true)
                    
                    // Parse error response
                    if let data = data,
                       let errorResponse = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let errorMessage = errorResponse["error"] as? String {
                        self?.updateStatus("Error: \(errorMessage)", isError: true)
                    }
                }
            }
        }.resume()
    }
    
    // MARK: - Notification Handling
    
    @objc private func handleTaskNotification(_ notification: NSNotification) {
        guard let userInfo = notification.userInfo else { return }
        
        DispatchQueue.main.async {
            let taskId = userInfo["taskId"] as? String ?? "Unknown"
            let eventType = userInfo["eventType"] as? String ?? "unknown"
            let taskName = userInfo["taskName"] as? String ?? taskId
            let description = userInfo["description"] as? String ?? ""
            
            // Update UI
            self.updateStatus("Notification received: \(eventType)")
            self.taskNameLabel.text = taskName
            self.taskDescriptionLabel.text = description
            
            // Show alert
            let alertController = UIAlertController(
                title: "Task Update",
                message: "\(taskName)\n\n\(description)",
                preferredStyle: .alert
            )
            alertController.addAction(UIAlertAction(title: "OK", style: .default))
            self.present(alertController, animated: true)
        }
    }
}
