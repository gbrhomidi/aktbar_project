package com.gbrhomidi.aktbar.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkGold = darkColorScheme(primary = Color(0xFFFFD166), secondary = Color(0xFF73D2DE), tertiary = Color(0xFF9B8AFB), background = Color(0xFF0D1420), surface = Color(0xFF172234))
private val LightGold = lightColorScheme(primary = Color(0xFF8A5A00), secondary = Color(0xFF006875), tertiary = Color(0xFF5C4A9B))

@Composable
fun SmartLearningTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) DarkGold else LightGold, content = content)
}
