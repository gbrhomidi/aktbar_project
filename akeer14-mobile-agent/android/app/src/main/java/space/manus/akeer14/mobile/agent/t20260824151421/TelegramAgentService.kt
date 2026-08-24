package space.manus.akeer14.mobile.agent.t20260824151421

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.channels.Channel
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

class TelegramAgentService : LifecycleService() {
  companion object {
    const val ACTION_START = "space.manus.akeer14.agent.START"
    const val ACTION_STOP = "space.manus.akeer14.agent.STOP"
    private const val CHANNEL_ID = "telegram_agent_runtime"
    private const val NOTIFICATION_ID = 24014
  }

  private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val detectionBusy = AtomicBoolean(false)
  private lateinit var configStore: AgentConfigStore
  private lateinit var runtime: AgentRuntimeStore
  private lateinit var camera: AgentCameraController
  private val audio by lazy { AgentAudioRecorder(this) }
  private val soundMonitor = AgentSoundMonitor()
  private var bot: TelegramBotClient? = null
  private var pollJob: Job? = null
  private var liveJob: Job? = null
  private var healthJob: Job? = null
  private var commandWorker: Job? = null
  private var activeTask: EvidenceTask? = null
  private var lastLowBatteryTelegramAt = 0L
  private val commandQueue = Channel<EvidenceTask>(Channel.UNLIMITED)

  private data class DeliveryOutcome(val ok: Boolean, val description: String)
  private data class EvidenceTask(
    val chatId: String,
    val title: String,
    val work: suspend () -> File,
    val completion: CompletableDeferred<DeliveryOutcome>,
  )

  override fun onCreate() {
    super.onCreate()
    configStore = AgentConfigStore(this)
    runtime = AgentRuntimeStore(this)
    camera = AgentCameraController(this, this) { serviceScope.launch { runDetection("motion") } }
    commandWorker = serviceScope.launch {
      for (task in commandQueue) processEvidence(task)
    }
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> stopAgent("تم إيقاف العامل من الإشعار.")
      else -> startAgent()
    }
    return if (configStore.read().keepServiceAlive) Service.START_STICKY else Service.START_NOT_STICKY
  }

  override fun onBind(intent: Intent): IBinder? {
    super.onBind(intent)
    return null
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    if (pollJob?.isActive == true && configStore.read().keepServiceAlive) {
      updateNotification("العامل مستمر في الخلفية")
    }
    super.onTaskRemoved(rootIntent)
  }

  private fun startAgent() {
    if (pollJob?.isActive == true) return
    val config = configStore.read()
    if (!config.isReady) {
      runtime.setError("إعدادات Telegram غير مكتملة. أدخل Bot Token وChat ID من التطبيق.")
      stopSelf()
      return
    }
    if (!hasPermissions()) {
      runtime.setError("يجب منح الكاميرا والميكروفون قبل بدء عامل Telegram.")
      stopSelf()
      return
    }
    startForegroundCompat("جارٍ تهيئة عامل Telegram…")
    pollJob = serviceScope.launch {
      try {
        bot = TelegramBotClient(config.botToken)
        val client = requireNotNull(bot)
        val webhook = client.deleteWebhook()
        if (!webhook.ok) error("تعذر إزالة webhook القديم: ${webhook.description}")
        val identity = client.getMe()
        if (!identity.ok) error("فشل اختبار Token Telegram: ${identity.description}")
        configureCapture(config)
        startHealthMonitoring()
        runtime.setRunning("نشط", "العامل يستمع لأوامر Telegram من المحادثة المحددة.")
        updateNotification("عامل Telegram نشط")
        client.sendMessage(config.chatId, "<b>🟢 العامل جاهز</b>\nتم تفعيل long polling المحلي من الهاتف.")
        showMainMenu(config.chatId)
        pollLoop(client)
      } catch (cancelled: CancellationException) {
        throw cancelled
      } catch (error: Exception) {
        runtime.setError(error.message ?: "تعذر تشغيل عامل Telegram.")
        updateNotification("خطأ في العامل")
      }
    }
  }

  private suspend fun configureCapture(config: AgentConfig) {
    withContext(Dispatchers.Main.immediate) { camera.configure(config) }
    if (config.soundEnabled) startSoundDetection() else soundMonitor.stop()
  }

  private fun startHealthMonitoring() {
    healthJob?.cancel()
    healthJob = serviceScope.launch {
      var wasInternetReachable: Boolean? = null
      while (isActive) {
        val config = configStore.read()
        val health = DeviceHealthMonitor.snapshot(this@TelegramAgentService)
        if (!health.internetReachable && wasInternetReachable != false) {
          val detail = if (config.smsOnInternetLoss) {
            SmsAlertDispatcher(this@TelegramAgentService).sendIfAllowed(
              config,
              "internet_loss",
              config.smsInternetLossMessage,
            )
          } else "تنبيه SMS لانقطاع الإنترنت معطل."
          runtime.setRunning("تنبيه اتصال", "انقطع الإنترنت. $detail")
          updateNotification("لا يوجد اتصال بالإنترنت")
        }
        if (health.batteryPercent in 0..15) alertLowBattery(null, health)
        wasInternetReachable = health.internetReachable
        delay(30_000L)
      }
    }
  }

  private suspend fun <T> withLongVideoBatteryMonitoring(chatId: String, seconds: Int, block: suspend () -> T): T = coroutineScope {
    var criticalStopRequested = false
    val watcher = launch {
      while (isActive) {
        val health = DeviceHealthMonitor.snapshot(this@TelegramAgentService)
        alertLowBattery(chatId, health)
        if (!criticalStopRequested && health.batteryPercent in 0..4) {
          criticalStopRequested = true
          runtime.setRunning("حفظ فيديو آمن", "البطارية ${health.batteryPercent}%: يُطلب إيقاف التسجيل الآن لحفظ ملف الفيديو النهائي.")
          updateNotification("حفظ فيديو آمن بسبب بطارية ${health.batteryPercent}%")
          camera.stopVideoRecording()
          break
        }
        delay(if (seconds >= 60) 5_000L else 2_500L)
      }
    }
    try {
      block()
    } finally {
      watcher.cancel()
    }
  }

  private suspend fun alertLowBattery(chatId: String?, health: DeviceHealth) {
    if (health.batteryPercent !in 0..15) return
    val config = configStore.read()
    val smsDetail = if (config.smsOnLowBattery) {
      SmsAlertDispatcher(this).sendIfAllowed(
        config,
        "low_battery",
        config.smsLowBatteryMessage.replace("{battery}", health.batteryPercent.toString()),
      )
    } else "تنبيه SMS للبطارية معطل."
    val message = "⚠️ بطارية الهاتف العامل منخفضة (${health.batteryPercent}%). $smsDetail"
    runtime.setRunning("بطارية منخفضة", message)
    updateNotification("بطارية منخفضة: ${health.batteryPercent}%")
    val now = System.currentTimeMillis()
    if (chatId != null && health.internetReachable && now - lastLowBatteryTelegramAt >= 30L * 60L * 1000L) {
      bot?.sendMessage(chatId, message)
      lastLowBatteryTelegramAt = now
    }
  }

  private suspend fun pollLoop(client: TelegramBotClient) {
    var offset = getSharedPreferences("telegram_agent_runtime", MODE_PRIVATE).getLong("lastUpdate", 0L) + 1L
    while (serviceScope.isActive) {
      val response = client.getUpdates(offset)
      if (!response.ok) {
        runtime.setError("تعذر استقبال أوامر Telegram: ${response.description}")
        delay(5_000L)
        continue
      }
      val updates = response.result as? JSONArray ?: JSONArray()
      for (index in 0 until updates.length()) {
        val update = updates.optJSONObject(index) ?: continue
        val updateId = update.optLong("update_id")
        offset = updateId + 1
        getSharedPreferences("telegram_agent_runtime", MODE_PRIVATE).edit().putLong("lastUpdate", updateId).apply()
        handleUpdate(client, update)
      }
    }
  }

  private suspend fun handleUpdate(client: TelegramBotClient, update: JSONObject) {
    val callback = update.optJSONObject("callback_query")
    if (callback != null) {
      client.answerCallback(callback.optString("id"))
      val message = callback.optJSONObject("message")
      val chatId = message?.optJSONObject("chat")?.optLong("id")?.toString().orEmpty()
      val userId = callback.optJSONObject("from")?.optLong("id")?.toString().orEmpty()
      if (!isAllowed(chatId, userId)) return
      routeCallback(client, chatId, callback.optString("data"))
      return
    }
    val message = update.optJSONObject("message") ?: return
    val chatId = message.optJSONObject("chat")?.optLong("id")?.toString().orEmpty()
    val userId = message.optJSONObject("from")?.optLong("id")?.toString().orEmpty()
    if (!isAllowed(chatId, userId)) return
    val text = message.optString("text").substringBefore("@").lowercase()
    when (text) {
      "/start" -> showMainMenu(chatId)
      "/status" -> showSystemReport(chatId)
      "/photo" -> capturePhoto(chatId, "التقاط صورة")
      "/audio" -> recordAudio(chatId, 10, "تسجيل صوت")
      "/video" -> recordVideo(chatId, 30, "تسجيل فيديو")
      "/live" -> startLive(chatId, 60)
      "/stop", "/live_stop" -> stopAll(chatId)
      "/emergency" -> showEmergency(chatId)
      else -> client.sendMessage(chatId, "❌ أمر غير معروف. استخدم /start لعرض لوحة التحكم.")
    }
  }

  private suspend fun routeCallback(client: TelegramBotClient, chatId: String, data: String) {
    when {
      data == "DO_NOTHING" -> Unit
      data == "capture_photo" || data == "emergency_photo" -> capturePhoto(chatId, "تصوير طوارئ")
      data == "record_audio" || data == "emergency_audio" -> recordAudio(chatId, 10, "تسجيل طوارئ")
      data == "record_video" || data == "emergency_video" -> recordVideo(chatId, 30, "فيديو طوارئ")
      data == "emergency_video_60" -> recordVideo(chatId, 60, "فيديو طوارئ 60 ثانية")
      data == "emergency_video_180" -> recordVideo(chatId, 180, "فيديو طوارئ 180 ثانية")
      data == "start_live_stream" -> startLive(chatId, 60)
      data == "live_120" -> startLive(chatId, 120)
      data == "live_stop" -> stopLive(chatId)
      data == "show_advanced_settings" -> showAdvanced(chatId)
      data == "back_to_advanced_main" || data == "refresh_system_status" -> showMainMenu(chatId)
      data == "system_report" -> showSystemReport(chatId)
      data == "emergency_panel" -> showEmergency(chatId)
      data == "detection_actions_menu" -> showDetectionActions(chatId)
      data == "edit_motion_actions" -> showDetectionEditor(chatId, "motion")
      data == "edit_sound_actions" -> showDetectionEditor(chatId, "sound")
      data == "start_motion_detection" -> { configureCapture(updateConfig { it.copy(motionEnabled = true) }); showMainMenu(chatId) }
      data == "start_sound_detection" -> { startSoundDetection(); showMainMenu(chatId) }
      data == "activate_all_detections" -> { configureCapture(updateConfig { it.copy(motionEnabled = true, soundEnabled = true) }); showMainMenu(chatId) }
      data == "stop_all_systems" || data == "stop_emergency" -> stopAll(chatId)
      data == "shutdown_system" -> { client.sendMessage(chatId, "🛑 تم إيقاف العامل."); stopAgent("أوقفه المستخدم من Telegram.") }
      data == "toggle_camera" -> { configureCapture(updateConfig { it.copy(cameraFacing = if (it.cameraFacing == "back") "front" else "back", flashEnabled = if (it.cameraFacing == "back") false else it.flashEnabled) }); showAdvanced(chatId) }
      data == "toggle_flash_setting" -> { configureCapture(updateConfig { it.copy(flashEnabled = it.cameraFacing == "back" && !it.flashEnabled) }); showAdvanced(chatId) }
      data == "toggle_compression" -> { updateConfig { it.copy(compressionEnabled = !it.compressionEnabled) }; showAdvanced(chatId) }
      data == "toggle_auto_delete" -> { updateConfig { it.copy(autoDeleteEvidence = !it.autoDeleteEvidence) }; showAdvanced(chatId) }
      data == "set_video_quality" -> showChoice(chatId, "🎥 جودة الفيديو", listOf("quality_low" to "منخفضة SD", "quality_medium" to "متوسطة HD", "quality_high" to "عالية FHD"))
      data == "set_audio_quality" -> showChoice(chatId, "🔊 جودة الصوت", listOf("audio_low" to "منخفضة", "audio_medium" to "متوسطة", "audio_high" to "عالية"))
      data == "set_motion_sensitivity" -> showChoice(chatId, "🎯 حساسية الحركة", listOf("sensitivity_low" to "منخفضة", "sensitivity_medium" to "متوسطة", "sensitivity_high" to "مرتفعة"))
      data == "set_sound_threshold" -> showChoice(chatId, "👂 حساسية الصوت", listOf("sound_low" to "منخفضة", "sound_medium" to "متوسطة", "sound_high" to "مرتفعة"))
      data == "set_zoom" -> showChoice(chatId, "🔍 التقريب", listOf("zoom_1" to "1×", "zoom_2" to "2×", "zoom_4" to "4×", "zoom_8" to "8×"))
      data.startsWith("quality_") -> { configureCapture(updateConfig { it.copy(videoQuality = data.removePrefix("quality_").replace("medium", "hd").replace("high", "fhd").replace("low", "sd")) }); showAdvanced(chatId) }
      data.startsWith("audio_") -> { updateConfig { it.copy(audioQuality = data.removePrefix("audio_")) }; showAdvanced(chatId) }
      data.startsWith("sensitivity_") -> { configureCapture(updateConfig { it.copy(motionSensitivity = data.removePrefix("sensitivity_")) }); showAdvanced(chatId) }
      data.startsWith("sound_") && !data.startsWith("sound_toggle") -> { updateConfig { it.copy(soundSensitivity = data.removePrefix("sound_")) }; startSoundDetection(); showAdvanced(chatId) }
      data.startsWith("zoom_") -> { configureCapture(updateConfig { it.copy(zoomRatio = data.removePrefix("zoom_").toFloatOrNull()?.coerceIn(1f, 8f) ?: 1f) }); showAdvanced(chatId) }
      data.startsWith("motion_toggle_") || data.startsWith("sound_toggle_") -> toggleDetectionAction(chatId, data)
      data == "motion_set_video_duration" -> cycleDuration(chatId, true)
      data == "sound_set_video_duration" -> cycleDuration(chatId, true)
      data == "motion_set_audio_duration" || data == "sound_set_audio_duration" -> cycleDuration(chatId, false)
      data == "storage_management" -> showStorage(chatId)
      data == "cleanup_old_files_now" -> cleanupEvidence(chatId)
      data == "save_all_settings" || data == "save_detection_actions" -> client.sendMessage(chatId, "✅ تم حفظ الإعدادات محليًا على الهاتف.")
      else -> client.sendMessage(chatId, "⚠️ زر غير مدعوم في هذه النسخة: <code>$data</code>")
    }
  }

  private fun capturePhoto(chatId: String, title: String) = submitEvidence(chatId, title) { camera.capturePhoto() }

  private fun recordVideo(chatId: String, seconds: Int, title: String) = submitEvidence(chatId, title) {
    withSoundPaused { withLongVideoBatteryMonitoring(chatId, seconds) { camera.recordVideo(seconds) } }
  }

  private fun recordAudio(chatId: String, seconds: Int, title: String) = submitEvidence(chatId, title) {
    withSoundPaused { audio.record(seconds, configStore.read().audioQuality) }
  }

  private fun submitEvidence(chatId: String, title: String, work: suspend () -> File): CompletableDeferred<DeliveryOutcome> {
    val completion = CompletableDeferred<DeliveryOutcome>()
    val queued = commandQueue.trySend(EvidenceTask(chatId, title, work, completion))
    if (queued.isSuccess) {
      runtime.setRunning("في الانتظار", "وُضع الأمر في طابور التنفيذ: $title")
      serviceScope.launch { bot?.sendMessage(chatId, "🕓 وُضع في الطابور: <b>$title</b>") }
    } else {
      completion.complete(DeliveryOutcome(false, "تعذر وضع الأمر في طابور التنفيذ."))
    }
    return completion
  }

  private suspend fun processEvidence(task: EvidenceTask) {
    if (task.completion.isCancelled) return
    activeTask = task
    val client = bot
    if (client == null) {
      task.completion.complete(DeliveryOutcome(false, "عامل Telegram غير متصل."))
      activeTask = null
      return
    }
    runtime.setRunning("تنفيذ", "جارٍ تنفيذ: ${task.title}")
    val lease = acquireWakeLock(330_000L)
    try {
      client.sendMessage(task.chatId, "⏳ جارٍ تنفيذ: <b>${task.title}</b>")
      val rawFile = task.work()
      if (task.completion.isCancelled) {
        rawFile.delete()
        return
      }
      val config = configStore.read()
      val evidence = EvidenceProcessor.prepare(rawFile, config.compressionEnabled)
      val telegram = client.sendEvidence(task.chatId, evidence.uploadFile, "✅ <b>نتيجة الأمر:</b> ${task.title}")
      if (!telegram.ok) error("فشل إرسال Telegram: ${telegram.description}")
      val gmail = if (config.gmailBackupEnabled) GmailEvidenceSender().sendEvidence(config, evidence.uploadFile, task.title) else GmailResult(true, "لم تُفعّل نسخة Gmail.")
      if (!gmail.ok) error("فشل إرسال Gmail: ${gmail.description}")
      if (config.autoDeleteEvidence) evidence.cleanupFiles.distinct().forEach { it.delete() }
      val channels = if (config.gmailBackupEnabled) "Telegram وGmail" else "Telegram"
      runtime.setRunning("نشط", "اكتمل: ${task.title} عبر $channels")
      task.completion.complete(DeliveryOutcome(true, "اكتمل $channels."))
    } catch (cancelled: CancellationException) {
      task.completion.complete(DeliveryOutcome(false, "أُلغي الأمر قبل اكتماله."))
      throw cancelled
    } catch (error: Exception) {
      val message = error.message ?: "خطأ غير معروف"
      runtime.setError("فشل ${task.title}: $message")
      client.sendMessage(task.chatId, "❌ فشل <b>${task.title}</b>: $message")
      task.completion.complete(DeliveryOutcome(false, message))
    } finally {
      lease?.let { if (it.isHeld) it.release() }
      activeTask = null
    }
  }

  private fun startLive(chatId: String, seconds: Int) {
    liveJob?.cancel()
    liveJob = serviceScope.launch {
      val client = bot ?: return@launch
      client.sendMessage(chatId, "🔴 بدأ بث إطار-بإطار حقيقي لمدة $seconds ثانية. استخدم زر الإيقاف لإلغائه.")
      val endAt = System.currentTimeMillis() + seconds.coerceIn(10, 600) * 1000L
      try {
        while (isActive && System.currentTimeMillis() < endAt) {
          val frame = submitEvidence(chatId, "إطار مباشر") { camera.capturePhoto() }
          try {
            val outcome = frame.await()
            if (!outcome.ok) throw IllegalStateException(outcome.description)
          } finally {
            if (!frame.isCompleted) frame.cancel()
          }
          delay(5_000L)
        }
        if (isActive) client.sendMessage(chatId, "✅ انتهى بث الإطارات.")
      } catch (_: CancellationException) {
        client.sendMessage(chatId, "⏹️ تم إيقاف بث الإطارات.")
      }
    }
  }

  private suspend fun stopLive(chatId: String) {
    liveJob?.cancel()
    liveJob = null
    bot?.sendMessage(chatId, "⏹️ أُرسل طلب إيقاف البث.")
  }

  private suspend fun stopAll(chatId: String) {
    stopLive(chatId)
    clearQueuedEvidence("أُلغي الأمر بعد طلب إيقاف الأنظمة.")
    activeTask?.completion?.cancel()
    camera.stopVideoRecording()
    audio.stopActiveRecording()
    soundMonitor.stop()
    val config = updateConfig { it.copy(motionEnabled = false, soundEnabled = false) }
    configureCapture(config)
    bot?.sendMessage(chatId, "🛑 أُوقفت الكشوفات والبث والتسجيلات النشطة.")
  }

  private fun clearQueuedEvidence(reason: String) {
    while (true) {
      val queued = commandQueue.tryReceive().getOrNull() ?: break
      queued.completion.complete(DeliveryOutcome(false, reason))
    }
  }

  private fun startSoundDetection() {
    val config = configStore.read()
    soundMonitor.stop()
    if (config.soundEnabled) soundMonitor.start(serviceScope, config.soundSensitivity) { serviceScope.launch { runDetection("sound") } }
  }

  private suspend fun runDetection(type: String) {
    if (!detectionBusy.compareAndSet(false, true)) return
    try {
      val config = configStore.read()
      if (type == "motion" && !config.motionEnabled) return
      if (type == "sound" && !config.soundEnabled) return
      val chatId = config.chatId
      bot?.sendMessage(chatId, "⚠️ تم رصد ${if (type == "motion") "حركة" else "صوت"} من الهاتف العامل.")
      val actions = if (type == "motion") listOf(config.motionPhoto, config.motionAudio, config.motionVideo) else listOf(config.soundPhoto, config.soundAudio, config.soundVideo)
      if (actions[0]) capturePhoto(chatId, "دليل كشف ${if (type == "motion") "الحركة" else "الصوت"}").await()
      if (actions[1]) recordAudio(chatId, config.detectionAudioDuration, "صوت كشف").await()
      if (actions[2]) recordVideo(chatId, config.detectionVideoDuration, "فيديو كشف").await()
    } finally {
      detectionBusy.set(false)
    }
  }

  private fun toggleDetectionAction(chatId: String, data: String) {
    val motion = data.startsWith("motion_")
    val action = data.substringAfter("toggle_")
    val config = updateConfig {
      if (motion) when (action) {
        "photo" -> it.copy(motionPhoto = !it.motionPhoto)
        "video" -> it.copy(motionVideo = !it.motionVideo)
        else -> it.copy(motionAudio = !it.motionAudio)
      } else when (action) {
        "photo" -> it.copy(soundPhoto = !it.soundPhoto)
        "video" -> it.copy(soundVideo = !it.soundVideo)
        else -> it.copy(soundAudio = !it.soundAudio)
      }
    }
    serviceScope.launch { if (motion) showDetectionEditor(chatId, "motion") else showDetectionEditor(chatId, "sound") }
  }

  private fun cycleDuration(chatId: String, video: Boolean) {
    updateConfig {
      if (video) it.copy(detectionVideoDuration = when (it.detectionVideoDuration) { 15 -> 30; 30 -> 60; else -> 15 })
      else it.copy(detectionAudioDuration = when (it.detectionAudioDuration) { 10 -> 20; 20 -> 30; else -> 10 })
    }
    serviceScope.launch { showDetectionActions(chatId) }
  }

  private suspend fun showMainMenu(chatId: String) {
    val config = configStore.read()
    val state = runtime.get()
    val cameraText = if (config.cameraFacing == "back") "خلفية" else "أمامية"
    val status = if (state.running) "🟢 نشط" else "🔴 متوقف"
    val text = """
      <b>🤖 نظام Akeer14 للمراقبة</b>
      ━━━━━━━━━━━━━━━━━━━━
      <b>الحالة:</b> $status
      <b>الكاميرا:</b> $cameraText ${if (config.flashEnabled) "🔦" else ""}
      <b>كشف الحركة:</b> ${if (config.motionEnabled) "🟢" else "🔴"}
      <b>كشف الصوت:</b> ${if (config.soundEnabled) "🟢" else "🔴"}
      <b>البث:</b> ${if (liveJob?.isActive == true) "🔴" else "⚫"}
      <b>الفيديو:</b> ${config.videoQuality.uppercase()} • <b>التقريب:</b> ${config.zoomRatio}×
      <b>آخر حالة:</b> ${state.message}
    """.trimIndent()
    bot?.sendMessage(chatId, text, keyboard(
      row("⚙️ الإعدادات المتقدمة" to "show_advanced_settings"),
      row("🔄 تحديث المعلومات" to "refresh_system_status"),
      row("━━━━━━━ 🎥 الوسائط ━━━━━━━" to "DO_NOTHING"),
      row("📸 التقاط صورة" to "capture_photo", "🎤 تسجيل صوت" to "record_audio"),
      row("🎬 تسجيل فيديو" to "record_video", "🔴 بث إطار-بإطار" to "start_live_stream"),
      row("━━━━━━━ 🎯 الأنظمة ━━━━━━━" to "DO_NOTHING"),
      row("🚀 بدء كشف الحركة" to "start_motion_detection", "👂 بدء كشف الأصوات" to "start_sound_detection"),
      row("🛑 إيقاف كل الأنظمة" to "stop_all_systems"),
      row("📊 تقرير النظام" to "system_report", "🆘 طوارئ" to "emergency_panel"),
      row("⏹️ إيقاف العامل" to "shutdown_system"),
    ))
  }

  private suspend fun showAdvanced(chatId: String) {
    val c = configStore.read()
    val text = """
      <b>⚙️ الإعدادات المتقدمة الحقيقية</b>
      ━━━━━━━━━━━━━━━━━━━━
      🎥 الفيديو: ${c.videoQuality.uppercase()} • 🔊 الصوت: ${c.audioQuality.uppercase()}
      🎯 الحركة: ${c.motionSensitivity.uppercase()} • 👂 الصوت: ${c.soundSensitivity.uppercase()}
      📷 الكاميرا: ${if (c.cameraFacing == "back") "خلفية" else "أمامية"} • 🔍 ${c.zoomRatio}×
      🔦 الفلاش: ${if (c.flashEnabled) "مفعل" else "معطل"}
      📦 الضغط: ${if (c.compressionEnabled) "مفعل" else "معطل"}
      🗑️ الحذف التلقائي: ${if (c.autoDeleteEvidence) "مفعل" else "معطل"}
    """.trimIndent()
    bot?.sendMessage(chatId, text, keyboard(
      row("🎥 جودة الفيديو" to "set_video_quality", "🔊 جودة الصوت" to "set_audio_quality"),
      row("🎯 حساسية الحركة" to "set_motion_sensitivity", "👂 حساسية الصوت" to "set_sound_threshold"),
      row("📷 تبديل الكاميرا" to "toggle_camera", "🔦 الفلاش" to "toggle_flash_setting"),
      row("🔍 التقريب" to "set_zoom", "📦 الضغط" to "toggle_compression"),
      row("🗑️ الحذف التلقائي" to "toggle_auto_delete", "💾 التخزين" to "storage_management"),
      row("🆘 الطوارئ" to "emergency_panel", "🎯 إجراءات الكشف" to "detection_actions_menu"),
      row("🏠 الرئيسية" to "back_to_advanced_main", "💾 حفظ" to "save_all_settings"),
    ))
  }

  private suspend fun showEmergency(chatId: String) {
    bot?.sendMessage(chatId, "<b>🆘 لوحة الطوارئ</b>\nكل الأزرار التالية تنفذ عمليات وسائط حقيقية من الهاتف العامل.", keyboard(
      row("🚨 تفعيل الكشوفات" to "activate_all_detections"),
      row("📸 تصوير طوارئ" to "emergency_photo", "🎵 تسجيل طوارئ" to "emergency_audio"),
      row("🎥 فيديو 30ث" to "emergency_video", "🎥 فيديو 60ث" to "emergency_video_60"),
      row("🎥 فيديو 180ث" to "emergency_video_180", "🔴 بث 120ث" to "live_120"),
      row("⏹️ إيقاف البث" to "live_stop", "🛑 إيقاف الطوارئ" to "stop_emergency"),
      row("🏠 الرئيسية" to "back_to_advanced_main"),
    ))
  }

  private suspend fun showDetectionActions(chatId: String) {
    val c = configStore.read()
    bot?.sendMessage(chatId, "<b>🎯 إجراءات الكشف</b>\nالحركة: ${actionSummary(c, true)}\nالصوت: ${actionSummary(c, false)}", keyboard(
      row("🎯 إجراءات كشف الحركة" to "edit_motion_actions"),
      row("👂 إجراءات كشف الصوت" to "edit_sound_actions"),
      row("← الإعدادات" to "show_advanced_settings", "🏠 الرئيسية" to "back_to_advanced_main"),
    ))
  }

  private suspend fun showDetectionEditor(chatId: String, type: String) {
    val c = configStore.read()
    val motion = type == "motion"
    val photo = if (motion) c.motionPhoto else c.soundPhoto
    val video = if (motion) c.motionVideo else c.soundVideo
    val audio = if (motion) c.motionAudio else c.soundAudio
    val prefix = if (motion) "motion" else "sound"
    bot?.sendMessage(chatId, "<b>${if (motion) "🎯 كشف الحركة" else "👂 كشف الصوت"}</b>\nاضغط لتبديل الإجراء أو المدة.", keyboard(
      row("${flag(photo)} 📸" to "${prefix}_toggle_photo", "${flag(video)} 🎥" to "${prefix}_toggle_video", "${flag(audio)} 🎵" to "${prefix}_toggle_audio"),
      row("⏱️ فيديو ${c.detectionVideoDuration}ث" to "${prefix}_set_video_duration", "⏱️ صوت ${c.detectionAudioDuration}ث" to "${prefix}_set_audio_duration"),
      row("💾 حفظ" to "save_detection_actions", "← رجوع" to "detection_actions_menu"),
    ))
  }

  private suspend fun showChoice(chatId: String, title: String, choices: List<Pair<String, String>>) {
    bot?.sendMessage(chatId, "<b>$title</b>\nاختر قيمة سيتم تطبيقها فعليًا على العامل.", keyboard(*choices.map { row(it.second to it.first) }.toTypedArray()))
  }

  private suspend fun showStorage(chatId: String) {
    val root = getExternalFilesDir(null) ?: filesDir
    val free = root.freeSpace / (1024 * 1024)
    bot?.sendMessage(chatId, "<b>💾 إدارة التخزين</b>\nالمساحة المتبقية: ${free}MB\nالمسار: <code>${root.absolutePath}</code>", keyboard(
      row("🧹 تنظيف الأدلة الآن" to "cleanup_old_files_now"),
      row("← الإعدادات" to "show_advanced_settings"),
    ))
  }

  private suspend fun cleanupEvidence(chatId: String) {
    val root = getExternalFilesDir(null) ?: filesDir
    val cutoff = System.currentTimeMillis() - 7L * 24L * 60L * 60L * 1000L
    var removed = 0
    root.walkTopDown().filter { it.isFile && it.lastModified() < cutoff }.forEach { if (it.delete()) removed += 1 }
    bot?.sendMessage(chatId, "✅ تم تنظيف $removed ملفًا قديمًا من الأدلة المحلية.")
  }

  private suspend fun showSystemReport(chatId: String) {
    val state = runtime.get()
    val health = DeviceHealthMonitor.snapshot(this)
    val battery = if (health.batteryPercent >= 0) "${health.batteryPercent}% ${if (health.charging) "(شحن)" else ""}" else "غير متاح"
    val internet = if (health.internetReachable) "متاح" else "غير متاح"
    bot?.sendMessage(chatId, "<b>📊 تقرير النظام</b>\nالحالة: ${state.phase}\nالبطارية: $battery\nالإنترنت: $internet\nآخر رسالة: ${state.message}\nآخر تحديث: ${state.updatedAt}\n${if (state.lastError.isNotBlank()) "خطأ: ${state.lastError}" else "لا يوجد خطأ مسجل."}")
  }

  private suspend fun <T> withSoundPaused(block: suspend () -> T): T {
    val restart = soundMonitor.isRunning
    if (restart) soundMonitor.stop()
    return try {
      block()
    } finally {
      if (restart) startSoundDetection()
    }
  }

  private fun updateConfig(transform: (AgentConfig) -> AgentConfig): AgentConfig = configStore.update(transform)

  private fun isAllowed(chatId: String, userId: String): Boolean {
    val config = configStore.read()
    if (chatId != config.chatId) return false
    val allowed = config.allowedUserIds.split(",").map { it.trim() }.filter { it.isNotBlank() }
    return allowed.isEmpty() || userId in allowed
  }

  private fun keyboard(vararg rows: JSONArray): JSONArray = JSONArray().apply { rows.forEach { put(it) } }

  private fun row(vararg items: Pair<String, String>): JSONArray = JSONArray().apply {
    items.forEach { (text, data) -> put(JSONObject().put("text", text).put("callback_data", data)) }
  }

  private fun actionSummary(config: AgentConfig, motion: Boolean): String {
    val photo = if (motion) config.motionPhoto else config.soundPhoto
    val audio = if (motion) config.motionAudio else config.soundAudio
    val video = if (motion) config.motionVideo else config.soundVideo
    return listOfNotNull(
      if (photo) "📸" else null,
      if (audio) "🎵(${config.detectionAudioDuration}ث)" else null,
      if (video) "🎥(${config.detectionVideoDuration}ث)" else null,
    ).joinToString(" ").ifBlank { "⚫ لا يوجد" }
  }

  private fun flag(enabled: Boolean): String = if (enabled) "🟢" else "🔴"

  private fun hasPermissions(): Boolean =
    ActivityCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED &&
      ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

  private fun acquireWakeLock(timeoutMillis: Long): PowerManager.WakeLock? = runCatching {
    val manager = getSystemService(POWER_SERVICE) as PowerManager
    manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Akeer14:TelegramCommand").apply { acquire(timeoutMillis) }
  }.getOrNull()

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "عامل Telegram", NotificationManager.IMPORTANCE_LOW).apply {
        description = "يبقي هذا الإشعار عامل Telegram قيد التشغيل بعد أن تشغله من التطبيق."
        setShowBadge(false)
      }
      (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }
  }

  private fun startForegroundCompat(message: String) {
    startForeground(NOTIFICATION_ID, buildNotification(message))
  }

  private fun updateNotification(message: String) {
    (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, buildNotification(message))
  }

  private fun buildNotification(message: String): android.app.Notification {
    val openIntent = PendingIntent.getActivity(
      this,
      1,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val stopIntent = PendingIntent.getService(
      this,
      2,
      Intent(this, TelegramAgentService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("عامل Akeer14 نشط")
      .setContentText(message)
      .setOngoing(true)
      .setContentIntent(openIntent)
      .addAction(0, "إيقاف العامل", stopIntent)
      .build()
  }

  private fun stopAgent(message: String) {
    pollJob?.cancel()
    liveJob?.cancel()
    healthJob?.cancel()
    clearQueuedEvidence("أُوقف العامل قبل تنفيذ هذا الأمر.")
    activeTask?.completion?.cancel()
    audio.stopActiveRecording()
    soundMonitor.stop()
    runCatching { camera.release() }
    runtime.setStopped(message)
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    pollJob?.cancel()
    liveJob?.cancel()
    healthJob?.cancel()
    clearQueuedEvidence("دُمّرت خدمة العامل قبل تنفيذ هذا الأمر.")
    activeTask?.completion?.cancel()
    audio.stopActiveRecording()
    soundMonitor.stop()
    runCatching { camera.release() }
    serviceScope.cancel()
    super.onDestroy()
  }
}
