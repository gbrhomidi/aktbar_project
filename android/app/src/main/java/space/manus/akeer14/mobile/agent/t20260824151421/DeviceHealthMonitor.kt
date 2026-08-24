package space.manus.akeer14.mobile.agent.t20260824151421

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.telephony.SmsManager
import androidx.core.content.ContextCompat

data class DeviceHealth(
  val batteryPercent: Int,
  val charging: Boolean,
  val internetReachable: Boolean,
  val batteryOptimizationEnabled: Boolean,
  val smsPermissionGranted: Boolean,
)

object DeviceHealthMonitor {
  fun snapshot(context: Context): DeviceHealth {
    val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val percent = if (level >= 0 && scale > 0) ((level * 100f) / scale).toInt().coerceIn(0, 100) else -1
    val plugged = batteryIntent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
    val charging = plugged != 0
    val optimized = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val manager = context.getSystemService(PowerManager::class.java)
      manager?.isIgnoringBatteryOptimizations(context.packageName) == false
    } else false
    return DeviceHealth(
      batteryPercent = percent,
      charging = charging,
      internetReachable = hasValidatedInternet(context),
      batteryOptimizationEnabled = optimized,
      smsPermissionGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED,
    )
  }

  fun hasValidatedInternet(context: Context): Boolean {
    val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val network = manager.activeNetwork ?: return false
      val capabilities = manager.getNetworkCapabilities(network) ?: return false
      return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
    @Suppress("DEPRECATION")
    return manager.activeNetworkInfo?.isConnected == true
  }
}

class SmsAlertDispatcher(private val context: Context) {
  companion object {
    private const val MIN_ALERT_INTERVAL_MILLIS = 30L * 60L * 1000L
  }

  fun sendIfAllowed(config: AgentConfig, type: String, message: String): String {
    if (!config.smsReady) return "تنبيه SMS غير مفعّل أو رقم التنبيه غير صالح."
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
      return "لم يُمنح إذن إرسال SMS؛ لم تُرسل الرسالة."
    }
    val preferences = context.getSharedPreferences("agent_sms_alerts", Context.MODE_PRIVATE)
    val key = "last_$type"
    val now = System.currentTimeMillis()
    val lastSent = preferences.getLong(key, 0L)
    if (now - lastSent < MIN_ALERT_INTERVAL_MILLIS) return "تم كبح تكرار تنبيه SMS من النوع نفسه لمدة 30 دقيقة."
    return runCatching {
      @Suppress("DEPRECATION")
      SmsManager.getDefault().sendTextMessage(config.smsAlertPhone, null, message, null, null)
      preferences.edit().putLong(key, now).apply()
      "تمت محاولة إرسال تنبيه SMS إلى الرقم المهيأ."
    }.getOrElse { "تعذر طلب إرسال SMS: ${it.message ?: "خطأ غير معروف"}" }
  }
}
