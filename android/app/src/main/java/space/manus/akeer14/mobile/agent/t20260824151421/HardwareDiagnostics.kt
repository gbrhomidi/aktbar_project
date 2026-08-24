package space.manus.akeer14.mobile.agent.t20260824151421

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.sqrt

data class HardwareDiagnosticResult(
  val cameraOk: Boolean,
  val cameraDetail: String,
  val microphoneOk: Boolean,
  val microphoneDetail: String,
)

object HardwareDiagnostics {
  suspend fun run(context: Context, lifecycleOwner: LifecycleOwner): HardwareDiagnosticResult {
    val camera = testCamera(context, lifecycleOwner)
    val microphone = testMicrophone(context)
    return HardwareDiagnosticResult(camera.first, camera.second, microphone.first, microphone.second)
  }

  private suspend fun testCamera(context: Context, lifecycleOwner: LifecycleOwner): Pair<Boolean, String> {
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      return false to "إذن الكاميرا غير ممنوح. امنحه من إعدادات Android ثم أعد الاختبار."
    }
    val controller = AgentCameraController(context, lifecycleOwner) { }
    return try {
      controller.configure(AgentConfig())
      val photo = controller.capturePhoto()
      EvidenceProcessor.validate(photo)
      val bytes = photo.length()
      photo.delete()
      true to "التقطت الكاميرا صورة اختبار حقيقية ($bytes بايت) ثم حُذفت."
    } catch (error: Exception) {
      false to "فشل اختبار الكاميرا: ${error.message ?: "خطأ غير معروف"}"
    } finally {
      controller.release()
    }
  }

  private suspend fun testMicrophone(context: Context): Pair<Boolean, String> = withContext(Dispatchers.IO) {
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      return@withContext false to "إذن الميكروفون غير ممنوح. امنحه من إعدادات Android ثم أعد الاختبار."
    }
    val sampleRate = 16_000
    val minimum = AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    if (minimum <= 0) return@withContext false to "لا يدعم الجهاز تهيئة AudioRecord المطلوبة."
    val recorder = AudioRecord(MediaRecorder.AudioSource.MIC, sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, minimum * 2)
    try {
      check(recorder.state == AudioRecord.STATE_INITIALIZED) { "تعذر تهيئة الميكروفون." }
      val buffer = ShortArray(minimum / 2)
      recorder.startRecording()
      var readTotal = 0
      var sumSquares = 0.0
      repeat(8) {
        val read = recorder.read(buffer, 0, buffer.size)
        check(read > 0) { "لم يرجع AudioRecord عينات صوتية صالحة." }
        readTotal += read
        for (index in 0 until read) sumSquares += buffer[index].toDouble() * buffer[index]
      }
      val rms = sqrt(sumSquares / readTotal).toInt()
      true to "قرأ الميكروفون $readTotal عينة PCM فعلية (RMS=$rms)."
    } catch (error: Exception) {
      false to "فشل اختبار الميكروفون: ${error.message ?: "خطأ غير معروف"}"
    } finally {
      runCatching { recorder.stop() }
      recorder.release()
    }
  }
}
