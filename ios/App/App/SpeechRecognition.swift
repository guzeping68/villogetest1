import AVFoundation
import Capacitor
import Foundation
import Speech

@objc(SpeechRecognition)
public class SpeechRecognition: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechRecognition"
    public let jsName = "SpeechRecognition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSupportedLanguages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeAllListeners", returnType: CAPPluginReturnPromise)
    ]

    private let defaultMatches = 5
    private let messageMissingPermission = "Missing permission"
    private let messageAccessDenied = "User denied access to microphone"
    private let messageOngoing = "Ongoing speech recognition"
    private let messageUnknown = "Unknown speech recognition error"

    private var speechRecognizer: SFSpeechRecognizer?
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    @objc public func available(_ call: CAPPluginCall) {
        guard let recognizer = SFSpeechRecognizer() else {
            call.resolve(["available": false])
            return
        }
        call.resolve(["available": recognizer.isAvailable])
    }

    @objc public func start(_ call: CAPPluginCall) {
        if audioEngine?.isRunning == true {
            call.reject(messageOngoing)
            return
        }

        guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
            call.reject(messageMissingPermission)
            return
        }

        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            if !granted {
                call.reject(self.messageAccessDenied)
                return
            }

            DispatchQueue.main.async {
                self.startRecognition(call)
            }
        }
    }

    private func startRecognition(_ call: CAPPluginCall) {
        let language = call.getString("language") ?? "zh-CN"
        let maxResults = call.getInt("maxResults") ?? defaultMatches
        let partialResults = call.getBool("partialResults") ?? true

        recognitionTask?.cancel()
        recognitionTask = nil

        let nextAudioEngine = AVAudioEngine()
        audioEngine = nextAudioEngine
        speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: language))

        guard let speechRecognizer else {
            call.reject(messageUnknown)
            return
        }

        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, options: [.defaultToSpeaker, .allowBluetooth])
            try audioSession.setMode(.measurement)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            call.reject(error.localizedDescription)
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = partialResults
        recognitionRequest = request

        let inputNode = nextAudioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        recognitionTask = speechRecognizer.recognitionTask(with: request) { result, error in
            if let result {
                let matches = Array(result.transcriptions.prefix(maxResults).map { $0.formattedString })
                if partialResults {
                    self.notifyListeners("partialResults", data: ["matches": matches])
                } else {
                    call.resolve(["matches": matches])
                }

                if result.isFinal {
                    self.stopAudioEngine()
                }
            }

            if let error {
                self.stopAudioEngine()
                if !partialResults {
                    call.reject(error.localizedDescription)
                }
            }
        }

        do {
            nextAudioEngine.prepare()
            try nextAudioEngine.start()
            notifyListeners("listeningState", data: ["status": "started"])
            if partialResults {
                call.resolve()
            }
        } catch {
            stopAudioEngine()
            call.reject(error.localizedDescription)
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        stopAudioEngine()
        call.resolve()
    }

    @objc public func isListening(_ call: CAPPluginCall) {
        call.resolve(["listening": audioEngine?.isRunning == true])
    }

    @objc public func getSupportedLanguages(_ call: CAPPluginCall) {
        let languages = SFSpeechRecognizer.supportedLocales().map { $0.identifier }.sorted()
        call.resolve(["languages": languages])
    }

    @objc public func hasPermission(_ call: CAPPluginCall) {
        checkPermissions(call)
    }

    @objc public func requestPermission(_ call: CAPPluginCall) {
        requestPermissions(call)
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        let speechStatus = SFSpeechRecognizer.authorizationStatus()
        let permission = speechPermissionString(speechStatus)
        let microphonePermission = microphonePermissionString()
        call.resolve([
            "speechRecognition": permission,
            "microphone": microphonePermission
        ])
    }

    private func speechPermissionString(_ speechStatus: SFSpeechRecognizerAuthorizationStatus) -> String {
        switch speechStatus {
        case .authorized:
            return "granted"
        case .denied, .restricted:
            return "denied"
        case .notDetermined:
            return "prompt"
        @unknown default:
            return "prompt"
        }
    }

    private func microphonePermissionString() -> String {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:
            return "granted"
        case .denied:
            return "denied"
        case .undetermined:
            return "prompt"
        @unknown default:
            return "prompt"
        }
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { speechStatus in
            DispatchQueue.main.async {
                guard speechStatus == .authorized else {
                    self.checkPermissions(call)
                    return
                }

                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    DispatchQueue.main.async {
                        call.resolve([
                            "speechRecognition": "granted",
                            "microphone": granted ? "granted" : "denied"
                        ])
                    }
                }
            }
        }
    }

    private func stopAudioEngine() {
        if let engine = audioEngine, engine.isRunning {
            engine.stop()
        }
        audioEngine?.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask = nil
        notifyListeners("listeningState", data: ["status": "stopped"])

        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch {}
    }
}
