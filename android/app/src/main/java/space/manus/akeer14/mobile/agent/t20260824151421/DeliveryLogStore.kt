package space.manus.akeer14.mobile.agent.t20260824151421

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

data class DeliveryLogEntry(
  val id: String,
  val timestamp: String,
  val channel: String,
  val kind: String,
  val ok: Boolean,
  val detail: String,
)

class DeliveryLogStore(context: Context) {
  companion object {
    private const val PREFS = "agent_delivery_log"
    private const val KEY_ENTRIES = "entries"
    private const val MAX_ENTRIES = 120
  }

  private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun append(channel: String, kind: String, ok: Boolean, detail: String) {
    val items = JSONArray(prefs.getString(KEY_ENTRIES, "[]") ?: "[]")
    val next = JSONArray().put(JSONObject().apply {
      put("id", UUID.randomUUID().toString())
      put("timestamp", SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date()))
      put("channel", channel)
      put("kind", kind)
      put("ok", ok)
      put("detail", detail.take(240))
    })
    for (index in 0 until minOf(items.length(), MAX_ENTRIES - 1)) next.put(items.optJSONObject(index))
    prefs.edit().putString(KEY_ENTRIES, next.toString()).apply()
  }

  fun read(limit: Int = 80): List<DeliveryLogEntry> {
    val items = JSONArray(prefs.getString(KEY_ENTRIES, "[]") ?: "[]")
    return buildList {
      for (index in 0 until minOf(items.length(), limit.coerceIn(1, MAX_ENTRIES))) {
        val item = items.optJSONObject(index) ?: continue
        add(DeliveryLogEntry(
          id = item.optString("id"),
          timestamp = item.optString("timestamp"),
          channel = item.optString("channel"),
          kind = item.optString("kind"),
          ok = item.optBoolean("ok"),
          detail = item.optString("detail"),
        ))
      }
    }
  }

  fun clear() = prefs.edit().remove(KEY_ENTRIES).apply()

  fun exportText(): String = buildString {
    appendLine("Akeer14 delivery log")
    appendLine("====================")
    read(MAX_ENTRIES).forEach { entry ->
      appendLine("${entry.timestamp} | ${entry.channel} | ${entry.kind} | ${if (entry.ok) "OK" else "FAIL"} | ${entry.detail}")
    }
  }
}
