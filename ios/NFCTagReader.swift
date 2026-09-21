import Foundation
import CoreNFC

/// NFC tag data structure extracted from NDEF message
public struct NFCTagData {
    public let tagId: String
    public let taskId: String
    public let nonce: String  // Hex string of nonce bytes
    public let signature: String  // Hex string of HMAC signature
    public let timestamp: TimeInterval
    
    public init(tagId: String, taskId: String, nonce: String, signature: String, timestamp: TimeInterval = Date().timeIntervalSince1970) {
        self.tagId = tagId
        self.taskId = taskId
        self.nonce = nonce
        self.signature = signature
        self.timestamp = timestamp
    }
}

/// Errors that can occur during NFC operations
public enum NFCError: LocalizedError {
    case hardwareNotAvailable
    case hardwareNotSupported
    case timeout
    case userCancelled
    case invalidTagData
    case messageParseError(String)
    case ndefNotSupported
    case emptyNDEFMessage
    case missingRequiredField(String)
    case sessionAlreadyRunning
    case sessionNotRunning
    case unknown(String)
    
    public var errorDescription: String? {
        switch self {
        case .hardwareNotAvailable:
            return "NFC hardware is not available on this device"
        case .hardwareNotSupported:
            return "NFC is not supported on this device"
        case .timeout:
            return "NFC scan timed out. Please try again."
        case .userCancelled:
            return "NFC scan was cancelled"
        case .invalidTagData:
            return "The tag contains invalid or corrupted data"
        case .messageParseError(let msg):
            return "Failed to parse NFC message: \(msg)"
        case .ndefNotSupported:
            return "This tag does not support NDEF format"
        case .emptyNDEFMessage:
            return "The NDEF message is empty"
        case .missingRequiredField(let field):
            return "Missing required field in tag data: \(field)"
        case .sessionAlreadyRunning:
            return "NFC session is already running"
        case .sessionNotRunning:
            return "NFC session is not currently running"
        case .unknown(let msg):
            return "Unknown NFC error: \(msg)"
        }
    }
}

/// Callback types for NFC reader events
public typealias NFCTagReadCallback = (NFCTagData) -> Void
public typealias NFCErrorCallback = (NFCError) -> Void
public typealias NFCSessionEndedCallback = () -> Void

/// iOS-optimized NFC tag reader using Core NFC framework
/// Abstracts platform-specific details and provides a clean interface for the app
public class NFCTagReader: NSObject {
    // MARK: - Properties
    
    private var nfcSession: NFCNDEFReaderSession?
    private var isSessionRunning = false
    
    // Callbacks
    private var onTagRead: NFCTagReadCallback?
    private var onError: NFCErrorCallback?
    private var onSessionEnded: NFCSessionEndedCallback?
    
    // MARK: - Initialization
    
    public override init() {
        super.init()
    }
    
    // MARK: - Public Methods
    
    /// Register callback for when an NFC tag is successfully read
    /// - Parameter callback: Closure called when tag is read with extracted tag data
    public func setOnTagRead(_ callback: @escaping NFCTagReadCallback) {
        self.onTagRead = callback
    }
    
    /// Register callback for NFC errors
    /// - Parameter callback: Closure called when an error occurs
    public func setOnError(_ callback: @escaping NFCErrorCallback) {
        self.onError = callback
    }
    
    /// Register callback for when NFC session ends
    /// - Parameter callback: Closure called when session is terminated
    public func setOnSessionEnded(_ callback: @escaping NFCSessionEndedCallback) {
        self.onSessionEnded = callback
    }
    
    /// Start NFC scanning session
    /// - Throws: NFCError if NFC is unavailable or session already running
    public func startNFCSession() throws {
        // Check if NFC is available
        guard NFCNDEFReaderSession.readingAvailable else {
            throw NFCError.hardwareNotAvailable
        }
        
        // Check if session is already running
        if isSessionRunning {
            throw NFCError.sessionAlreadyRunning
        }
        
        // Create and configure NFC session
        let session = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: false)
        session.alertMessage = "Hold your device near the NFC tag to scan"
        
        self.nfcSession = session
        self.isSessionRunning = true
        
        // Start the session
        session.begin()
    }
    
    /// Stop the active NFC scanning session
    public func stopNFCSession() {
        guard isSessionRunning else {
            onError?(.sessionNotRunning)
            return
        }
        
        nfcSession?.invalidate()
        nfcSession = nil
        isSessionRunning = false
        onSessionEnded?()
    }
    
    /// Check if NFC is available on this device
    /// - Returns: true if NFC is available, false otherwise
    public static func isNFCAvailable() -> Bool {
        return NFCNDEFReaderSession.readingAvailable
    }
    
    /// Check if NFC session is currently running
    /// - Returns: true if session is active, false otherwise
    public func isSessionActive() -> Bool {
        return isSessionRunning
    }
    
    // MARK: - Private Methods
    
    /// Parse NDEF message and extract task data
    /// - Parameter message: NFCNDEFMessage containing the tag data
    /// - Returns: Extracted NFCTagData
    /// - Throws: NFCError if parsing fails
    private func parseNDEFMessage(_ message: NFCNDEFMessage) throws -> NFCTagData {
        guard !message.records.isEmpty else {
            throw NFCError.emptyNDEFMessage
        }
        
        // Look for the first text record or URI record containing our task data
        var tagData: [String: String] = [:]
        
        for record in message.records {
            // Handle text records
            if record.typeNameFormat == .nfcWellKnown && record.type == "T" as Data {
                if let text = parseTextRecord(record) {
                    // Try to parse as JSON
                    if let jsonData = text.data(using: .utf8),
                       let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: String] {
                        tagData.merge(json) { _, new in new }
                    }
                }
            }
            
            // Handle absolute URI records
            else if record.typeNameFormat == .absoluteURI {
                if let uriString = String(data: record.payload, encoding: .utf8) {
                    // Parse URI query parameters
                    if let components = URLComponents(string: uriString),
                       let queryItems = components.queryItems {
                        for item in queryItems {
                            if let value = item.value {
                                tagData[item.name] = value
                            }
                        }
                    }
                }
            }
            
            // Handle external type records
            else if record.typeNameFormat == .external,
                    record.type == ("nfc-tag-data:nfc" as Data) {
                if let payload = String(data: record.payload, encoding: .utf8),
                   let jsonData = payload.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: String] {
                    tagData.merge(json) { _, new in new }
                }
            }
        }
        
        // Extract required fields
        guard let taskId = tagData["taskId"] else {
            throw NFCError.missingRequiredField("taskId")
        }
        guard let nonce = tagData["nonce"] else {
            throw NFCError.missingRequiredField("nonce")
        }
        guard let signature = tagData["signature"] else {
            throw NFCError.missingRequiredField("signature")
        }
        
        // Generate tag ID (use current timestamp + random for uniqueness)
        let tagId = UUID().uuidString
        let timestamp = Date().timeIntervalSince1970
        
        return NFCTagData(
            tagId: tagId,
            taskId: taskId,
            nonce: nonce,
            signature: signature,
            timestamp: timestamp
        )
    }
    
    /// Parse text record from NDEF record
    /// - Parameter record: NFCNDEFPayload to parse
    /// - Returns: Extracted text, or nil if parsing fails
    private func parseTextRecord(_ record: NFCNDEFPayload) -> String? {
        guard !record.payload.isEmpty else { return nil }
        
        // First byte contains language info
        let languageLength = record.payload[0] & 0x3F
        
        guard record.payload.count > 1 + Int(languageLength) else {
            return nil
        }
        
        let textStart = 1 + Int(languageLength)
        let textData = record.payload.subdata(in: textStart..<record.payload.count)
        
        return String(data: textData, encoding: .utf8)
    }
    
    /// Validate extracted tag data
    /// - Parameter data: Tag data to validate
    /// - Returns: true if data is valid, false otherwise
    private func validateTagData(_ data: NFCTagData) -> Bool {
        // Validate UUIDs
        if !isValidUUID(data.taskId) {
            return false
        }
        
        // Validate hex strings (nonce should be 32 chars, signature should be 64 chars)
        if !isValidHex(data.nonce) || data.nonce.count != 32 {
            return false
        }
        
        if !isValidHex(data.signature) || data.signature.count != 64 {
            return false
        }
        
        // Validate timestamp (shouldn't be too far in the past or future)
        let now = Date().timeIntervalSince1970
        let maxAge: TimeInterval = 3600  // 1 hour
        if abs(now - data.timestamp) > maxAge {
            return false
        }
        
        return true
    }
    
    /// Check if string is a valid UUID
    private func isValidUUID(_ string: String) -> Bool {
        let uuidRegex = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
        let predicate = NSPredicate(format: "SELF MATCHES[cd] %@", uuidRegex)
        return predicate.evaluate(with: string)
    }
    
    /// Check if string is valid hex
    private func isValidHex(_ string: String) -> Bool {
        let hexRegex = "^[0-9a-f]+$"
        let predicate = NSPredicate(format: "SELF MATCHES[cd] %@", hexRegex)
        return predicate.evaluate(with: string)
    }
}

// MARK: - NFCNDEFReaderSessionDelegate

extension NFCTagReader: NFCNDEFReaderSessionDelegate {
    /// Called when reader session detects NDEF tags
    public func readerSession(
        _ session: NFCNDEFReaderSession,
        didDetectNDEFs messages: [NFCNDEFMessage]
    ) {
        guard !messages.isEmpty else {
            onError?(.emptyNDEFMessage)
            return
        }
        
        // Process the first message
        do {
            let tagData = try parseNDEFMessage(messages[0])
            
            // Validate the extracted data
            if !validateTagData(tagData) {
                throw NFCError.invalidTagData
            }
            
            // Call the callback with valid tag data
            onTagRead?(tagData)
        } catch let error as NFCError {
            onError?(error)
        } catch {
            onError?(.unknown(error.localizedDescription))
        }
    }
    
    /// Called when reader session encounters an error
    public func readerSession(
        _ session: NFCNDEFReaderSession,
        didInvalidateWithError error: Error
    ) {
        isSessionRunning = false
        nfcSession = nil
        
        if let readerError = error as? NFCReaderError {
            switch readerError.code {
            case .readerTransmissionError, .readerTransceiveError:
                onError?(.invalidTagData)
            case .readerSessionInvalidationErrorFirstNDEFTagRead:
                // Tag was read, this is just session ending after first read
                onSessionEnded?()
            case .readerSessionInvalidationErrorUserInitiated:
                onError?(.userCancelled)
            case .readerSessionInvalidationErrorSessionTimeout:
                onError?(.timeout)
            default:
                onError?(.unknown(readerError.localizedDescription))
            }
        } else if error is NFCReaderError.Code {
            let code = (error as? NFCReaderError)?.code
            if code == .readerTransmissionError || code == .readerTransceiveError {
                onError?(.invalidTagData)
            } else {
                onError?(.unknown(error.localizedDescription))
            }
        } else {
            onError?(.unknown(error.localizedDescription))
        }
    }
    
    /// Called when reader session becomes active
    public func readerSessionDidBecomeActive(_ session: NFCNDEFReaderSession) {
        // Session is now active and ready to read tags
    }
}
