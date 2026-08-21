package com.gbrhomidi.aktbar.data

import android.content.Context

class AppContainer(context: Context) {
    private val database = DatabaseHelper(context.applicationContext)
    val questions = QuestionRepository(database)
    val settings = SettingsRepository(database)
    val stats = StatsRepository(database)
    val databaseHelper: DatabaseHelper get() = database
}
