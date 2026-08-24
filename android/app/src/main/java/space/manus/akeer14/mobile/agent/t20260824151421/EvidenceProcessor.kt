package space.manus.akeer14.mobile.agent.t20260824151421

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File

data class PreparedEvidence(
  val uploadFile: File,
  val cleanupFiles: List<File>,
)

object EvidenceProcessor {
  suspend fun prepare(file: File, compressImages: Boolean): PreparedEvidence = withContext(Dispatchers.Default) {
    awaitStable(file)
    if (!compressImages || file.extension.lowercase() !in setOf("jpg", "jpeg", "png")) {
      return@withContext PreparedEvidence(file, listOf(file))
    }
    val bitmap = BitmapFactory.decodeFile(file.absolutePath)
      ?: error("Cannot decode evidence image for compression.")
    val compressed = File(file.parentFile, "CMP_${file.nameWithoutExtension}.jpg")
    try {
      compressed.outputStream().use { output ->
        check(bitmap.compress(Bitmap.CompressFormat.JPEG, 78, output)) { "Image compression failed." }
      }
      awaitStable(compressed)
      PreparedEvidence(compressed, listOf(file, compressed))
    } finally {
      bitmap.recycle()
    }
  }

  fun validate(file: File) {
    check(file.exists() && file.isFile) { "Evidence file is missing." }
    val minimum = when (file.extension.lowercase()) {
      "jpg", "jpeg", "png", "m4a", "aac", "mp3", "wav" -> 512L
      "mp4" -> 1024L
      else -> 1L
    }
    check(file.length() > minimum) { "File is too small." }
  }

  suspend fun awaitStable(file: File) = withContext(Dispatchers.IO) {
    var previous = -1L
    repeat(5) {
      validate(file)
      val current = file.length()
      if (current == previous) return@withContext
      previous = current
      delay(200L)
    }
    validate(file)
    check(file.length() == previous) { "File size did not stabilize." }
  }
}
