package space.manus.akeer14.mobile.agent.t20260824151421

import android.content.Context
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import com.google.common.collect.ImmutableList
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class VideoCompressionResult(val file: File, val usedCompressedFile: Boolean, val description: String)

object VideoEvidenceCompressor {
  suspend fun compress(context: Context, source: File, height: Int): VideoCompressionResult = withContext(Dispatchers.Main.immediate) {
    val output = File(source.parentFile, "CMPVID_${source.nameWithoutExtension}_${height}p.mp4")
    output.delete()
    suspendCancellableCoroutine { continuation ->
      val edited = EditedMediaItem.Builder(MediaItem.fromUri(source.absolutePath))
        .setEffects(Effects(ImmutableList.of(), ImmutableList.of<Effect>(Presentation.createForHeight(height))))
        .build()
      lateinit var transformer: Transformer
      transformer = Transformer.Builder(context)
        .setVideoMimeType(MimeTypes.VIDEO_H264)
        .setAudioMimeType(MimeTypes.AUDIO_AAC)
        .addListener(object : Transformer.Listener {
          override fun onCompleted(composition: Composition, result: ExportResult) {
            if (!output.exists() || output.length() <= 1024L) {
              continuation.resumeWithException(IllegalStateException("أنتج ضغط الفيديو ملفًا غير صالح."))
            } else if (output.length() < source.length()) {
              continuation.resume(VideoCompressionResult(output, true, "ضُغط الفيديو إلى ${height}p قبل الإرسال."))
            } else {
              output.delete()
              continuation.resume(VideoCompressionResult(source, false, "اكتمل التحويل لكن الملف الأصلي أصغر؛ أُرسل الأصل."))
            }
          }

          override fun onError(composition: Composition, result: ExportResult, exception: ExportException) {
            output.delete()
            continuation.resumeWithException(exception)
          }
        })
        .build()
      continuation.invokeOnCancellation {
        transformer.cancel()
        output.delete()
      }
      transformer.start(edited, output.absolutePath)
    }
  }
}
