package app.lovable.b0f28e4795554c3199e588d60bf8193f

import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.getcapacitor.BridgeActivity
import app.lovable.b0f28e4795554c3199e588d60bf8193f.nfc.NfcHandler

class MainActivity : BridgeActivity() {

    private lateinit var nfcHandler: NfcHandler

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Se você ainda quiser usar o NfcPlugin que criamos antes:
        registerPlugin(NfcPlugin::class.java)
    }

    override fun onStart() {
        super.onStart()

        nfcHandler = NfcHandler(this, bridge)
        nfcHandler.init()
        nfcHandler.enable()
    }

    override fun onStop() {
        super.onStop()
        if (::nfcHandler.isInitialized) {
            nfcHandler.disable()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        Log.d("NFC_DEBUG", "🔥 onNewIntent FOI CHAMADO")
        if (::nfcHandler.isInitialized) {
            nfcHandler.handleIntent(intent)
        } else {
            Log.w("NFC_DEBUG", "NfcHandler ainda não foi inicializado")
        }
    }
}
