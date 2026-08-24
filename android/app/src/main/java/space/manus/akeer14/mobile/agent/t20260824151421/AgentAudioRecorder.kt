package space.manus.akeer14.mobile.agent.t20260824151421

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.os.Environment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicReference

class AgentAudioRecorder(private val context: Context) {
  private val activeRecorder = AtomicReference<MediaRecorder?>(null)

  @Suppress("DEPRECATION")
  suspend fun record(durationSeconds: Int, quality: String): File = withContext(Dispatchers.IO) {
    val root = context.getExternalFilesDir(Environment.DIRECTORY_MUSIC) ?: context.filesDir
    if (!root.exists()) root.mkdirs()
    val stamp = SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US).format(Date())
    val file = File(root, "AUD_${stamp}.m4a")
    val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else MediaRecorder()
    var started = false
    try {
      val sampleRate = when (quality.lowercase()) {
        "high" -> 48_000
        "low" -> 16_000
        else -> 44_100
      }
      recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
      recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
      recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
      recorder.setAudioSamplingRate(sampleRate)
      recorder.setAudioEncodingBitRate(if (quality.lowercase() == "high") 192_000 else 96_000)
      recorder.setOutputFile(file.absolutePath)
      recorder.prepare()
      activeRecorder.set(recorder)
      recorder.start()
      started = true
      delay(durationSeconds.coerceIn(5, 120) * 1000L)
      activeRecorder.compareAndSet(recorder, null)
      recorder.stop()
      started = false
      check(file.exists() && file.length() > 512L) { "لم ينتج التسجيل الصوتي ملف M4A صالحًا." }
      file
    } catch (error: Exception) {
      file.delete()
      throw error
    } finally {
      activeRecorder.compareAndSet(recorder, null)
      if (started) runCatching { recorder.stop() }
      runCatching { recorder.reset() }
      runCatching { recorder.release() }
    }
  }

  fun stopActiveRecording() {
    activeRecorder.getAndSet(null)?.let { recorder ->
      runCatching { recorder.stop() }
      runCatching { recorder.reset() }
      runCatching { recorder.release() }
    }
  }
}
