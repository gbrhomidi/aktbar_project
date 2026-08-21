package com.gbrhomidi.aktbar.service

import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.IBinder
import android.telephony.SmsManager

/** Explicit service; callers must grant SEND_SMS and provide a destination/message. */
class SMSService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val phone = intent?.getStringExtra(EXTRA_PHONE).orEmpty()
        val message = intent?.getStringExtra(EXTRA_MESSAGE).orEmpty()
        if (phone.isNotBlank() && message.isNotBlank() && checkSelfPermission("android.permission.SEND_SMS") == PackageManager.PERMISSION_GRANTED) {
            SmsManager.getDefault().sendTextMessage(phone, null, message, null, null)
        }
        stopSelf(startId)
        return START_NOT_STICKY
    }
    override fun onBind(intent: Intent?): IBinder? = null
    companion object { const val EXTRA_PHONE = "phone"; const val EXTRA_MESSAGE = "message" }
}
