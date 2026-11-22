package com.lab3.sensors

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.common.LifecycleState
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import java.nio.charset.Charset

@ReactModule(name = NfcModule.NAME)
class NfcModule(private val context: ReactApplicationContext) :
    NativeNfcSpec(context), LifecycleEventListener, NfcAdapter.ReaderCallback {

    private val handler = Handler(Looper.getMainLooper())
    private val adapter = NfcAdapter.getDefaultAdapter(context)
    private var requested = false
    private var readerActivity: Activity? = null
    @Volatile private var valid = true
    private val stateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            updateReader()
        }
    }

    init {
        context.addLifecycleEventListener(this)
        ContextCompat.registerReceiver(
            context,
            stateReceiver,
            IntentFilter(NfcAdapter.ACTION_ADAPTER_STATE_CHANGED),
            ContextCompat.RECEIVER_EXPORTED,
        )
    }

    override fun getName() = NAME

    override fun startScanning() {
        handler.post {
            requested = true
            updateReader()
        }
    }

    override fun stopScanning() {
        handler.post {
            requested = false
            disableReader()
            sendStatus("Đã dừng quét NFC.")
        }
    }

    override fun openSettings() {
        handler.post {
            if (adapter != null) {
                context.startActivity(Intent(Settings.ACTION_NFC_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        }
    }

    override fun mockNdefRecord(text: String) {
        try {
            val record = NdefRecord.createTextRecord("vi", text)
            val bytes = NdefMessage(arrayOf(record)).toByteArray()
            val decoded = NdefMessage(bytes)
            emitOnTagDiscovered(tagData("MOCK-NDEF", arrayOf("NDEF"), decoded, true))
        } catch (error: Exception) {
            sendStatus(error.message ?: "Không thể tạo bản ghi NDEF mẫu.")
        }
    }

    private fun updateReader() {
        if (!valid || !requested) return
        if (adapter == null) {
            sendStatus("Thiết bị không hỗ trợ NFC. Có thể thử bản ghi NDEF mẫu.")
            return
        }
        if (!adapter.isEnabled) {
            disableReader()
            sendStatus("NFC đang tắt. Hãy bật NFC trong cài đặt.")
            return
        }
        val activity = context.currentActivity
        if (activity == null || context.lifecycleState != LifecycleState.RESUMED) {
            disableReader()
            sendStatus("Đang chờ ứng dụng hoạt động.")
            return
        }
        try {
            if (readerActivity !== activity) {
                disableReader()
                adapter.enableReaderMode(
                    activity,
                    this,
                    NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or
                        NfcAdapter.FLAG_READER_NFC_F or NfcAdapter.FLAG_READER_NFC_V or
                        NfcAdapter.FLAG_READER_NFC_BARCODE,
                    null,
                )
                readerActivity = activity
            }
            sendStatus("Đưa thẻ NFC đến gần mặt sau điện thoại.")
        } catch (error: Exception) {
            disableReader()
            sendStatus(error.message ?: "Không thể bắt đầu quét NFC.")
        }
    }

    private fun disableReader() {
        readerActivity?.let { activity ->
            try {
                adapter?.disableReaderMode(activity)
            } catch (_: IllegalStateException) {
                Unit
            }
        }
        readerActivity = null
    }

    override fun onTagDiscovered(tag: Tag) {
        try {
            val ndef = Ndef.get(tag)
            val message = ndef?.use {
                it.connect()
                it.ndefMessage
            }
            if (valid) {
                emitOnTagDiscovered(tagData(hex(tag.id), tag.techList, message, false))
            }
        } catch (error: Exception) {
            sendStatus("Không đọc được thẻ. Giữ thẻ gần điện thoại và thử lại.")
        }
    }

    private fun tagData(id: String, technologies: Array<String>, message: NdefMessage?, mock: Boolean): WritableMap {
        val records = Arguments.createArray()
        message?.records?.forEach { record ->
            records.pushMap(Arguments.createMap().apply {
                putDouble("tnf", record.tnf.toDouble())
                putString("type", record.type.toString(Charsets.UTF_8))
                putString("id", hex(record.id))
                putString("payload", hex(record.payload))
                putString("text", decodeRecord(record))
            })
        }
        return Arguments.createMap().apply {
            putString("id", id)
            putArray("technologies", Arguments.fromList(technologies.toList()))
            putArray("records", records)
            putBoolean("mock", mock)
        }
    }

    private fun decodeRecord(record: NdefRecord): String {
        if (record.tnf == NdefRecord.TNF_WELL_KNOWN && record.type.contentEquals(NdefRecord.RTD_TEXT)) {
            val payload = record.payload
            require(payload.isNotEmpty())
            val status = payload[0].toInt() and 0xff
            val offset = 1 + (status and 0x3f)
            require(offset <= payload.size)
            val charset = if ((status and 0x80) == 0) Charsets.UTF_8 else Charset.forName("UTF-16")
            return String(payload, offset, payload.size - offset, charset)
        }
        record.toUri()?.let { return it.toString() }
        return if (record.toMimeType()?.startsWith("text/") == true) {
            record.payload.toString(Charsets.UTF_8)
        } else {
            hex(record.payload)
        }
    }

    private fun hex(bytes: ByteArray): String =
        bytes.joinToString("") { "%02X".format(it.toInt() and 0xff) }

    private fun sendStatus(message: String) {
        if (!valid) return
        emitOnStatusChanged(Arguments.createMap().apply {
            putBoolean("available", adapter != null)
            putBoolean("enabled", adapter?.isEnabled == true)
            putBoolean("scanning", readerActivity != null)
            putString("message", message)
        })
    }

    override fun onHostResume() {
        updateReader()
    }

    override fun onHostPause() {
        disableReader()
    }

    override fun onHostDestroy() {
        disableReader()
    }

    override fun invalidate() {
        valid = false
        context.removeLifecycleEventListener(this)
        context.unregisterReceiver(stateReceiver)
        handler.post { disableReader() }
        super.invalidate()
    }

    companion object {
        const val NAME = "NativeNfc"
    }
}
