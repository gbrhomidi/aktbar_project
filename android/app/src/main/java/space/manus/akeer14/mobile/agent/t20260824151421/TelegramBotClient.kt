package space.manus.akeer14.mobile.agent.t20260824151421

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.DataOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

data class TelegramResult(val ok: Boolean, val description: String = "", val result: Any? = null)

class TelegramBotClient(
  private val token: String,
  private val onDelivery: ((channel: String, kind: String, ok: Boolean, detail: String) -> Unit)? = null,
) {
  private val baseUrl = "https://api.telegram.org/bot$token/"

  suspend fun getMe(): TelegramResult = call("getMe", emptyMap())

  suspend fun deleteWebhook(): TelegramResult = call("deleteWebhook", mapOf("drop_pending_updates" to "false"))

  suspend fun getUpdates(offset: Long): TelegramResult = call(
    "getUpdates",
    mapOf("offset" to offset.toString(), "timeout" to "25", "allowed_updates" to "[\"message\",\"callback_query\"]"),
  )

  suspend fun answerCallback(id: String): TelegramResult = call("answerCallbackQuery", mapOf("callback_query_id" to id))

  suspend fun sendMessage(chatId: String, html: String, keyboard: JSONArray? = null): TelegramResult {
    val fields = mutableMapOf("chat_id" to chatId, "text" to html, "parse_mode" to "HTML")
    if (keyboard != null) fields["reply_markup"] = JSONObject().put("inline_keyboard", keyboard).toString()
    return call("sendMessage", fields).also { onDelivery?.invoke("Telegram", "رسالة", it.ok, it.description.ifBlank { if (it.ok) "تم إرسال إشعار Telegram." else "فشل إرسال إشعار Telegram." }) }
  }

  suspend fun sendEvidence(chatId: String, file: File, caption: String): TelegramResult {
    if (!file.exists() || file.length() <= 0L) return TelegramResult(false, "ملف الدليل غير موجود أو فارغ.")
    val endpoint = when (file.extension.lowercase()) {
      "jpg", "jpeg", "png" -> "sendPhoto"
      "mp4" -> "sendVideo"
      "m4a", "aac", "mp3", "wav" -> "sendAudio"
      else -> "sendDocument"
    }
    val partName = when (endpoint) {
      "sendPhoto" -> "photo"
      "sendVideo" -> "video"
      "sendAudio" -> "audio"
      else -> "document"
    }
    return multipart(endpoint, mapOf("chat_id" to chatId, "caption" to caption, "parse_mode" to "HTML"), partName, file).also { onDelivery?.invoke("Telegram", "دليل ${file.extension.lowercase()}", it.ok, it.description.ifBlank { if (it.ok) "تم رفع دليل إلى Telegram." else "فشل رفع الدليل إلى Telegram." }) }
  }

  private suspend fun call(method: String, fields: Map<String, String>): TelegramResult = withContext(Dispatchers.IO) {
    runCatching {
      val encoded = fields.entries.joinToString("&") { "${it.key.url()}=${it.value.url()}" }
      val connection = (URL(baseUrl + method).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 20_000
        readTimeout = 35_000
        doOutput = true
        setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
      }
      connection.outputStream.use { it.write(encoded.toByteArray(Charsets.UTF_8)) }
      response(connection)
    }.getOrElse { TelegramResult(false, it.message ?: "تعذر الاتصال بخادم Telegram.") }
  }

  private suspend fun multipart(method: String, fields: Map<String, String>, partName: String, file: File): TelegramResult = withContext(Dispatchers.IO) {
    runCatching {
      val boundary = "Agent-${UUID.randomUUID()}"
      val connection = (URL(baseUrl + method).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 20_000
        readTimeout = 60_000
        doOutput = true
        setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
      }
      DataOutputStream(connection.outputStream).use { out ->
        fields.forEach { (key, value) ->
          out.writeBytes("--$boundary\r\n")
          out.writeBytes("Content-Disposition: form-data; name=\"$key\"\r\n\r\n")
          out.write(value.toByteArray(Charsets.UTF_8))
          out.writeBytes("\r\n")
        }
        out.writeBytes("--$boundary\r\n")
        out.writeBytes("Content-Disposition: form-data; name=\"$partName\"; filename=\"${file.name}\"\r\n")
        out.writeBytes("Content-Type: ${mimeFor(file)}\r\n\r\n")
        BufferedInputStream(file.inputStream()).use { input -> input.copyTo(out) }
        out.writeBytes("\r\n--$boundary--\r\n")
      }
      response(connection)
    }.getOrElse { TelegramResult(false, it.message ?: "تعذر رفع الوسيط إلى Telegram.") }
  }

  private fun response(connection: HttpURLConnection): TelegramResult {
    val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
    val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
    val json = runCatching { JSONObject(body) }.getOrNull()
    return TelegramResult(json?.optBoolean("ok") == true, json?.optString("description").orEmpty(), json?.opt("result"))
  }

  private fun String.url(): String = java.net.URLEncoder.encode(this, "UTF-8")

  private fun mimeFor(file: File): String = when (file.extension.lowercase()) {
    "jpg", "jpeg" -> "image/jpeg"
    "png" -> "image/png"
    "mp4" -> "video/mp4"
    "m4a" -> "audio/mp4"
    "aac" -> "audio/aac"
    "wav" -> "audio/wav"
    else -> "application/octet-stream"
  }
}
