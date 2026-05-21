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

        nfcHandler = NfcHandler(this, bridge)
        nfcHandler.init()
    }

    override fun onResume() {
        super.onResume()

        nfcHandler.enable()
    }

    override fun onPause() {
        super.onPause()

        nfcHandler.disable()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)

        setIntent(intent)

        Log.d("NFC_DEBUG", "🔥 onNewIntent FOI CHAMADO")

        if (::nfcHandler.isInitialized) {
            nfcHandler.handleIntent(intent)
        } else {
            Log.w("NFC_DEBUG", "NfcHandler ainda não foi inicializado")
        }
    }
}
