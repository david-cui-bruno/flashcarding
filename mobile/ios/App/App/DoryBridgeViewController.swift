import Capacitor

final class DoryBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(DoryNativePlugin())
    }
}
