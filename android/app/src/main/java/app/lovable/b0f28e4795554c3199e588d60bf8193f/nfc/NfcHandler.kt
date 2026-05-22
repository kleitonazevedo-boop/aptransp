package app.lovable.b0f28e4795554c3199e588d60bf8193f.nfc

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.TagLostException
import android.nfc.tech.IsoDep
import android.nfc.tech.MifareClassic
import android.nfc.tech.NfcA
import android.util.Log
import app.lovable.b0f28e4795554c3199e588d60bf8193f.BuildConfig
import com.getcapacitor.Bridge
import org.json.JSONArray
import org.json.JSONObject

fun ByteArray.toHex(): String {
    return joinToString("") {
        "%02X".format(it)
    }
}

class NfcHandler(
    private val activity: Activity,
    private val bridge: Bridge
) {

    private var nfcAdapter: NfcAdapter? = null

    private val DEFAULT_READ_KEYS = arrayOf(
        MifareClassic.KEY_DEFAULT,
        MifareClassic.KEY_MIFARE_APPLICATION_DIRECTORY,
        MifareClassic.KEY_NFC_FORUM,
        byteArrayOf(
            0x00.toByte(),
            0x00.toByte(),
            0x00.toByte(),
            0x00.toByte(),
            0x00.toByte(),
            0x00.toByte()
        ),
        byteArrayOf(
            0xB0.toByte(),
            0xB1.toByte(),
            0xB2.toByte(),
            0xB3.toByte(),
            0xB4.toByte(),
            0xB5.toByte()
        ),
        byteArrayOf(
            0x4D.toByte(),
            0x3A.toByte(),
            0x99.toByte(),
            0xC3.toByte(),
            0x51.toByte(),
            0xDD.toByte()
        ),
        byteArrayOf(
            0x1A.toByte(),
            0x98.toByte(),
            0x2C.toByte(),
            0x7E.toByte(),
            0x45.toByte(),
            0x9A.toByte()
        )
    )

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
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
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

        tag?.let { detectedTag ->

            Thread {

                try {

                    var mifareType: Int? = null
                    var mifareSize: Int? = null
                    var mifareSectorCount: Int? = null
                    var mifareBlockCount: Int? = null

                    val authResultsArray = JSONArray()
                    val rawBlocksArray = JSONArray()

                    // =========================
                    // MIFARE CLASSIC
                    // =========================

                    val mifare = MifareClassic.get(detectedTag)

                    if (mifare != null) {

                        if (BuildConfig.DEBUG) {
                            Log.d("MIFARE", "MIFARE DETECTADO")
                        }

                        try {

                            mifare.connect()
                            mifare.timeout = 8000

                            mifareType = mifare.type
                            mifareSize = mifare.size
                            mifareSectorCount = mifare.sectorCount
                            mifareBlockCount = mifare.blockCount

                            val startTime = System.currentTimeMillis()

                            var sectorsRead = 0
                            var totalBlocksRead = 0

                            for (sector in 0 until mifare.sectorCount) {

                                if (BuildConfig.DEBUG) {
                                    Log.d(
                                        "NFC",
                                        "READING SECTOR $sector"
                                    )
                                }

                                var authenticated = false
                                var usedKey: String? = null
                                var usedKeyHex: String? = null

                                // =========================
                                // AUTH MULTI-KEY
                                // =========================

                                for (key in DEFAULT_READ_KEYS) {

                                    try {

                                        val keyHex = key.toHex()

                                        // KEY A

                                        if (
                                            mifare.authenticateSectorWithKeyA(
                                                sector,
                                                key
                                            )
                                        ) {

                                            authenticated = true
                                            usedKey = "A"
                                            usedKeyHex = keyHex

                                            if (BuildConfig.DEBUG) {
                                                Log.d(
                                                    "NFC",
                                                    "AUTH OK sector=$sector key=$keyHex (A)"
                                                )
                                            }
                                            break

                                        } else {

                                            if (BuildConfig.DEBUG) {
                                                Log.e(
                                                    "NFC",
                                                    "AUTH FAIL sector=$sector key=$keyHex (A)"
                                                )
                                            }
                                        }

                                        // KEY B

                                        if (
                                            mifare.authenticateSectorWithKeyB(
                                                sector,
                                                key
                                            )
                                        ) {

                                            authenticated = true
                                            usedKey = "B"
                                            usedKeyHex = keyHex

                                            if (BuildConfig.DEBUG) {
                                                Log.d(
                                                    "NFC",
                                                    "AUTH OK sector=$sector key=$keyHex (B)"
                                                )
                                            }
                                            break

                                        } else {

                                            if (BuildConfig.DEBUG) {
                                                Log.e(
                                                    "NFC",
                                                    "AUTH FAIL sector=$sector key=$keyHex (B)"
                                                )
                                            }
                                        }

                                    } catch (_: Exception) {
                                    }
                                }

                                if (authenticated) {
                                    
                                    sectorsRead++

                                    val blockDataArray = JSONArray()
                                    val startBlock = mifare.sectorToBlock(sector)
                                    val blockCountInSector = mifare.getBlockCountInSector(sector)

                                    for (i in 0 until blockCountInSector) {

                                        val blockIndex = startBlock + i

                                        try {

                                            val data = mifare.readBlock(blockIndex)
                                            val hex = data.toHex()
                                            totalBlocksRead++

                                            if (BuildConfig.DEBUG) {
                                                Log.d(
                                                    "NFC",
                                                    "READ OK sector=$sector block=$blockIndex data=$hex"
                                                )
                                            }

                                            val isTrailer = i == blockCountInSector - 1
                                            val ascii = String(data).replace(Regex("[^\\x20-\\x7E]"), ".")
                                            val isEmpty = data.all { it == 0.toByte() }

                                            val blockJson = JSONObject().apply {
                                                put("sector", sector)
                                                put("block", blockIndex)
                                                put("hex", hex)
                                                put("ascii", ascii)
                                                put("isTrailer", isTrailer)
                                                put("isEmpty", isEmpty)
                                            }

                                            blockDataArray.put(blockJson)
                                            rawBlocksArray.put(blockJson)

                                            Thread.sleep(10)

                                        } catch (e: TagLostException) {
                                            Log.e("MIFARE", "TAG LOST", e)
                                            throw e // Re-throw to handle in outer block or stop
                                        } catch (e: Exception) {
                                            if (BuildConfig.DEBUG) {
                                                Log.e("NFC", "READ FAIL sector=$sector block=$blockIndex error=${e.message}")
                                            }
                                        }
                                    }

                                    // SAVE SECTOR
                                    val sectorJson = JSONObject().apply {
                                        put("sector", sector)
                                        put("authenticated", true)
                                        put("keyType", usedKey ?: JSONObject.NULL)
                                        put("keyUsed", usedKeyHex ?: JSONObject.NULL)
                                        put("blocks", blockDataArray)
                                    }
                                    authResultsArray.put(sectorJson)

                                } else {
                                    // AUTH FAIL
                                    authResultsArray.put(
                                        JSONObject().apply {
                                            put("sector", sector)
                                            put("authenticated", false)
                                            put("keyUsed", JSONObject.NULL)
                                            put("error", "Authentication failed")
                                        }
                                    )
                                }
                            }

                            if (BuildConfig.DEBUG) {

                                val totalTime =
                                    System.currentTimeMillis() - startTime

                                Log.d(
                                    "NFC",
                                    "TOTAL READ TIME = $totalTime ms"
                                )

                                Log.d(
                                    "NFC",
                                    "SECTORS READ = $sectorsRead"
                                )
                                
                                Log.d(
                                    "NFC",
                                    "BLOCKS READ = $totalBlocksRead"
                                )
                            }

                        } catch (e: Exception) {

                            Log.e(
                                "MIFARE",
                                "Erro ao conectar Mifare: ${e.message}"
                            )

                        } finally {

                            try {
                                mifare.close()
                            } catch (_: Exception) {
                            }
                        }
                    }

                    // =========================
                    // UID
                    // =========================

                    val uid = detectedTag.id.toHex()

                    // =========================
                    // TECH ARRAY
                    // =========================

                    val techArray = JSONArray()

                    detectedTag.techList.forEach { tech ->
                        techArray.put(tech)
                    }

                    // =========================
                    // JSON FINAL
                    // =========================

                    val json = JSONObject().apply {

                        put("uid", uid)
                        put("tech", techArray)
                        put("timestamp", System.currentTimeMillis())

                        put("mifareType", mifareType ?: JSONObject.NULL)
                        put("mifareSize", mifareSize ?: JSONObject.NULL)
                        put("sectorCount", mifareSectorCount ?: JSONObject.NULL)
                        put("blockCount", mifareBlockCount ?: JSONObject.NULL)

                        put("authResults", authResultsArray)
                        put("rawBlocks", rawBlocksArray)
                    }

                    if (BuildConfig.DEBUG) {

                        Log.d("NFC_DEBUG", "TAG DETECTADA")
                        Log.d("NFC_DEBUG", "UID: $uid")
                        Log.d("NFC_DEBUG", "🔥 VOU ENVIAR PARA WEBVIEW")
                        Log.d("NFC_DEBUG", "Enviando para React: $json")
                    }

                    // =========================
                    // UI THREAD
                    // =========================

                    bridge.webView.post {

                        if (BuildConfig.DEBUG) {
                            Log.d("NFC_DEBUG", "UI THREAD OK")
                        }

                        val safeJson = JSONObject.quote(json.toString())

                        bridge.triggerJSEvent(
                            "nfcResult",
                            "window",
                            "JSON.parse($safeJson)"
                        )
                    }

                } catch (e: Exception) {

                    Log.e(
                        "NFC_THREAD",
                        "ERRO",
                        e
                    )
                }

            }.start()
        }
    }
}