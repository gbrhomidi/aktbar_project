package com.gbrhomidi.aktbar.data

import com.gbrhomidi.aktbar.domain.AppSettings
import com.gbrhomidi.aktbar.domain.Question

class QuestionRepository(private val db: DatabaseHelper) {
    fun observe(category: String? = null): List<Question> = db.getQuestions(category)
    fun categories(): List<String> = db.getCategories()
    fun count(): Int = db.getQuestionCount()
    fun add(question: Question): Long = db.insertQuestion(question)
    fun update(question: Question): Int = db.updateQuestion(question)
    fun delete(id: Long): Int = db.deleteQuestion(id)
    fun addCategory(name: String): Long = db.insertCategory(name)
    fun deleteCategory(name: String): Int = db.deleteCategory(name)
    fun exportJson(): String = db.exportQuestionsJson()
}

class SettingsRepository(private val db: DatabaseHelper) {
    fun get(): AppSettings = db.getSettings()
    fun save(value: AppSettings) = db.saveSettings(value)
}

class StatsRepository(private val db: DatabaseHelper) {
    fun get() = db.getStats()
    fun recordGame(mode: String, score: Int, correct: Int, wrong: Int, total: Int, stars: Int) = db.recordGame(mode, score, correct, wrong, total, stars)
}
