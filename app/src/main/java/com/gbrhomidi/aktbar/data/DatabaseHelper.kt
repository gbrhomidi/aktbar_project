package com.gbrhomidi.aktbar.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.gbrhomidi.aktbar.domain.AppSettings
import com.gbrhomidi.aktbar.domain.PlayerStats
import com.gbrhomidi.aktbar.domain.Question
import org.json.JSONArray

/** The single SQLite boundary. UI and ViewModels never execute SQL directly. */
class DatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE questions (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, correct TEXT NOT NULL, wrongs TEXT NOT NULL, category TEXT NOT NULL, unit INTEGER NOT NULL, lesson INTEGER NOT NULL, difficulty TEXT NOT NULL, image TEXT, created_at INTEGER NOT NULL, sort_order INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE settings (key TEXT PRIMARY KEY, time_per_question INTEGER NOT NULL, question_count INTEGER NOT NULL, max_wrong INTEGER NOT NULL, test_duration INTEGER NOT NULL, mute_sound INTEGER NOT NULL, dark_mode INTEGER NOT NULL, language TEXT NOT NULL, theme TEXT NOT NULL, device_name TEXT NOT NULL)")
        db.execSQL("CREATE TABLE player_stats (id INTEGER PRIMARY KEY CHECK (id = 1), total_questions INTEGER NOT NULL, total_categories INTEGER NOT NULL, total_challenges INTEGER NOT NULL, total_tests INTEGER NOT NULL, perfect_scores INTEGER NOT NULL, total_stars INTEGER NOT NULL, total_score INTEGER NOT NULL, total_correct INTEGER NOT NULL, total_wrong INTEGER NOT NULL, rounds INTEGER NOT NULL, best_streak INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE game_history (id INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT NOT NULL, score INTEGER NOT NULL, correct INTEGER NOT NULL, wrong INTEGER NOT NULL, total INTEGER NOT NULL, stars INTEGER NOT NULL, played_at INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE review_history (id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER NOT NULL, correct INTEGER NOT NULL, mode TEXT NOT NULL, reviewed_at INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE achievements (id TEXT PRIMARY KEY, unlocked_at INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE xp (id INTEGER PRIMARY KEY CHECK (id = 1), total INTEGER NOT NULL, level INTEGER NOT NULL, current_xp INTEGER NOT NULL, updated_at INTEGER NOT NULL)")
        seedDefaults(db)
    }

    private fun seedDefaults(db: SQLiteDatabase) {
        val now = System.currentTimeMillis()
        db.insert("settings", null, ContentValues().apply {
            put("key", "game"); put("time_per_question", 15); put("question_count", 10); put("max_wrong", 3); put("test_duration", 30)
            put("mute_sound", 0); put("dark_mode", 1); put("language", "ar"); put("theme", "blue-gold"); put("device_name", "Android-Device")
        })
        db.insert("player_stats", null, statsValues(PlayerStats()))
        db.insert("xp", null, ContentValues().apply { put("id", 1); put("total", 0); put("level", 1); put("current_xp", 0); put("updated_at", now) })
    }

    private fun statsValues(stats: PlayerStats) = ContentValues().apply {
        put("id", 1); put("total_questions", stats.totalQuestions); put("total_categories", stats.totalCategories)
        put("total_challenges", stats.totalChallenges); put("total_tests", stats.totalTests); put("perfect_scores", stats.perfectScores)
        put("total_stars", stats.totalStars); put("total_score", stats.totalScore); put("total_correct", stats.totalCorrect)
        put("total_wrong", stats.totalWrong); put("rounds", stats.rounds); put("best_streak", stats.bestStreak)
    }

    fun getQuestions(category: String? = null): List<Question> {
        val selection = if (category.isNullOrBlank()) null else "category = ?"
        val args = if (category.isNullOrBlank()) null else arrayOf(category)
        readableDatabase.query("questions", null, selection, args, null, null, "sort_order ASC").use { c ->
            val result = mutableListOf<Question>()
            while (c.moveToNext()) result += c.toQuestion()
            return result
        }
    }

    fun getQuestionCount(): Int = readableDatabase.rawQuery("SELECT COUNT(*) FROM questions", null).use { if (it.moveToFirst()) it.getInt(0) else 0 }
    fun getCategoryCount(): Int = readableDatabase.rawQuery("SELECT COUNT(*) FROM categories", null).use { if (it.moveToFirst()) it.getInt(0) else 0 }
    fun getCategories(): List<String> = readableDatabase.query("categories", arrayOf("name"), null, null, null, null, "name COLLATE NOCASE ASC").use { c -> buildList { while (c.moveToNext()) add(c.getString(0)) } }

    fun insertQuestion(question: Question): Long = writableDatabase.insertOrThrow("questions", null, questionValues(question))
    fun updateQuestion(question: Question): Int = writableDatabase.update("questions", questionValues(question), "id = ?", arrayOf(question.id.toString()))
    fun deleteQuestion(id: Long): Int = writableDatabase.delete("questions", "id = ?", arrayOf(id.toString()))

    fun insertCategory(name: String): Long = writableDatabase.insertWithOnConflict("categories", null, ContentValues().apply { put("name", name.trim()); put("created_at", System.currentTimeMillis()) }, SQLiteDatabase.CONFLICT_IGNORE)
    fun deleteCategory(name: String): Int = writableDatabase.delete("categories", "name = ?", arrayOf(name))

    fun getSettings(): AppSettings = readableDatabase.query("settings", null, "key = ?", arrayOf("game"), null, null, null).use { c ->
        if (!c.moveToFirst()) return AppSettings()
        return AppSettings(c.int("time_per_question"), c.int("question_count"), c.int("max_wrong"), c.int("test_duration"), c.int("mute_sound") == 1, c.int("dark_mode") == 1, c.string("language"), c.string("theme"), c.string("device_name"))
    }

    fun saveSettings(settings: AppSettings) {
        writableDatabase.update("settings", ContentValues().apply {
            put("time_per_question", settings.timePerQuestion); put("question_count", settings.questionCount); put("max_wrong", settings.maxWrong); put("test_duration", settings.testDuration)
            put("mute_sound", if (settings.muteSound) 1 else 0); put("dark_mode", if (settings.darkMode) 1 else 0); put("language", settings.language); put("theme", settings.theme); put("device_name", settings.deviceName)
        }, "key = ?", arrayOf("game"))
    }

    fun getStats(): PlayerStats = readableDatabase.query("player_stats", null, "id = 1", null, null, null, null).use { c ->
        if (!c.moveToFirst()) return PlayerStats()
        return PlayerStats(c.int("total_questions"), c.int("total_categories"), c.int("total_challenges"), c.int("total_tests"), c.int("perfect_scores"), c.int("total_stars"), c.int("total_score"), c.int("total_correct"), c.int("total_wrong"), c.int("rounds"), c.int("best_streak"))
    }

    fun recordGame(mode: String, score: Int, correct: Int, wrong: Int, total: Int, stars: Int) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.insert("game_history", null, ContentValues().apply { put("mode", mode); put("score", score); put("correct", correct); put("wrong", wrong); put("total", total); put("stars", stars); put("played_at", System.currentTimeMillis()) })
            val old = getStats()
            val updated = old.copy(totalQuestions = old.totalQuestions + total, totalChallenges = old.totalChallenges + if (mode == "challenge") 1 else 0, totalTests = old.totalTests + if (mode == "test") 1 else 0, perfectScores = old.perfectScores + if (correct == total && total > 0) 1 else 0, totalStars = old.totalStars + stars, totalScore = old.totalScore + score, totalCorrect = old.totalCorrect + correct, totalWrong = old.totalWrong + wrong, rounds = old.rounds + 1)
            db.update("player_stats", statsValues(updated), "id = 1", null)
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }

    fun exportQuestionsJson(): String {
        val array = JSONArray()
        getQuestions().forEach { array.put(it.toJson()) }
        return "{\"version\":4,\"exportedAt\":${System.currentTimeMillis()},\"count\":${array.length()},\"questions\":$array}"
    }

    private fun questionValues(q: Question) = ContentValues().apply {
        put("text", q.text); put("correct", q.correct); put("wrongs", JSONArray(q.wrongs).toString()); put("category", q.category); put("unit", q.unit); put("lesson", q.lesson); put("difficulty", q.difficulty); put("image", q.image); put("created_at", q.createdAt); put("sort_order", q.order)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 1) onCreate(db)
    }

    private fun android.database.Cursor.toQuestion() = Question(long("id"), string("text"), string("correct"), runCatching { val a = JSONArray(string("wrongs")); List(a.length()) { i -> a.getString(i) } }.getOrDefault(emptyList()), string("category"), int("unit"), int("lesson"), string("difficulty"), string("image"), long("created_at"), long("sort_order"))
    private fun android.database.Cursor.string(name: String) = getString(getColumnIndexOrThrow(name))
    private fun android.database.Cursor.int(name: String) = getInt(getColumnIndexOrThrow(name))
    private fun android.database.Cursor.long(name: String) = getLong(getColumnIndexOrThrow(name))

    companion object { private const val DATABASE_NAME = "smart_learning.db"; private const val DATABASE_VERSION = 1 }
}
