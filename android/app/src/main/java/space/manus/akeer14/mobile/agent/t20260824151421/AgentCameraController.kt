package space.manus.akeer14.mobile.agent.t20260824151421

import android.content.Context
import android.os.Environment
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

class AgentCameraController(
  private val context: Context,
  private val lifecycleOwner: LifecycleOwner,
  private val onMotion: () -> Unit,
) {
  private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private var provider: ProcessCameraProvider? = null
  private var imageCapture: ImageCapture? = null
  private var videoCapture: VideoCapture<Recorder>? = null
  private var activeCamera: Camera? = null
  private var activeRecording: Recording? = null
  private var currentConfig = AgentConfig()

  suspend fun configure(config: AgentConfig) = withContext(Dispatchers.Main.immediate) {
    currentConfig = config
    val cameraProvider = awaitProvider()
    provider = cameraProvider
    val capture = ImageCapture.Builder()
      .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
      .build()
    val recorder = Recorder.Builder()
      .setQualitySelector(qualitySelector(config.videoQuality))
      .build()
    val video = VideoCapture.withOutput(recorder)
    val selector = if (config.cameraFacing == "front") CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA

    cameraProvider.unbindAll()
    val useCases = mutableListOf<androidx.camera.core.UseCase>(capture, video)
    if (config.motionEnabled) {
      val analysis = ImageAnalysis.Builder()
        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        .build()
      analysis.setAnalyzer(analysisExecutor, MotionAnalyzer(config.motionSensitivity, onMotion))
      useCases.add(analysis)
    }
    activeCamera = cameraProvider.bindToLifecycle(lifecycleOwner, selector, *useCases.toTypedArray())
    imageCapture = capture
    videoCapture = video
    applyCameraControls(config)
  }

  suspend fun capturePhoto(): File = withContext(Dispatchers.Main.immediate) {
    val capture = imageCapture ?: error("الكاميرا غير مهيأة بعد. شغّل العامل ومنح الإذن أولاً.")
    val file = evidenceFile(Environment.DIRECTORY_PICTURES, "IMG", ".jpg")
    val options = ImageCapture.OutputFileOptions.Builder(file).build()
    suspendCoroutine { continuation ->
      capture.takePicture(options, ContextCompat.getMainExecutor(context), object : ImageCapture.OnImageSavedCallback {
        override fun onImageSaved(result: ImageCapture.OutputFileResults) {
          if (file.exists() && file.length() > 0L) continuation.resume(file)
          else continuation.resumeWithException(IllegalStateException("أنتجت الكاميرا ملف صورة فارغًا."))
        }

        override fun onError(exception: ImageCaptureException) {
          continuation.resumeWithException(exception)
        }
      })
    }
  }

  suspend fun recordVideo(durationSeconds: Int): File = withContext(Dispatchers.Main.immediate) {
    val capture = videoCapture ?: error("الكاميرا غير مهيأة بعد. شغّل العامل ومنح الإذن أولاً.")
    if (activeRecording != null) error("يوجد تسجيل فيديو نشط بالفعل.")
    val file = evidenceFile(Environment.DIRECTORY_MOVIES, "VID", ".mp4")
    val output = FileOutputOptions.Builder(file).build()
    val pending = capture.output.prepareRecording(context, output).withAudioEnabled()
    suspendCoroutine { continuation ->
      var started = false
      activeRecording = pending.start(ContextCompat.getMainExecutor(context)) { event ->
        when (event) {
          is VideoRecordEvent.Start -> {
            started = true
            android.os.Handler(context.mainLooper).postDelayed({ activeRecording?.stop() }, durationSeconds.coerceIn(5, 300) * 1000L)
          }
          is VideoRecordEvent.Finalize -> {
            activeRecording = null
            if (event.hasError()) {
              continuation.resumeWithException(IllegalStateException("فشل تسجيل الفيديو: ${event.error}"))
            } else if (started && file.exists() && file.length() > 1024L) {
              continuation.resume(file)
            } else {
              continuation.resumeWithException(IllegalStateException("لم ينتج التسجيل ملف فيديو صالحًا."))
            }
          }
        }
      }
    }
  }

  suspend fun stopVideoRecording() = withContext(Dispatchers.Main.immediate) {
    activeRecording?.stop()
  }

  fun release() {
    activeRecording?.stop()
    activeRecording = null
    provider?.unbindAll()
    analysisExecutor.shutdown()
  }

  private fun applyCameraControls(config: AgentConfig) {
    val camera = activeCamera ?: return
    camera.cameraControl.setZoomRatio(config.zoomRatio.coerceIn(1f, 8f))
    val supportsFlash = config.cameraFacing != "front" && camera.cameraInfo.hasFlashUnit()
    camera.cameraControl.enableTorch(supportsFlash && config.flashEnabled)
  }

  private suspend fun awaitProvider(): ProcessCameraProvider = suspendCoroutine { continuation ->
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      try {
        continuation.resume(future.get())
      } catch (error: Exception) {
        continuation.resumeWithException(error)
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun qualitySelector(value: String): QualitySelector {
    val desired = when (value.lowercase()) {
      "fhd", "high", "1080p" -> Quality.FHD
      "sd", "low", "480p" -> Quality.SD
      else -> Quality.HD
    }
    return QualitySelector.fromOrderedList(listOf(desired, Quality.HD, Quality.SD))
  }

  private fun evidenceFile(directory: String, prefix: String, extension: String): File {
    val root = context.getExternalFilesDir(directory) ?: context.filesDir
    if (!root.exists()) root.mkdirs()
    val stamp = SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US).format(Date())
    return File(root, "${prefix}_${stamp}${extension}")
  }
}

private class MotionAnalyzer(sensitivity: String, private val callback: () -> Unit) : ImageAnalysis.Analyzer {
  private val threshold = when (sensitivity.lowercase()) {
    "high" -> 0.06
    "low" -> 0.20
    else -> 0.12
  }
  private var previousAverage = -1.0
  private var lastSampleAt = 0L
  private var lastTriggerAt = 0L

  override fun analyze(image: ImageProxy) {
    try {
      val now = System.currentTimeMillis()
      if (now - lastSampleAt < 750L) return
      lastSampleAt = now
      val plane = image.planes.firstOrNull()?.buffer ?: return
      val sampleStep = 24
      var total = 0L
      var count = 0
      var index = 0
      while (index < plane.limit()) {
        total += plane.get(index).toInt() and 0xFF
        count += 1
        index += sampleStep
      }
      if (count == 0) return
      val average = total.toDouble() / count
      if (previousAverage >= 0 && kotlin.math.abs(average - previousAverage) / 255.0 >= threshold && now - lastTriggerAt > 10_000L) {
        lastTriggerAt = now
        callback()
      }
      previousAverage = average
    } finally {
      image.close()
    }
  }
}
