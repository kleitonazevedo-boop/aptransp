package app.lovable.b0f28e4795554c3199e588d60bf8193f.nfc

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.nfc.tech.MifareClassic
import android.nfc.tech.NfcA
import android.util.Log
import com.getcapacitor.Bridge
import org.json.JSONArray
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

        val tag: Tag? =
            intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)

        tag?.let {

            // =========================
            // UID
            // =========================

            val uid = it.id.joinToString(":") { b ->
                "%02X".format(b)
            }

            // =========================
            // TECH ARRAY
            // =========================

            val techArray = JSONArray()

            it.techList.forEach { tech ->
                techArray.put(tech)
            }

            // =========================
            // LOGS
            // =========================

            Log.d("NFC_DEBUG", "TAG DETECTADA")
            Log.d("NFC_DEBUG", "UID GERADO: $uid")
            Log.d("NFC_DEBUG", "UID: $uid")

            // =========================
            // JSON FINAL
            // =========================

            val json = JSONObject().apply {

                put("uid", uid)

                put("tech", techArray)

                put("timestamp", System.currentTimeMillis())
            }

            Log.d(
                "NFC_DEBUG",
                "🔥 VOU ENVIAR PARA WEBVIEW"
            )

            Log.d(
                "NFC_DEBUG",
                "Enviando para React: ${json}"
            )

            // =========================
            // UI THREAD
            // =========================

            bridge.webView.post {

                Log.d(
                    "NFC_DEBUG",
                    "UI THREAD OK"
                )

                bridge.triggerJSEvent(
                    "nfcResult",
                    "window",
                    "{ detail: ${json.toString()} }"
                )
            }

            Log.d(
                "NFC_DEBUG",
                "🔥 ENVIO CONCLUÍDO"
            )
        }
    }
}