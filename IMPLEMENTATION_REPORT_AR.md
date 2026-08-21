# تقرير الإصدار النهائي Release

## نطاق التسليم

تم اعتماد `assembleRelease` فقط كمسار البناء والتسليم النهائي. لا تُسلّم هذه النسخة أي `assembleDebug` أو ملف Debug APK.

## الإصلاحات المضمنة

يبدأ التطبيق مباشرة من واجهة المشروع القديمة HTML/CSS/JavaScript داخل WebView، مع الحفاظ على تصميم وتنسيق الشاشات القديمة. يستخدم المضيف `WebViewAssetLoader` لتحميل الأصول المحلية، ويدير دورة حياة WebView والرجوع وحفظ الحالة واختيار الملفات والتصدير إلى Downloads وصلاحيات الكاميرا والميكروفون المطلوبة لوظائف WebRTC.

تظل ملفات `index.html` وCSS وJavaScript وlibs وassets الأصلية مطابقة للنسخة المضمنة داخل APK. أُضيف جسر Android اختياري لوظائف حفظ JSON وصور QR، مع الإبقاء على fallback المتصفح عند تشغيل PWA خارج Android.

## Release Build

الأمر الوحيد المستخدم للبناء:

```bash
./gradlew --no-daemon clean assembleRelease
```

الناتج:

```text
app/build/outputs/apk/release/app-release.apk
```

نسخة Release موقّعة بمفتاح Android debug القياسي فقط لغرض الاختبار القابل للتثبيت وإتاحة البناء المتكرر دون تخزين مفتاح إنتاج خاص داخل المستودع. قبل النشر التجاري يجب استبدال ذلك بتوقيع إنتاجي خاص بالمستخدم.

## التحقق

| الفحص | النتيجة |
|---|---|
| `clean assembleRelease` | نجح |
| Release APK | موجود وقابل للتثبيت وموقّع بنظام APK Signature Scheme v2 |
| الواجهة القديمة داخل APK | موجودة في `assets/legacy/index.html` |
| Android bridge | موجود داخل APK |
| Debug APK | لم يتم بناؤه أو تسليمه ضمن مسار الإصدار الحالي |
| GitHub Actions | مضبوط على `clean assembleRelease` ورفع Release APK فقط |

## GitHub

سيتم رفع هذا الإصلاح إلى الفرع:

```text
refactor/android-native-mvvm-hybrid
```

وسيكون Artifact الوحيد باسم `smart-learning-release-apk`، ويحتوي على `app-release.apk` فقط.
