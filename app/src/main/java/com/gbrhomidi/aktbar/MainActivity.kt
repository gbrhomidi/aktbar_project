package com.gbrhomidi.aktbar

import android.Manifest
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import android.content.pm.PackageManager
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewFeature
import androidx.webkit.WebSettingsCompat
import com.gbrhomidi.aktbar.service.BackupWorker
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager

/**
 * The legacy HTML/CSS/JavaScript UI is the product UI. Native Android provides
 * a stable WebView host and platform bridges only; it does not redraw screens.
 */
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var pendingWebPermissionRequest: PermissionRequest? = null

    private val mediaPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        val request = pendingWebPermissionRequest
        pendingWebPermissionRequest = null
        if (request == null) return@registerForActivityResult
        val permitted = request.resources.filter { resource ->
            when (resource) {
                PermissionRequest.RESOURCE_AUDIO_CAPTURE -> grants[Manifest.permission.RECORD_AUDIO] == true || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                PermissionRequest.RESOURCE_VIDEO_CAPTURE -> grants[Manifest.permission.CAMERA] == true || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                else -> false
            }
        }.toTypedArray()
        if (permitted.isNotEmpty() && permitted.size == request.resources.count { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE || it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }) request.grant(permitted) else request.deny()
    }

    private val fileChooser = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uris = if (result.resultCode == RESULT_OK) {
            val data = result.data
            when {
                data?.clipData != null -> Array(data.clipData!!.itemCount) { index -> data.clipData!!.getItemAt(index).uri }
                data?.data != null -> arrayOf(data.data!!)
                else -> null
            }
        } else null
        fileChooserCallback?.onReceiveValue(uris)
        fileChooserCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView = createWebView()
        setContentView(webView)
        configureBackNavigation()
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(APP_URL)
        }
    }

    private fun createWebView(): WebView = WebView(this).apply {
        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        setBackgroundColor(android.graphics.Color.TRANSPARENT)
        overScrollMode = WebView.OVER_SCROLL_NEVER
        isVerticalScrollBarEnabled = false
        isHorizontalScrollBarEnabled = false
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString SmartLearningAndroid/4.0"
            if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
                WebSettingsCompat.setForceDark(this, WebSettingsCompat.FORCE_DARK_OFF)
            }
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
        addJavascriptInterface(NativeBridge(), "AndroidBridge")
        webViewClient = LocalAssetWebViewClient()
        webChromeClient = LegacyWebChromeClient()
        setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            if (url.startsWith("http://") || url.startsWith("https://")) {
                downloadRemoteFile(url, userAgent, contentDisposition, mimeType)
            }
        })
    }

    private inner class LocalAssetWebViewClient : WebViewClientCompat() {
        private val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this@MainActivity))
            .build()

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
            assetLoader.shouldInterceptRequest(request.url)

        override fun shouldInterceptRequest(view: WebView, url: String): WebResourceResponse? =
            assetLoader.shouldInterceptRequest(Uri.parse(url))

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            return if (uri.host == APP_HOST) {
                false
            } else {
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                true
            }
        }
    }

    private inner class LegacyWebChromeClient : WebChromeClient() {
        override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
            fileChooserCallback?.onReceiveValue(null)
            fileChooserCallback = callback
            val intent = runCatching { params.createIntent() }.getOrElse {
                Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                }
            }
            return runCatching { fileChooser.launch(intent); true }.getOrElse {
                fileChooserCallback = null
                false
            }
        }

        override fun onPermissionRequest(request: PermissionRequest) {
            runOnUiThread {
                val mediaResources = request.resources.filter { it == PermissionRequest.RESOURCE_AUDIO_CAPTURE || it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }
                if (mediaResources.isEmpty()) {
                    request.deny()
                    return@runOnUiThread
                }
                val missing = buildList {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in mediaResources && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) add(Manifest.permission.RECORD_AUDIO)
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in mediaResources && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) add(Manifest.permission.CAMERA)
                }
                if (missing.isEmpty()) request.grant(mediaResources.toTypedArray())
                else {
                    pendingWebPermissionRequest?.deny()
                    pendingWebPermissionRequest = request
                    mediaPermissionLauncher.launch(missing.toTypedArray())
                }
            }
        }

        override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
            android.util.Log.d("SmartLearningWebView", "${consoleMessage.message()} @${consoleMessage.lineNumber()}")
            return true
        }
    }

    private fun configureBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    private fun downloadRemoteFile(url: String, userAgent: String, contentDisposition: String, mimeType: String) {
        val request = android.app.DownloadManager.Request(Uri.parse(url)).apply {
            setMimeType(mimeType)
            addRequestHeader("User-Agent", userAgent)
            setTitle(contentDisposition.ifBlank { "smart-learning-download" })
            setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setAllowedOverMetered(true)
            setAllowedOverRoaming(true)
        }
        getSystemService(DOWNLOAD_SERVICE).let { (it as android.app.DownloadManager).enqueue(request) }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.onResume()
            webView.resumeTimers()
        }
    }

    override fun onPause() {
        if (::webView.isInitialized) {
            webView.onPause()
            webView.pauseTimers()
        }
        super.onPause()
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.removeJavascriptInterface("AndroidBridge")
            webView.webChromeClient = null
            webView.webViewClient = WebViewClient()
            webView.destroy()
        }
        super.onDestroy()
    }

    private inner class NativeBridge {
        @JavascriptInterface fun getPlatform(): String = "android-webview-legacy-ui"
        @JavascriptInterface fun getArchitecture(): String = "legacy-html-css-js"

        @JavascriptInterface
        fun saveTextFile(fileName: String, content: String, mimeType: String): Boolean = runCatching {
            val safeName = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "smart-learning-export.json" }
            val resolver = contentResolver
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType.ifBlank { "application/octet-stream" })
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SmartLearning")
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
                resolver.openOutputStream(uri)?.use { it.write(content.toByteArray(StandardCharsets.UTF_8)) }
                values.clear(); values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            } else {
                val directory = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: filesDir
                directory.mkdirs()
                File(directory, safeName).writeText(content, StandardCharsets.UTF_8)
            }
            true
        }.getOrDefault(false)

        @JavascriptInterface
        fun saveDataUrl(fileName: String, dataUrl: String, mimeType: String): Boolean = runCatching {
            val payload = dataUrl.substringAfter("base64,", "")
            val bytes = Base64.decode(payload, Base64.DEFAULT)
            val safeName = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "smart-learning-image.png" }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType.ifBlank { "image/png" })
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SmartLearning")
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
                contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                values.clear(); values.put(MediaStore.Downloads.IS_PENDING, 0)
                contentResolver.update(uri, values, null, null)
            } else {
                val directory = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: filesDir
                directory.mkdirs(); File(directory, safeName).writeBytes(bytes)
            }
            true
        }.getOrDefault(false)
    }

    companion object {
        private const val APP_HOST = "appassets.androidplatform.net"
        private const val APP_URL = "https://$APP_HOST/assets/legacy/index.html"
    }
}
