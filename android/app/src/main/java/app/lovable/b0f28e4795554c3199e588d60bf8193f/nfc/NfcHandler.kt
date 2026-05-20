package app.lovable.b0f28e4795554c3199e588d60bf8193f.nfc

import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.nfc.*
import android.nfc.tech.IsoDep
import android.nfc.tech.MifareClassic
import android.nfc.tech.NfcA
import android.util.Log
import com.getcapacitor.Bridge
import com.getcapacitor.JSObject
import com.getcapacitor.JSArray

class NfcHandler(
    private val activity: android.app.Activity,
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
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                PendingIntent.FLAG_MUTABLE
            } else {
                0
            }
        )

        val filters = arrayOf<IntentFilter>()

        val techList = arrayOf(
            arrayOf(NfcA::class.java.name),
            arrayOf(MifareClassic::class.java.name),
            arrayOf(IsoDep::class.java.name)
        )

        adapter.enableForegroundDispatch(
            activity,
            pendingIntent,
            filters,
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

            Log.d("NFC", "UID: $uid")

            sendToWeb(uid, techs)
        }
    }

    private fun sendToWeb(uid: String, techs: List<String>) {
        val data = JSObject()
        data.put("uid", uid)
        
        val techsArray = JSArray()
        techs.forEach { techsArray.put(it) }
        data.put("tech", techsArray)

        bridge.triggerWindowJSEvent(
            "nfcResult",
            data.toString()
        )
    }
}
