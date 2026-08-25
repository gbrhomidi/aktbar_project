package space.manus.akeer14.mobile.agent.t20260824151421

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.facebook.react.bridge.ReadableMap

data class AgentConfig(
  val botToken: String = "",
  val chatId: String = "",
  val allowedUserIds: String = "",
  val gmailBackupEnabled: Boolean = false,
  val gmailHost: String = "smtp.gmail.com",
  val gmailPort: Int = 587,
  val gmailUsername: String = "",
  val gmailAppPassword: String = "",
  val gmailRecipient: String = "",
  val smsAlertsEnabled: Boolean = false,
  val smsAlertPhone: String = "",
  val smsOnInternetLoss: Boolean = true,
  val smsOnLowBattery: Boolean = true,
  val smsInternetLossMessage: String = "Akeer14: تعذر الوصول إلى الإنترنت من الهاتف العامل. تحقق من الشبكة.",
  val smsLowBatteryMessage: String = "Akeer14: بطارية الهاتف العامل منخفضة ({battery}%). اشحن الجهاز فورًا.",
  val smsBatteryThreshold: Int = 15,
  val videoSafetyBatteryThreshold: Int = 5,
  val keepServiceAlive: Boolean = true,
  val cameraFacing: String = "back",
  val flashEnabled: Boolean = false,
  val compressionEnabled: Boolean = true,
  val videoCompressionEnabled: Boolean = true,
  val videoCompressionHeight: Int = 480,
  val autoDeleteEvidence: Boolean = true,
  val videoQuality: String = "hd",
  val audioQuality: String = "medium",
  val zoomRatio: Float = 1f,
  val motionEnabled: Boolean = false,
  val soundEnabled: Boolean = false,
  val motionSensitivity: String = "medium",
  val soundSensitivity: String = "medium",
  val motionPhoto: Boolean = true,
  val motionVideo: Boolean = false,
  val motionAudio: Boolean = false,
  val soundPhoto: Boolean = false,
  val soundVideo: Boolean = false,
  val soundAudio: Boolean = true,
  val detectionVideoDuration: Int = 15,
  val detectionAudioDuration: Int = 10,
) {
  val isReady: Boolean get() = botToken.contains(":") && chatId.isNotBlank()
  val gmailReady: Boolean get() = gmailBackupEnabled && gmailUsername.isNotBlank() && gmailAppPassword.isNotBlank() && gmailRecipient.isNotBlank()
  val smsReady: Boolean get() = smsAlertsEnabled && smsAlertPhone.length >= 6
}

class AgentConfigStore(context: Context) {
  private val prefs = EncryptedSharedPreferences.create(
    context,
    "telegram_agent_secrets",
    MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )

  fun save(input: ReadableMap): AgentConfig {
    val current = read()
    // The app UI owns credentials only. Runtime controls remain authoritative in Telegram.
    // Merge from the current encrypted record so a React Native save cannot reset Telegram changes.
    val next = current.copy(
      botToken = input.stringOr("botToken", current.botToken),
      chatId = input.stringOr("chatId", current.chatId),
      allowedUserIds = input.stringOr("allowedUserIds", current.allowedUserIds),
      gmailBackupEnabled = input.booleanOr("gmailBackupEnabled", current.gmailBackupEnabled),
      gmailHost = input.stringOr("gmailHost", current.gmailHost).ifBlank { "smtp.gmail.com" },
      gmailPort = input.doubleOr("gmailPort", current.gmailPort.toDouble()).toInt().coerceIn(1, 65_535),
      gmailUsername = input.stringOr("gmailUsername", current.gmailUsername),
      gmailAppPassword = input.stringOr("gmailAppPassword", current.gmailAppPassword),
      gmailRecipient = input.stringOr("gmailRecipient", current.gmailRecipient),
    )
    write(next)
    return next
  }

  fun read(): AgentConfig = AgentConfig(
    botToken = prefs.getString("botToken", "") ?: "",
    chatId = prefs.getString("chatId", "") ?: "",
    allowedUserIds = prefs.getString("allowedUserIds", "") ?: "",
    gmailBackupEnabled = prefs.getBoolean("gmailBackupEnabled", false),
    gmailHost = prefs.getString("gmailHost", "smtp.gmail.com") ?: "smtp.gmail.com",
    gmailPort = prefs.getInt("gmailPort", 587).coerceIn(1, 65_535),
    gmailUsername = prefs.getString("gmailUsername", "") ?: "",
    gmailAppPassword = prefs.getString("gmailAppPassword", "") ?: "",
    gmailRecipient = prefs.getString("gmailRecipient", "") ?: "",
    smsAlertsEnabled = prefs.getBoolean("smsAlertsEnabled", false),
    smsAlertPhone = prefs.getString("smsAlertPhone", "") ?: "",
    smsOnInternetLoss = prefs.getBoolean("smsOnInternetLoss", true),
    smsOnLowBattery = prefs.getBoolean("smsOnLowBattery", true),
    smsInternetLossMessage = prefs.getString("smsInternetLossMessage", "Akeer14: تعذر الوصول إلى الإنترنت من الهاتف العامل. تحقق من الشبكة.") ?: "Akeer14: تعذر الوصول إلى الإنترنت من الهاتف العامل. تحقق من الشبكة.",
    smsLowBatteryMessage = prefs.getString("smsLowBatteryMessage", "Akeer14: بطارية الهاتف العامل منخفضة ({battery}%). اشحن الجهاز فورًا.") ?: "Akeer14: بطارية الهاتف العامل منخفضة ({battery}%). اشحن الجهاز فورًا.",
    smsBatteryThreshold = prefs.getInt("smsBatteryThreshold", 15).coerceIn(5, 75),
    videoSafetyBatteryThreshold = prefs.getInt("videoSafetyBatteryThreshold", 5).coerceIn(2, 50),
    keepServiceAlive = prefs.getBoolean("keepServiceAlive", true),
    cameraFacing = prefs.getString("cameraFacing", "back") ?: "back",
    flashEnabled = prefs.getBoolean("flashEnabled", false),
    compressionEnabled = prefs.getBoolean("compressionEnabled", true),
    videoCompressionEnabled = prefs.getBoolean("videoCompressionEnabled", true),
    videoCompressionHeight = prefs.getInt("videoCompressionHeight", 480).coerceIn(360, 720),
    autoDeleteEvidence = prefs.getBoolean("autoDeleteEvidence", true),
    videoQuality = prefs.getString("videoQuality", "hd") ?: "hd",
    audioQuality = prefs.getString("audioQuality", "medium") ?: "medium",
    zoomRatio = prefs.getFloat("zoomRatio", 1f).coerceIn(1f, 8f),
    motionEnabled = prefs.getBoolean("motionEnabled", false),
    soundEnabled = prefs.getBoolean("soundEnabled", false),
    motionSensitivity = prefs.getString("motionSensitivity", "medium") ?: "medium",
    soundSensitivity = prefs.getString("soundSensitivity", "medium") ?: "medium",
    motionPhoto = prefs.getBoolean("motionPhoto", true),
    motionVideo = prefs.getBoolean("motionVideo", false),
    motionAudio = prefs.getBoolean("motionAudio", false),
    soundPhoto = prefs.getBoolean("soundPhoto", false),
    soundVideo = prefs.getBoolean("soundVideo", false),
    soundAudio = prefs.getBoolean("soundAudio", true),
    detectionVideoDuration = prefs.getInt("detectionVideoDuration", 15).coerceIn(5, 300),
    detectionAudioDuration = prefs.getInt("detectionAudioDuration", 10).coerceIn(5, 120),
  )

  fun update(transform: (AgentConfig) -> AgentConfig): AgentConfig = transform(read()).also(::write)

  fun clear() = prefs.edit().clear().apply()

  private fun write(config: AgentConfig) {
    prefs.edit()
      .putString("botToken", config.botToken)
      .putString("chatId", config.chatId)
      .putString("allowedUserIds", config.allowedUserIds)
      .putBoolean("gmailBackupEnabled", config.gmailBackupEnabled)
      .putString("gmailHost", config.gmailHost)
      .putInt("gmailPort", config.gmailPort)
      .putString("gmailUsername", config.gmailUsername)
      .putString("gmailAppPassword", config.gmailAppPassword)
      .putString("gmailRecipient", config.gmailRecipient)
      .putBoolean("smsAlertsEnabled", config.smsAlertsEnabled)
      .putString("smsAlertPhone", config.smsAlertPhone)
      .putBoolean("smsOnInternetLoss", config.smsOnInternetLoss)
      .putBoolean("smsOnLowBattery", config.smsOnLowBattery)
      .putString("smsInternetLossMessage", config.smsInternetLossMessage)
      .putString("smsLowBatteryMessage", config.smsLowBatteryMessage)
      .putInt("smsBatteryThreshold", config.smsBatteryThreshold)
      .putInt("videoSafetyBatteryThreshold", config.videoSafetyBatteryThreshold)
      .putBoolean("keepServiceAlive", config.keepServiceAlive)
      .putString("cameraFacing", config.cameraFacing)
      .putBoolean("flashEnabled", config.flashEnabled)
      .putBoolean("compressionEnabled", config.compressionEnabled)
      .putBoolean("videoCompressionEnabled", config.videoCompressionEnabled)
      .putInt("videoCompressionHeight", config.videoCompressionHeight)
      .putBoolean("autoDeleteEvidence", config.autoDeleteEvidence)
      .putString("videoQuality", config.videoQuality)
      .putString("audioQuality", config.audioQuality)
      .putFloat("zoomRatio", config.zoomRatio)
      .putBoolean("motionEnabled", config.motionEnabled)
      .putBoolean("soundEnabled", config.soundEnabled)
      .putString("motionSensitivity", config.motionSensitivity)
      .putString("soundSensitivity", config.soundSensitivity)
      .putBoolean("motionPhoto", config.motionPhoto)
      .putBoolean("motionVideo", config.motionVideo)
      .putBoolean("motionAudio", config.motionAudio)
      .putBoolean("soundPhoto", config.soundPhoto)
      .putBoolean("soundVideo", config.soundVideo)
      .putBoolean("soundAudio", config.soundAudio)
      .putInt("detectionVideoDuration", config.detectionVideoDuration)
      .putInt("detectionAudioDuration", config.detectionAudioDuration)
      .apply()
  }

  private fun ReadableMap.stringOr(key: String, fallback: String): String =
    if (hasKey(key) && !isNull(key)) getString(key)?.trim()?.takeIf { it.isNotBlank() } ?: fallback else fallback

  private fun ReadableMap.booleanOr(key: String, fallback: Boolean): Boolean =
    if (hasKey(key) && !isNull(key)) getBoolean(key) else fallback

  private fun ReadableMap.doubleOr(key: String, fallback: Double): Double =
    if (hasKey(key) && !isNull(key)) getDouble(key) else fallback
}
