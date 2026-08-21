package com.gbrhomidi.aktbar

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.gbrhomidi.aktbar.data.AppContainer
import com.gbrhomidi.aktbar.service.BackupWorker
import com.gbrhomidi.aktbar.ui.SmartLearningApp
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = AppContainer(applicationContext)
        scheduleBackup()
        setContent { SmartLearningApp(container) }
    }

    private fun scheduleBackup() {
        val request = PeriodicWorkRequestBuilder<BackupWorker>(24, TimeUnit.HOURS).build()
        WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork("smart-learning-backup", ExistingPeriodicWorkPolicy.KEEP, request)
    }
}
