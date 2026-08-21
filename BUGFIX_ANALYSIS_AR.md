# تحليل مشكلة تشغيل نسخة Android

## السبب الجذري

كان `MainActivity` يهيئ `SmartLearningApp(container)` ويبدأ من واجهة Compose Native. أما الواجهة القديمة الكاملة فكانت مخفية خلف destination باسم `legacy` ولا تُفتح إلا بعد اختيار مسار منفصل. لذلك لم تكن النسخة المثبتة تعرض تصميم المشروع الأصلي.

## مخاطر WebView الحالية

كان WebView يُنشأ بإعدادات محدودة جدًا: تفعيل JavaScript وDOM Storage فقط، ثم تحميل `file:///android_asset/legacy/index.html` من داخل Composable. لم تكن هناك إدارة لدورة حياة WebView أو زر الرجوع، ولا دعم موحد لاختيار ملفات الاستيراد أو تنزيل ملفات التصدير، ولا حماية واضحة للأصل المحلي. كما أن إبقاء Compose كمسار التشغيل الأساسي جعل سلوك PWA القديم غير ممثل في التطبيق.

## خطة الإصلاح

سيصبح WebView هو الواجهة الوحيدة الافتراضية، مع الحفاظ على HTML وCSS وJavaScript والأصول القديمة كما هي. سيُستخدم `WebViewAssetLoader` لعرض الأصول من أصل محلي آمن بدل الاعتماد المباشر على `file://`، مع تفعيل DOM Storage وIndexedDB وMedia Playback وWebView database/file settings اللازمة للتطبيق القديم. ستُضاف إدارة back navigation وstate restoration وfile chooser وdownload bridge، مع الاحتفاظ بنسخة احتياطية من الحالة قبل تدمير Activity.

لن يُعاد تصميم الشاشات بCompose. ستبقى طبقات SQLite وViewModel وWorker وService في المشروع كدعم Native، لكن تجربة المستخدم الأساسية ستكون مطابقة للواجهة القديمة بنسبة كاملة.
