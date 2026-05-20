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

            var mifareType: Int? = null
            var mifareSize: Int? = null
            var mifareSectorCount: Int? = null
            var mifareBlockCount: Int? = null
            var authResultsJson: JSONArray? = null

            // =========================
            // MIFARE CLASSIC
            // =========================
            val mifare = MifareClassic.get(it)
            if (mifare != null) {
                Log.d("MIFARE", "MIFARE DETECTADO")
                try {
                    mifare.connect()
                    mifareType = mifare.type
                    mifareSize = mifare.size
                    mifareSectorCount = mifare.sectorCount
                    mifareBlockCount = mifare.blockCount

                    val authResults = JSONArray()

                    for (sector in 0 until mifare.sectorCount) {

                        val auth = mifare.authenticateSectorWithKeyA(
                            sector,
                            MifareClassic.KEY_DEFAULT
                        )

                        Log.d(
                            "MIFARE_AUTH",
                            "Sector $sector -> $auth"
                        )

                        val sectorJson = JSONObject().apply {
                            put("sector", sector)
                            put("authenticated", auth)
                        }

                        if (auth) {
                            // =========================
                            // LEITURA HEX
                            // =========================
                            val blockDataArray = JSONArray()
                            val startBlock = mifare.sectorToBlock(sector)
                            val blockCountInSector = mifare.getBlockCountInSector(sector)

                            for (i in 0 until blockCountInSector) {
                                val blockIndex = startBlock + i
                                try {
                                    val data = mifare.readBlock(blockIndex)
                                    val hex = data.joinToString(" ") {
                                        "%02X".format(it)
                                    }

                                    Log.d(
                                        "MIFARE_BLOCK",
                                        "Sector $sector Block $blockIndex -> $hex"
                                    )

                                    val isTrailer = i == blockCountInSector - 1

                                    val blockJson = JSONObject().apply {
                                        put("block", blockIndex)
                                        put("hex", hex)
                                        put("isTrailer", isTrailer)
                                    }
                                    blockDataArray.put(blockJson)
                                } catch (e: Exception) {
                                    Log.e(
                                        "MIFARE_BLOCK",
                                        "Erro bloco $blockIndex",
                                        e
                                    )
                                }
                            }
                            sectorJson.put("blocks", blockDataArray)
                        }

                        authResults.put(sectorJson)
                    }

                    authResultsJson = authResults

                    Log.d("MIFARE", "TYPE: $mifareType")
                    Log.d("MIFARE", "SIZE: $mifareSize")
                    Log.d("MIFARE", "SECTORS: $mifareSectorCount")
                    Log.d("MIFARE", "BLOCKS: $mifareBlockCount")
                    
                    mifare.close()
                } catch (e: Exception) {
                    Log.e("MIFARE", "Erro ao conectar Mifare: ${e.message}")
                }
            }

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

                // =========================
                // MIFARE INFO
                // =========================

                put("mifareType", mifareType ?: JSONObject.NULL)

                put("mifareSize", mifareSize ?: JSONObject.NULL)

                put("sectorCount", mifareSectorCount ?: JSONObject.NULL)

                put("blockCount", mifareBlockCount ?: JSONObject.NULL)

                put("authResults", authResultsJson ?: JSONObject.NULL)
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