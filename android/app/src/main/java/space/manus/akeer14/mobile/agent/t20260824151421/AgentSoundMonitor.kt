package space.manus.akeer14.mobile.agent.t20260824151421

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.log10
import kotlin.math.sqrt

class AgentSoundMonitor {
  private var job: Job? = null

  fun start(scope: CoroutineScope, sensitivity: String, onSound: () -> Unit) {
    if (job?.isActive == true) return
    val threshold = when (sensitivity.lowercase()) {
      "high" -> -50.0
      "low" -> -20.0
      else -> -35.0
    }
    job = scope.launch(Dispatchers.Default) {
      val sampleRate = 16_000
      val min = AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
      if (min <= 0) return@launch
      val recorder = AudioRecord(
        MediaRecorder.AudioSource.MIC,
        sampleRate,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        min * 2,
      )
      val buffer = ShortArray(min)
      var lastTrigger = 0L
      try {
        recorder.startRecording()
        while (isActive) {
          val count = recorder.read(buffer, 0, buffer.size)
          if (count <= 0) continue
          var sum = 0.0
          for (index in 0 until count) {
            val sample = buffer[index].toDouble() / Short.MAX_VALUE
            sum += sample * sample
          }
          val rms = sqrt(sum / count)
          val dbfs = if (rms > 0.0) 20 * log10(rms) else -96.0
          val now = System.currentTimeMillis()
          if (dbfs >= threshold && now - lastTrigger > 10_000L) {
            lastTrigger = now
            onSound()
          }
        }
      } finally {
        runCatching { recorder.stop() }
        recorder.release()
      }
    }
  }

  fun stop() {
    job?.cancel()
    job = null
  }

  val isRunning: Boolean get() = job?.isActive == true
}
