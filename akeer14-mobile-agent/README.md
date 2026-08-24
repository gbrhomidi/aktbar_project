# Akeer14 — عامل Telegram لنظام Android

يحوّل المشروع هاتف Android مخصصًا إلى **عامل مراقبة محلي** يتلقى أوامر Telegram عبر long polling وينفذ الصور والصوت والفيديو والكشف محليًا، ثم يرسل الأدلة إلى Telegram وإلى Gmail كنسخة احتياطية اختيارية. واجهة الإعداد عربية RTL، بينما تظهر لوحات التشغيل داخل Telegram.

> **مهم:** هذا تطبيق Expo development build مزود بطبقة Android أصلية. لا تصلح معاينة الويب أو Expo Go لاختبار خدمة foreground أو الكاميرا أو الميكروفون أو SMS في الخلفية.

## المزايا

| المجال | الوصف |
|---|---|
| Telegram | Long polling محلي، تحقق Chat ID وUser IDs، لوحات inline keyboard، وأوامر الصور والصوت والفيديو والكشف. |
| الأدلة | طابور واحد ينتظر انتهاء التسجيل وإغلاق الملف واستقرار حجمه قبل التسليم. |
| Gmail | نسخة احتياطية اختيارية عبر SMTP؛ لا يحذف الدليل عند تفعيله قبل نجاح قنوات التسليم المطلوبة. |
| التشخيص | اختبار Telegram وGmail، فحص كاميرا وميكروفون من APK مخصص، وحالة البطارية والاتصال. |
| السلامة | إيقاف الفيديو بصورة آمنة عند أقل من 5% بطارية ثم انتظار Finalize والتحقق والتسليم. |
| الأمان | Bot Token وكلمة مرور Gmail ورقم SMS ونصوص التنبيه تحفظ في `EncryptedSharedPreferences`، لا في Git أو متغيرات الواجهة. |

## المتطلبات

يلزم Node.js وpnpm وAndroid SDK وجهاز Android فعلي أو محاكي. تحتاج الوظائف التشغيلية إلى هاتف يدعم الكاميرا والميكروفون، وإلى شريحة إن كنت ستفعل SMS.

| الأداة | الاستخدام |
|---|---|
| Node.js وpnpm | تثبيت التبعيات وتشغيل الواجهة والاختبارات. |
| Android SDK | تجميع Kotlin وبناء أو تثبيت نسخة Android مخصصة. |
| Telegram Bot | Bot Token وChat ID اللذان يستقبل منهما العامل الأوامر. |
| Gmail اختياري | SMTP وكلمة مرور تطبيق للنسخ الاحتياطي. |

## الاستنساخ والتثبيت

```bash
git clone --branch feat/akeer14-agent-20260824 \
  https://github.com/gbrhomidi/aktbar_project.git
cd aktbar_project/akeer14-mobile-agent
pnpm install
```

لا تنشئ ملفات بيئة تحتوي على Bot Token أو كلمة مرور Gmail. أدخل القيم عبر شاشة التطبيق؛ تحفظ نسخة Android المخصصة القيم محليًا بصورة مشفرة.

## إعداد Android SDK

اضبط SDK في البيئة أو أنشئ ملفًا محليًا غير متتبع:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"

cat > android/local.properties <<'EOF'
sdk.dir=/home/USER/Android/Sdk
EOF
```

استبدل المسار بالمسار الفعلي. لا ترفع `android/local.properties` لأنه خاص بجهاز المطور.

## التشغيل والتجميع

```bash
# واجهة التطوير؛ لا تختبر بها العتاد أو خدمة Android في الويب
pnpm dev

# بناء وتشغيل نسخة تطوير مخصصة على جهاز أو محاكي
npx expo run:android

# التحقق من Kotlin
cd android
ANDROID_HOME="$HOME/Android/Sdk" ./gradlew :app:compileDebugKotlin --console=plain

# APK تجريبي محلي
ANDROID_HOME="$HOME/Android/Sdk" ./gradlew :app:assembleDebug
```

يوجد APK التجريبي تحت `android/app/build/outputs/apk/debug/`. لا يعوض ذلك اختبار هاتف فعلي أو توقيع إصدار إنتاجي.

## الإعداد من الهاتف الثابت

1. افتح تبويب **Telegram**، ثم أدخل Bot Token وChat ID وUser IDs الاختيارية واضغط **حفظ الإعدادات**.
2. اضغط **اختبار اتصال Telegram** وانتظر بطاقة التقدم والنتيجة الصريحة. لا تشغّل العامل قبل معالجة أي فشل.
3. إن رغبت بالنسخ الاحتياطي، فعّل Gmail وأدخل SMTP والبريد وكلمة مرور التطبيق والمستلم ثم اختبر الاتصال.
4. من **التنبيهات**، أضف رقم SMS وفعّل الحالات المطلوبة. تستطيع تخصيص رسالة فقد الإنترنت ورسالة البطارية. اكتب `{battery}` في رسالة البطارية لإدراج النسبة الفعلية.
5. من **التشخيص**، أوقف العامل ثم افحص الكاميرا والميكروفون. يجري الفحص التقاطًا وقراءة فعلية، وليس محاكاة.
6. امنح صلاحيات الكاميرا والميكروفون والإشعارات. لا يطلب `SEND_SMS` إلا عند استخدام تنبيهات SMS.
7. شغّل العامل وتحقق من بقاء إشعار foreground ظاهرًا.

## Gmail وSMS والبطارية

ابدأ Gmail بالقيم `smtp.gmail.com` والمنفذ `587`. قد يتطلب الحساب كلمة مرور تطبيق، خصوصًا عند استخدام المصادقة الثنائية.[1]

تعمل SMS فقط بعد تفعيل الإعداد وإدخال رقم ومنح الإذن. يقيّد العامل تكرار الرسائل، لكن شركة الاتصالات والشريحة والاتصال تحدد التسليم الفعلي. عند البطارية الأقل من **5%** أثناء فيديو، يطلب العامل إيقاف CameraX وينتظر `Finalize` قبل متابعة التحقق والتسليم. لا يضمن ذلك حفظ الدليل إذا انطفأ الهاتف أو قتل النظام العملية قبل اكتمال التسجيل.

يمكن طلب استثناء تحسين البطارية من Android، غير أن النظام أو الشركة المصنعة قد تفرض قيودًا إضافية. تعيد الخدمة sticky التشغيل فقط عند قتلها من النظام، ولا تتجاوز الإيقاف الصريح أو الإيقاف القسري.[2]

## الاختبارات

```bash
pnpm check
pnpm lint
pnpm test

cd android
ANDROID_HOME="$HOME/Android/Sdk" ./gradlew :app:compileDebugKotlin --console=plain
```

تغطي Vitest عقود Telegram وطابور الأدلة وGmail وSMS والبطارية الحرجة. لا يمكنها تأكيد كاميرا الهاتف أو SIM أو حسابات Telegram/Gmail الفعلية؛ اختبر هذه الحالات على الجهاز قبل الاعتماد التشغيلي.

## البنية المهمة

| المسار | الغرض |
|---|---|
| `app/(tabs)/index.tsx` | واجهة RTL والإعدادات والاختبارات والتنبيهات. |
| `lib/telegram-agent.ts` | جسر TypeScript إلى Native Module. |
| `android/.../TelegramAgentService.kt` | خدمة foreground والـlong polling وطابور الأدلة. |
| `android/.../AgentConfigStore.kt` | تخزين Android المشفر لإعدادات Telegram وGmail وSMS. |
| `android/.../AgentCameraController.kt` | CameraX للصور والفيديو والتقريب. |
| `tests/` | اختبارات بروتوكول Telegram وعقود Android. |

## المسؤولية والحدود

استخدم العامل فقط على هاتف تملكه أو لديك تفويض صريح لإدارته، ووفق القانون المحلي. لا يضمن التطبيق استمرار الشبكة أو تسليم Telegram أو Gmail أو SMS، ولا يستطيع تجاوز الإيقاف القسري أو سياسات طاقة الشركة المصنعة.

## المراجع

[1] [Gmail Help — Sign in with app passwords](https://support.google.com/accounts/answer/185833)

[2] [Android Developers — Foreground services](https://developer.android.com/develop/background-work/services/foreground-services)
