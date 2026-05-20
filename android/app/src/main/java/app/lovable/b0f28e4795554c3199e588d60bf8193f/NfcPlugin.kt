package app.lovable.b0f28e4795554c3199e588d60bf8193f

import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.util.Log
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.nfc.tech.MifareClassic
import android.nfc.tech.NfcA
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NfcPlugin")
class NfcPlugin : Plugin() {
    private var nfcAdapter: NfcAdapter? = null

    override fun load() {
        nfcAdapter = NfcAdapter.getDefaultAdapter(context)
    }

    @PluginMethod
    fun startScan(call: PluginCall) {
        activity.runOnUiThread {
            try {
                enableForegroundDispatch()
                call.resolve()
            } catch (e: Exception) {
                call.reject(e.message)
            }
        }
    }

    @PluginMethod
    fun stopScan(call: PluginCall) {
        activity.runOnUiThread {
            try {
                nfcAdapter?.disableForegroundDispatch(activity)
                call.resolve()
            } catch (e: Exception) {
                call.reject(e.message)
            }
        }
    }

    private fun enableForegroundDispatch() {
        val intent = Intent(activity, activity.javaClass).apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        
        val flags = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(
            activity, 0, intent, flags
        )

        val filters = arrayOf<IntentFilter>()
        val techList = arrayOf(
            arrayOf(NfcA::class.java.name),
            arrayOf(MifareClassic::class.java.name),
            arrayOf(IsoDep::class.java.name)
        )

        nfcAdapter?.enableForegroundDispatch(activity, pendingIntent, filters, techList)
    }

    override fun handleOnPause() {
        super.handleOnPause()
        nfcAdapter?.disableForegroundDispatch(activity)
    }

    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)
        
        val tag: Tag? = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)

        tag?.let {
            val uid = it.id.joinToString(":") { b -> "%02X".format(b) }
            Log.d("NFC", "UID: $uid")

            val ret = JSObject()
            ret.put("id", uid)
            
            val techsArray = com.getcapacitor.JSArray()
            it.techList?.forEach { tech -> techsArray.put(tech) }
            ret.put("techs", techsArray)
            
            notifyListeners("onTagDiscovered", ret)
        }
    }
}
