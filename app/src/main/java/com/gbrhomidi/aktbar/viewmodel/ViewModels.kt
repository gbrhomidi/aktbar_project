package com.gbrhomidi.aktbar.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.gbrhomidi.aktbar.data.AppContainer
import com.gbrhomidi.aktbar.domain.AppSettings
import com.gbrhomidi.aktbar.domain.PlayerStats
import com.gbrhomidi.aktbar.domain.Question
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed interface LoadState { data object Loading : LoadState; data object Ready : LoadState; data class Error(val message: String) : LoadState }
data class HomeUiState(val loadState: LoadState = LoadState.Loading, val questionCount: Int = 0, val stats: PlayerStats = PlayerStats())
data class QuestionUiState(val loadState: LoadState = LoadState.Loading, val questions: List<Question> = emptyList(), val categories: List<String> = emptyList(), val selectedCategory: String? = null, val message: String? = null)
data class QuizUiState(val loadState: LoadState = LoadState.Loading, val questions: List<Question> = emptyList(), val index: Int = 0, val score: Int = 0, val correct: Int = 0, val completed: Boolean = false, val selected: String? = null)
data class SettingsUiState(val loadState: LoadState = LoadState.Loading, val settings: AppSettings = AppSettings(), val saved: Boolean = false)
data class NetworkUiState(val mode: String? = null, val deviceName: String = "Android-Device", val connectedPeers: Int = 0)

class HomeViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(HomeUiState()); val state: StateFlow<HomeUiState> = _state.asStateFlow()
    init { refresh() }
    fun refresh() { viewModelScope.launch(Dispatchers.IO) { runCatching { HomeUiState(LoadState.Ready, container.questions.count(), container.stats.get()) }.onSuccess { _state.value = it }.onFailure { _state.value = HomeUiState(LoadState.Error(it.message ?: "تعذر تحميل البيانات")) } } }
}

class QuestionViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(QuestionUiState()); val state: StateFlow<QuestionUiState> = _state.asStateFlow()
    init { refresh() }
    fun refresh(category: String? = _state.value.selectedCategory) { viewModelScope.launch(Dispatchers.IO) { runCatching { QuestionUiState(LoadState.Ready, container.questions.observe(category), container.questions.categories(), category) }.onSuccess { _state.value = it }.onFailure { _state.value = QuestionUiState(LoadState.Error(it.message ?: "تعذر تحميل الأسئلة")) } } }
    fun selectCategory(category: String?) = refresh(category)
    fun addQuestion(text: String, correct: String, wrongs: List<String>, category: String) { viewModelScope.launch(Dispatchers.IO) { runCatching { container.questions.add(Question(text = text.trim(), correct = correct.trim(), wrongs = wrongs.map(String::trim).filter(String::isNotBlank), category = category.ifBlank { "عام" })) }.onSuccess { refresh(); _state.value = _state.value.copy(message = "تمت إضافة السؤال") }.onFailure { _state.value = _state.value.copy(message = it.message ?: "فشل الحفظ") } } }
    fun deleteQuestion(id: Long) { viewModelScope.launch(Dispatchers.IO) { runCatching { container.questions.delete(id) }.onSuccess { refresh(); _state.value = _state.value.copy(message = "تم حذف السؤال") } } }
    fun addCategory(name: String) { viewModelScope.launch(Dispatchers.IO) { runCatching { container.questions.addCategory(name) }.onSuccess { refresh(); _state.value = _state.value.copy(message = "تمت إضافة التصنيف") } } }
}

class QuizViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(QuizUiState()); val state: StateFlow<QuizUiState> = _state.asStateFlow()
    fun start(mode: String) { viewModelScope.launch(Dispatchers.IO) { val questions = container.questions.observe().shuffled().take(container.settings.get().questionCount.coerceAtLeast(1)); _state.value = QuizUiState(LoadState.Ready, questions = questions); if (questions.isEmpty()) _state.value = QuizUiState(LoadState.Ready, completed = true) } }
    fun answer(value: String) { val current = _state.value; if (current.completed || current.selected != null || current.questions.isEmpty()) return; val q = current.questions[current.index]; val isCorrect = value == q.correct; val nextIndex = current.index + 1; val nextCorrect = current.correct + if (isCorrect) 1 else 0; val nextScore = current.score + if (isCorrect) 10 else 0; if (nextIndex >= current.questions.size) { viewModelScope.launch(Dispatchers.IO) { container.stats.recordGame("challenge", nextScore, nextCorrect, current.questions.size - nextCorrect, current.questions.size, nextCorrect / 3); _state.value = current.copy(score = nextScore, correct = nextCorrect, selected = value, completed = true) } } else { _state.value = current.copy(score = nextScore, correct = nextCorrect, selected = value) } }
    fun next() { val current = _state.value; if (!current.completed && current.selected != null) _state.value = current.copy(index = current.index + 1, selected = null) }
}

class SettingsViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(SettingsUiState()); val state: StateFlow<SettingsUiState> = _state.asStateFlow()
    init { viewModelScope.launch(Dispatchers.IO) { _state.value = SettingsUiState(LoadState.Ready, container.settings.get()) } }
    fun save(settings: AppSettings) { viewModelScope.launch(Dispatchers.IO) { container.settings.save(settings); _state.value = SettingsUiState(LoadState.Ready, settings, true) } }
}

class NetworkViewModel : ViewModel() {
    private val _state = MutableStateFlow(NetworkUiState()); val state: StateFlow<NetworkUiState> = _state.asStateFlow()
    fun setMode(mode: String) { _state.value = _state.value.copy(mode = mode) }
    fun rename(name: String) { if (name.isNotBlank()) _state.value = _state.value.copy(deviceName = name.trim()) }
}

class AppViewModelFactory(private val container: AppContainer) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST") override fun <T : ViewModel> create(modelClass: Class<T>): T = when {
        modelClass.isAssignableFrom(HomeViewModel::class.java) -> HomeViewModel(container)
        modelClass.isAssignableFrom(QuestionViewModel::class.java) -> QuestionViewModel(container)
        modelClass.isAssignableFrom(QuizViewModel::class.java) -> QuizViewModel(container)
        modelClass.isAssignableFrom(SettingsViewModel::class.java) -> SettingsViewModel(container)
        modelClass.isAssignableFrom(NetworkViewModel::class.java) -> NetworkViewModel()
        else -> error("Unknown ViewModel: ${modelClass.name}")
    } as T
}
