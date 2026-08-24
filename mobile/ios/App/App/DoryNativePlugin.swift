import AuthenticationServices
import Capacitor
import UIKit

@objc(DoryNativePlugin)
public class DoryNativePlugin: CAPPlugin, CAPBridgedPlugin,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding
{
    public let identifier = "DoryNativePlugin"
    public let jsName = "DoryNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getBuildEnvironment", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCalls: [String: CAPPluginCall] = [:]
    private var callbackIdsByController: [ObjectIdentifier: String] = [:]
    private var pendingControllers: [ObjectIdentifier: ASAuthorizationController] = [:]

    @objc public func getBuildEnvironment(_ call: CAPPluginCall) {
        #if DEBUG
        call.resolve(["environment": "development"])
        #else
        call.resolve(["environment": "production"])
        #endif
    }

    @objc public func signInWithApple(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = call.getString("nonce")

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self

            self.pendingCalls[call.callbackId] = call
            let controllerId = ObjectIdentifier(controller)
            self.callbackIdsByController[controllerId] = call.callbackId
            self.pendingControllers[controllerId] = controller
            controller.performRequests()
        }
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let call = takePendingCall(for: controller) else { return }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            call.reject("Apple returned an unexpected credential", "APPLE_INVALID_CREDENTIAL")
            return
        }
        guard
            let identityTokenData = credential.identityToken,
            let identityToken = String(data: identityTokenData, encoding: .utf8)
        else {
            call.reject("Apple did not return an identity token", "APPLE_MISSING_TOKEN")
            return
        }

        var result: JSObject = [
            "identityToken": identityToken,
            "user": credential.user,
        ]
        if let email = credential.email {
            result["email"] = email
        }
        if let givenName = credential.fullName?.givenName {
            result["givenName"] = givenName
        }
        if let familyName = credential.fullName?.familyName {
            result["familyName"] = familyName
        }

        call.resolve(result)
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        guard let call = takePendingCall(for: controller) else { return }

        if let authorizationError = error as? ASAuthorizationError,
           authorizationError.code == .canceled
        {
            call.reject("Apple sign-in was canceled", "APPLE_CANCELED", error)
            return
        }

        call.reject("Apple sign-in failed", "APPLE_SIGN_IN_FAILED", error)
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = bridge?.viewController?.view.window {
            return window
        }

        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }

    private func takePendingCall(for controller: ASAuthorizationController) -> CAPPluginCall? {
        let controllerId = ObjectIdentifier(controller)
        pendingControllers.removeValue(forKey: controllerId)

        guard let callbackId = callbackIdsByController.removeValue(forKey: controllerId) else {
            return nil
        }

        return pendingCalls.removeValue(forKey: callbackId)
    }
}
