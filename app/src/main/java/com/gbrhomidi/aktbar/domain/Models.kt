package com.gbrhomidi.aktbar.domain

import org.json.JSONArray
import org.json.JSONObject

/** Domain model kept independent from Android views and SQLite cursor details. */
data class Question(
    val id: Long = 0,
    val text: String,
    val correct: String,
    val wrongs: List<String> = emptyList(),
    val category: String = "عام",
    val unit: Int = 1,
    val lesson: Int = 1,
    val difficulty: String = "B",
    val image: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val order: Long = createdAt
) {
    fun options(): List<String> = (wrongs + correct).filter { it.isNotBlank() }.shuffled()
    fun toJson(): JSONObject = JSONObject().apply {
        put("text", text); put("correct", correct); put("wrongs", JSONArray(wrongs))
        put("category", category); put("unit", unit); put("lesson", lesson)
        put("difficulty", difficulty); put("image", image ?: JSONObject.NULL)
    }
}

data class PlayerStats(
    val totalQuestions: Int = 0,
    val totalCategories: Int = 0,
    val totalChallenges: Int = 0,
    val totalTests: Int = 0,
    val perfectScores: Int = 0,
    val totalStars: Int = 0,
    val totalScore: Int = 0,
    val totalCorrect: Int = 0,
    val totalWrong: Int = 0,
    val rounds: Int = 0,
    val bestStreak: Int = 0
)

data class AppSettings(
    val timePerQuestion: Int = 15,
    val questionCount: Int = 10,
    val maxWrong: Int = 3,
    val testDuration: Int = 30,
    val muteSound: Boolean = false,
    val darkMode: Boolean = true,
    val language: String = "ar",
    val theme: String = "blue-gold",
    val deviceName: String = "Android-Device"
)
