package com.gbrhomidi.aktbar.ui

import android.annotation.SuppressLint
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.gbrhomidi.aktbar.data.AppContainer
import com.gbrhomidi.aktbar.domain.AppSettings
import com.gbrhomidi.aktbar.domain.Question
import com.gbrhomidi.aktbar.viewmodel.AppViewModelFactory
import com.gbrhomidi.aktbar.viewmodel.HomeViewModel
import com.gbrhomidi.aktbar.viewmodel.NetworkViewModel
import com.gbrhomidi.aktbar.viewmodel.QuestionViewModel
import com.gbrhomidi.aktbar.viewmodel.QuizViewModel
import com.gbrhomidi.aktbar.viewmodel.SettingsViewModel
import com.gbrhomidi.aktbar.viewmodel.LoadState
import com.gbrhomidi.aktbar.ui.theme.SmartLearningTheme

@Composable
fun SmartLearningApp(container: AppContainer) {
    val nav = rememberNavController()
    SmartLearningTheme { AppNavigation(nav, container) }
}

@Composable
private fun AppNavigation(nav: NavHostController, container: AppContainer) {
    val factory = remember(container) { AppViewModelFactory(container) }
    NavHost(navController = nav, startDestination = "home") {
        composable("home") { HomeScreen(nav, factory) }
        composable("manage") { ManageScreen(nav, factory) }
        composable("quiz/{mode}") { QuizScreen(nav, factory, it.arguments?.getString("mode") ?: "challenge") }
        composable("settings") { SettingsScreen(nav, factory) }
        composable("achievements") { AchievementsScreen(nav, factory) }
        composable("network") { NetworkScreen(nav, factory) }
        composable("about") { AboutScreen(nav) }
        composable("legacy") { LegacyWebViewScreen() }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScreenScaffold(title: String, nav: NavHostController, content: @Composable (PaddingValues) -> Unit) {
    Scaffold(topBar = { TopAppBar(title = { Text(title) }, navigationIcon = { IconButton(onClick = { nav.popBackStack() }) { Text("‹", style = MaterialTheme.typography.headlineMedium) } }) }, content = content)
}

@Composable
private fun HomeScreen(nav: NavHostController, factory: AppViewModelFactory) {
    val vm: HomeViewModel = viewModel(factory = factory); val state by vm.state.collectAsStateWithLifecycle()
    ScreenScaffold("المنصة التعليمية الذكية", nav) { pad ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(pad).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item { Text("ابنِ اختبارك، وتحدَّ نفسك", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
            item { Text("تطبيق Native يعمل محليًا مع SQLite وواجهة HTML انتقالية آمنة.", style = MaterialTheme.typography.bodyLarge) }
            item { Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) { StatCard("الأسئلة", state.questionCount.toString(), Modifier.weight(1f)); StatCard("الجولات", state.stats.rounds.toString(), Modifier.weight(1f)); StatCard("الصحيح", state.stats.totalCorrect.toString(), Modifier.weight(1f)) } }
            item { Button(onClick = { nav.navigate("quiz/challenge") }, modifier = Modifier.fillMaxWidth()) { Text("تحدي سريع") } }
            item { OutlinedButton(onClick = { nav.navigate("quiz/test") }, modifier = Modifier.fillMaxWidth()) { Text("اختبر معلوماتك") } }
            item { Text("الوحدات", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
            item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { OutlinedButton(onClick = { nav.navigate("manage") }, modifier = Modifier.weight(1f)) { Text("إدارة الأسئلة") }; OutlinedButton(onClick = { nav.navigate("settings") }, modifier = Modifier.weight(1f)) { Text("الإعدادات") } } }
            item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { OutlinedButton(onClick = { nav.navigate("network") }, modifier = Modifier.weight(1f)) { Text("الشبكة") }; OutlinedButton(onClick = { nav.navigate("legacy") }, modifier = Modifier.weight(1f)) { Text("واجهة HTML القديمة") } } }
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier) { Card(modifier) { Column(Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold); Text(label) } } }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ManageScreen(nav: NavHostController, factory: AppViewModelFactory) {
    val vm: QuestionViewModel = viewModel(factory = factory); val state by vm.state.collectAsStateWithLifecycle(); var text by remember { mutableStateOf("") }; var correct by remember { mutableStateOf("") }; var wrongs by remember { mutableStateOf("") }; var category by remember { mutableStateOf("عام") }
    ScreenScaffold("إدارة الأسئلة", nav) { pad ->
        LazyColumn(Modifier.fillMaxSize().padding(pad).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { Text("إضافة سؤال جديد", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
            item { OutlinedTextField(text, { text = it }, Modifier.fillMaxWidth(), label = { Text("نص السؤال") }) }
            item { OutlinedTextField(correct, { correct = it }, Modifier.fillMaxWidth(), label = { Text("الإجابة الصحيحة") }) }
            item { OutlinedTextField(wrongs, { wrongs = it }, Modifier.fillMaxWidth(), label = { Text("الإجابات الخاطئة، مفصولة بفاصلة") }) }
            item { OutlinedTextField(category, { category = it }, Modifier.fillMaxWidth(), label = { Text("التصنيف") }) }
            item { Button(enabled = text.isNotBlank() && correct.isNotBlank(), onClick = { vm.addQuestion(text, correct, wrongs.split(","), category); text = ""; correct = ""; wrongs = "" }, modifier = Modifier.fillMaxWidth()) { Text("حفظ السؤال") } }
            item { Divider() }
            item { Text("الأسئلة المحفوظة (${state.questions.size})", style = MaterialTheme.typography.titleMedium) }
            if (state.loadState is LoadState.Loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            items(state.questions, key = { it.id }) { q -> QuestionRow(q) { vm.deleteQuestion(q.id) } }
        }
    }
}

@Composable
private fun QuestionRow(q: Question, onDelete: () -> Unit) { Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { Text(q.text, fontWeight = FontWeight.Bold); Text("التصنيف: ${q.category} • ${q.difficulty}"); Text("الصحيح: ${q.correct}"); OutlinedButton(onClick = onDelete) { Text("حذف") } } } }

@Composable
private fun QuizScreen(nav: NavHostController, factory: AppViewModelFactory, mode: String) {
    val vm: QuizViewModel = viewModel(factory = factory); val state by vm.state.collectAsStateWithLifecycle(); LaunchedEffect(Unit) { vm.start(mode) }
    ScreenScaffold(if (mode == "test") "اختبر معلوماتك" else "تحدي سريع", nav) { pad ->
        if (state.completed) Column(Modifier.fillMaxSize().padding(pad).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text("اكتملت الجولة", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold); Text("النتيجة: ${state.score}"); Text("الإجابات الصحيحة: ${state.correct} من ${state.questions.size}"); Button(onClick = { nav.popBackStack() }) { Text("العودة للرئيسية") } }
        else if (state.questions.isEmpty()) Column(Modifier.fillMaxSize().padding(pad).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text("لا توجد أسئلة بعد."); OutlinedButton(onClick = { nav.navigate("manage") }) { Text("إضافة أسئلة") } }
        else { val q = state.questions[state.index]; Column(Modifier.fillMaxSize().padding(pad).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) { Text("السؤال ${state.index + 1} من ${state.questions.size}"); LinearProgressIndicator(progress = { (state.index + 1f) / state.questions.size }, Modifier.fillMaxWidth()); Text(q.text, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold); q.options().forEach { option -> Button(enabled = state.selected == null, onClick = { vm.answer(option) }, modifier = Modifier.fillMaxWidth()) { Text(option) } }; if (state.selected != null) Button(onClick = { vm.next() }, modifier = Modifier.fillMaxWidth()) { Text("التالي") } } }
    }
}

@Composable
private fun SettingsScreen(nav: NavHostController, factory: AppViewModelFactory) { val vm: SettingsViewModel = viewModel(factory = factory); val state by vm.state.collectAsStateWithLifecycle(); var draft by remember(state.settings) { mutableStateOf(state.settings) }; ScreenScaffold("الإعدادات", nav) { pad -> Column(Modifier.fillMaxSize().padding(pad).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) { Text("إعدادات الجلسات المحلية", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold); OutlinedTextField(draft.deviceName, { draft = draft.copy(deviceName = it) }, Modifier.fillMaxWidth(), label = { Text("اسم الجهاز") }); OutlinedTextField(draft.questionCount.toString(), { it.toIntOrNull()?.let { n -> draft = draft.copy(questionCount = n.coerceIn(1, 100)) } }, Modifier.fillMaxWidth(), label = { Text("عدد الأسئلة") }); OutlinedTextField(draft.timePerQuestion.toString(), { it.toIntOrNull()?.let { n -> draft = draft.copy(timePerQuestion = n.coerceIn(5, 60)) } }, Modifier.fillMaxWidth(), label = { Text("الثواني لكل سؤال") }); Button(onClick = { vm.save(draft) }, modifier = Modifier.fillMaxWidth()) { Text(if (state.saved) "تم الحفظ" else "حفظ الإعدادات") }; OutlinedButton(onClick = { nav.navigate("legacy") }, modifier = Modifier.fillMaxWidth()) { Text("فتح الإعدادات المتقدمة في HTML القديم") } } } }

@Composable
private fun AchievementsScreen(nav: NavHostController, factory: AppViewModelFactory) { val vm: HomeViewModel = viewModel(factory = factory); val state by vm.state.collectAsStateWithLifecycle(); ScreenScaffold("الإنجازات والإحصائيات", nav) { pad -> Column(Modifier.fillMaxSize().padding(pad).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { Text("إحصائيات اللاعب", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold); Text("الجولات: ${state.stats.rounds}"); Text("الاختبارات: ${state.stats.totalTests}"); Text("التحديات: ${state.stats.totalChallenges}"); Text("النتيجة الإجمالية: ${state.stats.totalScore}"); Text("أفضل سلسلة: ${state.stats.bestStreak}"); Text("النجوم: ${state.stats.totalStars}") } } }

@Composable
private fun NetworkScreen(nav: NavHostController, factory: AppViewModelFactory) { val vm: NetworkViewModel = viewModel(factory = factory); val state by vm.state.collectAsStateWithLifecycle(); ScreenScaffold("الشبكة والمشاركة", nav) { pad -> Column(Modifier.fillMaxSize().padding(pad).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { Text("إدارة الاتصال بين الأجهزة", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold); Text("الغلاف Native لا ينشئ خادمًا محليًا. يمكن فتح تجربة WebRTC القديمة داخل WebView عند الحاجة."); OutlinedTextField(state.deviceName, vm::rename, Modifier.fillMaxWidth(), label = { Text("اسم الجهاز") }); Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { Button(onClick = { vm.setMode("teacher") }, Modifier.weight(1f)) { Text("وضع الأستاذ") }; OutlinedButton(onClick = { vm.setMode("student") }, Modifier.weight(1f)) { Text("وضع الطالب") } }; Text("الوضع الحالي: ${state.mode ?: "غير محدد"}"); OutlinedButton(onClick = { nav.navigate("legacy") }, Modifier.fillMaxWidth()) { Text("فتح أدوات WebRTC وQR القديمة") } } } }

@Composable
private fun AboutScreen(nav: NavHostController) { ScreenScaffold("عن التطبيق", nav) { pad -> Column(Modifier.fillMaxSize().padding(pad).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { Text("المنصة التعليمية الذكية", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold); Text("إعادة بناء Android Native باستخدام Compose وMVVM وSQLite، مع WebView انتقالي للواجهة HTML الأصلية."); Text("الإصدار 4.0.0-native") } } }

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun LegacyWebViewScreen() { val context = LocalContext.current; AndroidView(modifier = Modifier.fillMaxSize(), factory = { WebView(context).apply { settings.javaScriptEnabled = true; settings.domStorageEnabled = true; settings.allowFileAccess = true; webViewClient = WebViewClient(); addJavascriptInterface(NativeBridge(), "AndroidBridge"); loadUrl("file:///android_asset/legacy/index.html") } }) }

private class NativeBridge {
    @JavascriptInterface fun getPlatform(): String = "android-native"
    @JavascriptInterface fun getArchitecture(): String = "MVVM-SQLite-Hybrid"
}
