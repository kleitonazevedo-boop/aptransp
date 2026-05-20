package app.lovable.b0f28e4795554c3199e588d60bf8193f;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentFilter;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.MifareClassic;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;

public class MainActivity extends BridgeActivity {
    private NfcAdapter nfcAdapter;
    private PendingIntent nfcPendingIntent;
    private IntentFilter[] nfcIntentFilters;
    private String[][] nfcTechLists;

    private static final byte[][] DEFAULT_READ_KEYS = new byte[][]{
            MifareClassic.KEY_DEFAULT,
            MifareClassic.KEY_MIFARE_APPLICATION_DIRECTORY,
            MifareClassic.KEY_NFC_FORUM,
            new byte[]{(byte) 0x00, (byte) 0x00, (byte) 0x00, (byte) 0x00, (byte) 0x00, (byte) 0x00},
            new byte[]{(byte) 0xB0, (byte) 0xB1, (byte) 0xB2, (byte) 0xB3, (byte) 0xB4, (byte) 0xB5},
            new byte[]{(byte) 0x4D, (byte) 0x3A, (byte) 0x99, (byte) 0xC3, (byte) 0x51, (byte) 0xDD},
            new byte[]{(byte) 0x1A, (byte) 0x98, (byte) 0x2C, (byte) 0x7E, (byte) 0x45, (byte) 0x9A}
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupNfcForegroundDispatch();
        handleNfcIntent(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        if (nfcAdapter != null && nfcPendingIntent != null) {
            nfcAdapter.enableForegroundDispatch(this, nfcPendingIntent, nfcIntentFilters, nfcTechLists);
        }
    }

    @Override
    public void onPause() {
        if (nfcAdapter != null) {
            nfcAdapter.disableForegroundDispatch(this);
        }
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNfcIntent(intent);
    }

    private void setupNfcForegroundDispatch() {
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);
        Intent intent = new Intent(this, getClass()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        nfcPendingIntent = PendingIntent.getActivity(this, 0, intent, flags);
        nfcIntentFilters = new IntentFilter[]{new IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED)};
        nfcTechLists = new String[][]{new String[]{MifareClassic.class.getName()}};
    }

    private void handleNfcIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!NfcAdapter.ACTION_TECH_DISCOVERED.equals(action)
                && !NfcAdapter.ACTION_TAG_DISCOVERED.equals(action)
                && !NfcAdapter.ACTION_NDEF_DISCOVERED.equals(action)) {
            return;
        }
        Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
        if (tag == null) return;
        emitNfcPayload(readMifareClassicReadOnly(tag));
    }

    private JSONObject readMifareClassicReadOnly(Tag tag) {
        JSONObject payload = new JSONObject();
        JSONArray authResults = new JSONArray();
        JSONArray rawBlocks = new JSONArray();
        MifareClassic mifare = MifareClassic.get(tag);
        try {
            payload.put("uid", bytesToHex(tag.getId(), ":"));
            payload.put("tech", new JSONArray(tag.getTechList()));
            payload.put("timestamp", System.currentTimeMillis());
            payload.put("readOnly", true);
            payload.put("rawBlocks", rawBlocks);
            payload.put("authResults", authResults);

            if (mifare == null) {
                payload.put("error", "Tag não é MIFARE Classic");
                return payload;
            }

            mifare.connect();
            payload.put("mifareType", mifare.getType());
            payload.put("mifareSize", mifare.getSize());
            payload.put("sectorCount", mifare.getSectorCount());
            payload.put("blockCount", mifare.getBlockCount());

            for (int sector = 0; sector < mifare.getSectorCount(); sector++) {
                JSONObject auth = authenticateSectorReadOnly(mifare, sector);
                JSONArray blocks = new JSONArray();
                auth.put("blocks", blocks);
                authResults.put(auth);

                if (!auth.optBoolean("authenticated", false)) continue;

                int firstBlock = mifare.sectorToBlock(sector);
                int blocksInSector = mifare.getBlockCountInSector(sector);
                String keyType = auth.optString("keyType", "-");
                for (int i = 0; i < blocksInSector; i++) {
                    int blockIndex = firstBlock + i;
                    try {
                        byte[] blockBytes = mifare.readBlock(blockIndex);
                        boolean trailer = isTrailerBlock(blockIndex, sector);
                        JSONObject block = new JSONObject();
                        block.put("sector", sector);
                        block.put("block", blockIndex);
                        block.put("hex", bytesToHex(blockBytes, " "));
                        block.put("bytes", bytesToJsonArray(blockBytes));
                        block.put("isTrailer", trailer);
                        block.put("authSuccess", true);
                        block.put("keyType", keyType);
                        block.put("usedDefaultKey", auth.optBoolean("usedDefaultKey", true));
                        blocks.put(block);

                        JSONObject raw = new JSONObject();
                        raw.put("sector", sector);
                        raw.put("block", blockIndex);
                        raw.put("hex", bytesToHex(blockBytes, " "));
                        rawBlocks.put(raw);
                    } catch (IOException blockError) {
                        JSONObject block = new JSONObject();
                        block.put("sector", sector);
                        block.put("block", blockIndex);
                        block.put("hex", "");
                        block.put("bytes", new JSONArray());
                        block.put("isTrailer", isTrailerBlock(blockIndex, sector));
                        block.put("authSuccess", false);
                        block.put("keyType", keyType);
                        block.put("error", blockError.getMessage());
                        blocks.put(block);
                    }
                }
            }
        } catch (Exception error) {
            try {
                payload.put("error", error.getMessage());
            } catch (Exception ignored) {}
        } finally {
            if (mifare != null) {
                try {
                    mifare.close();
                } catch (Exception ignored) {}
            }
        }
        return payload;
    }

    private JSONObject authenticateSectorReadOnly(MifareClassic mifare, int sector) throws Exception {
        JSONObject out = new JSONObject();
        out.put("sector", sector);
        out.put("authenticated", false);
        out.put("keyType", JSONObject.NULL);
        out.put("usedDefaultKey", false);

        for (byte[] key : DEFAULT_READ_KEYS) {
            if (mifare.authenticateSectorWithKeyA(sector, key)) {
                out.put("authenticated", true);
                out.put("keyType", "A");
                out.put("usedDefaultKey", true);
                return out;
            }
        }
        for (byte[] key : DEFAULT_READ_KEYS) {
            if (mifare.authenticateSectorWithKeyB(sector, key)) {
                out.put("authenticated", true);
                out.put("keyType", "B");
                out.put("usedDefaultKey", true);
                return out;
            }
        }
        return out;
    }

    private boolean isTrailerBlock(int block, int sector) {
        if (sector < 32) return block % 4 == 3;
        return block % 16 == 15;
    }

    private JSONArray bytesToJsonArray(byte[] bytes) throws Exception {
        JSONArray arr = new JSONArray();
        for (byte b : bytes) arr.put(b & 0xFF);
        return arr;
    }

    private String bytesToHex(byte[] bytes, String separator) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < bytes.length; i++) {
            if (i > 0) sb.append(separator);
            sb.append(String.format("%02X", bytes[i] & 0xFF));
        }
        return sb.toString();
    }

    private void emitNfcPayload(JSONObject payload) {
        if (getBridge() != null) {
            getBridge().triggerWindowJSEvent("nfcResult", payload.toString());
        }
    }
}
