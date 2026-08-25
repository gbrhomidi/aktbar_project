package space.manus.akeer14.mobile.agent.t20260824151421

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class TelegramAgentModule(private val appContext: ReactApplicationContext) : ReactContextBaseJavaModule(appContext) {
  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  override fun getName(): String = "TelegramAgent"

  @ReactMethod
  fun start(config: ReadableMap, promise: Promise) {
    try {
      val saved = AgentConfigStore(appContext).save(config)
      if (!saved.isReady) {
        promise.reject("CONFIG_INVALID", "يجب إدخال Bot Token وChat ID صحيحين قبل تشغيل العامل.")
        return
      }
      val intent = Intent(appContext, TelegramAgentService::class.java).apply {
        action = TelegramAgentService.ACTION_START
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) appContext.startForegroundService(intent) else appContext.startService(intent)
      promise.resolve(AgentRuntimeStore(appContext).asMap())
    } catch (error: Exception) {
      promise.reject("AGENT_START_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun saveConfig(config: ReadableMap, promise: Promise) {
    try {
      val saved = AgentConfigStore(appContext).save(config)
      promise.resolve(Arguments.createMap().apply {
        putBoolean("telegramConfigured", saved.isReady)
        putBoolean("gmailConfigured", saved.gmailReady)
        putBoolean("smsConfigured", saved.smsReady)
      })
    } catch (error: Exception) {
      promise.reject("CONFIG_SAVE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun testTelegram(config: ReadableMap, promise: Promise) {
    moduleScope.launch {
      val response = runCatching {
        val saved = AgentConfigStore(appContext).save(config)
        check(saved.isReady) { "أدخل Bot Token وChat ID صحيحين قبل اختبار Telegram." }
        val result = TelegramBotClient(saved.botToken).getMe()
        check(result.ok) { result.description.ifBlank { "رفض Telegram بيانات البوت." } }
        "نجح اتصال Telegram مع البوت."
      }
      promise.resolve(Arguments.createMap().apply {
        putBoolean("ok", response.isSuccess)
        putString("message", response.getOrElse { it.message ?: "فشل اختبار Telegram." })
      })
    }
  }

  @ReactMethod
  fun testGmail(config: ReadableMap, promise: Promise) {
    moduleScope.launch {
      val response = runCatching { GmailEvidenceSender().test(AgentConfigStore(appContext).save(config)) }
      val result = response.getOrElse { GmailResult(false, it.message ?: "فشل اختبار Gmail.") }
      promise.resolve(Arguments.createMap().apply {
        putBoolean("ok", result.ok)
        putString("message", result.description)
      })
    }
  }

  @ReactMethod
  fun runHardwareTest(promise: Promise) {
    val activity = appContext.currentActivity
    if (AgentRuntimeStore(appContext).get().running) {
      promise.reject("AGENT_RUNNING", "أوقف العامل قبل اختبار الكاميرا والميكروفون لتجنب تعارض الموارد.")
      return
    }
    if (activity !is LifecycleOwner) {
      promise.reject("NO_ACTIVITY", "افتح التطبيق في المقدمة قبل تشغيل اختبار العتاد.")
      return
    }
    moduleScope.launch {
      val result = HardwareDiagnostics.run(appContext, activity)
      promise.resolve(Arguments.createMap().apply {
        putBoolean("cameraOk", result.cameraOk)
        putString("cameraDetail", result.cameraDetail)
        putBoolean("microphoneOk", result.microphoneOk)
        putString("microphoneDetail", result.microphoneDetail)
      })
    }
  }

  @ReactMethod
  fun testSms(config: ReadableMap, promise: Promise) {
    val response = runCatching {
      val saved = AgentConfigStore(appContext).save(config)
      SmsAlertDispatcher(appContext).sendIfAllowed(saved, "manual_test", "Akeer14: هذه رسالة اختبار لتنبيهات SMS من الهاتف العامل.")
    }
    val message = response.getOrElse { it.message ?: "فشل اختبار SMS." }
    promise.resolve(Arguments.createMap().apply {
      putBoolean("ok", message.startsWith("تمت محاولة"))
      putString("message", message)
    })
  }

  @ReactMethod
  fun getDeviceHealth(promise: Promise) {
    val health = DeviceHealthMonitor.snapshot(appContext)
    promise.resolve(Arguments.createMap().apply {
      putInt("batteryPercent", health.batteryPercent)
      putBoolean("charging", health.charging)
      putBoolean("internetReachable", health.internetReachable)
      putBoolean("batteryOptimizationEnabled", health.batteryOptimizationEnabled)
      putBoolean("smsPermissionGranted", health.smsPermissionGranted)
    })
  }

  @ReactMethod
  fun getDeliveryLog(promise: Promise) {
    val entries = Arguments.createArray()
    DeliveryLogStore(appContext).read().forEach { entry ->
      entries.pushMap(Arguments.createMap().apply {
        putString("id", entry.id)
        putString("timestamp", entry.timestamp)
        putString("channel", entry.channel)
        putString("kind", entry.kind)
        putBoolean("ok", entry.ok)
        putString("detail", entry.detail)
      })
    }
    promise.resolve(entries)
  }

  @ReactMethod
  fun clearDeliveryLog(promise: Promise) {
    DeliveryLogStore(appContext).clear()
    promise.resolve(true)
  }

  @ReactMethod
  fun requestBatteryOptimizationExemption(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      promise.resolve(false)
      return
    }
    try {
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:${appContext.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      appContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("BATTERY_OPTIMIZATION_REQUEST_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun closeUi(promise: Promise) {
    val activity = appContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "لا توجد واجهة نشطة لإرسالها إلى الخلفية.")
      return
    }
    promise.resolve(activity.moveTaskToBack(true))
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      appContext.stopService(Intent(appContext, TelegramAgentService::class.java))
      AgentRuntimeStore(appContext).setStopped("تم إيقاف العامل من واجهة التطبيق.")
      promise.resolve(AgentRuntimeStore(appContext).asMap())
    } catch (error: Exception) {
      promise.reject("AGENT_STOP_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    promise.resolve(AgentRuntimeStore(appContext).asMap())
  }

  @ReactMethod
  fun hasStoredConfig(promise: Promise) {
    promise.resolve(AgentConfigStore(appContext).read().isReady)
  }

  @ReactMethod
  fun clearSecrets(promise: Promise) {
    AgentConfigStore(appContext).clear()
    promise.resolve(true)
  }

  private fun AgentRuntimeStore.asMap(): WritableMap {
    val state = get()
    return Arguments.createMap().apply {
      putBoolean("running", state.running)
      putString("phase", state.phase)
      putString("message", state.message)
      putString("updatedAt", state.updatedAt)
      putString("lastError", state.lastError)
    }
  }
}
