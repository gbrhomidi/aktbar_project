package space.manus.akeer14.mobile.agent.t20260824151421

import android.content.Context
import java.time.Instant

data class AgentRuntime(
  val running: Boolean,
  val phase: String,
  val message: String,
  val updatedAt: String,
  val lastError: String,
)

class AgentRuntimeStore(context: Context) {
  private val prefs = context.getSharedPreferences("telegram_agent_runtime", Context.MODE_PRIVATE)

  fun get(): AgentRuntime = AgentRuntime(
    running = prefs.getBoolean("running", false),
    phase = prefs.getString("phase", "متوقف") ?: "متوقف",
    message = prefs.getString("message", "لم يبدأ العامل بعد.") ?: "لم يبدأ العامل بعد.",
    updatedAt = prefs.getString("updatedAt", "") ?: "",
    lastError = prefs.getString("lastError", "") ?: "",
  )

  fun setRunning(phase: String, message: String) = save(true, phase, message, "")

  fun setError(message: String) = save(get().running, "خطأ", message, message)

  fun setStopped(message: String) = save(false, "متوقف", message, "")

  private fun save(running: Boolean, phase: String, message: String, error: String) {
    prefs.edit()
      .putBoolean("running", running)
      .putString("phase", phase)
      .putString("message", message)
      .putString("updatedAt", Instant.now().toString())
      .putString("lastError", error)
      .apply()
  }
}
