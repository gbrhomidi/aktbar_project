package com.gbrhomidi.aktbar.service

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.gbrhomidi.aktbar.data.DatabaseHelper
import java.io.File

class BackupWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result = runCatching {
        val directory = File(applicationContext.filesDir, "backups").apply { mkdirs() }
        val destination = File(directory, "smartlearning_backup_${System.currentTimeMillis()}.json")
        destination.writeText(DatabaseHelper(applicationContext).exportQuestionsJson())
        Result.success()
    }.getOrElse { Result.failure() }
}
