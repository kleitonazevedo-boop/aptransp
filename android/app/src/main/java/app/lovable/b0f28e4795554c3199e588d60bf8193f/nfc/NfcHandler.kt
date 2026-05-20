package app.lovable.b0f28e4795554c3199e588d60bf8193f.nfc

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.nfc.*
import android.nfc.tech.IsoDep
import android.nfc.tech.MifareClassic
import android.nfc.tech.NfcA
import android.util.Log
import com.getcapacitor.Bridge
import org.json.JSONObject

class NfcHandler(
    private val activity: Activity,
    private val bridge: Bridge
) {

    private var nfcAdapter: NfcAdapter? = null

    fun init() {
        nfcAdapter = NfcAdapter.getDefaultAdapter(activity)
    }

    fun enable() {
        val adapter = nfcAdapter ?: return

        val intent = Intent(activity, activity.javaClass).apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }

        val pendingIntent = PendingIntent.getActivity(
            activity,
            0,
            intent,
            PendingIntent.FLAG_MUTABLE
        )

        val techList = arrayOf(
            arrayOf(NfcA::class.java.name),
            arrayOf(MifareClassic::class.java.name),
            arrayOf(IsoDep::class.java.name)
        )

        adapter.enableForegroundDispatch(
            activity,
            pendingIntent,
            arrayOf(),
            techList
        )
    }

    fun disable() {
        nfcAdapter?.disableForegroundDispatch(activity)
    }

    fun handleIntent(intent: Intent?) {
        if (intent == null) return

        val tag: Tag? = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)

        tag?.let {

            val uid = it.id.joinToString(":") { b -> "%02X".format(b) }
            val techs = it.techList.toList()

            // 🔥 DEBUG NFC
            Log.d("NFC_DEBUG", "TAG DETECTADA")
            Log.d("NFC_DEBUG", "UID GERADO: $uid")
            Log.d("NFC_DEBUG", "UID: $uid")

            // 📦 JSON para envio seguro ao WebView
            val json = JSONObject().apply {
                put("uid", uid)
                put("tech", techs)
            }

            Log.d("NFC_DEBUG", "🔥 VOU ENVIAR PARA WEBVIEW")
            Log.d("NFC_DEBUG", "Enviando para React: ${json.toString()}")

            bridge.webView.post {
                Log.d("NFC_DEBUG", "UI THREAD OK")
                bridge.triggerJSEvent(
                    "nfcResult",
                    json.toString()
                )
            }

            Log.d("NFC_DEBUG", "🔥 ENVIO CONCLUÍDO")
        }
    }
}