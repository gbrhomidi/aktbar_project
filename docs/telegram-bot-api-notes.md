# ملاحظات Telegram Bot API

تم اختيار **long polling محليًا على الهاتف** لعامل Android الدائم. يستعمل العامل `deleteWebhook(drop_pending_updates=false)` عند بدء الخدمة، ثم `getUpdates(offset)` مع حفظ آخر `update_id` محليًا. هذا يتوافق مع كون `getUpdates` وwebhook وسيلتين متبادلتين لاستقبال التحديثات؛ لا يعمل `getUpdates` إذا كان webhook صادر ما زال مفعّلًا. [1] [2]

يجب أن يجيب العامل عن كل `callback_query` عبر `answerCallbackQuery`، ثم يتحقق من Chat ID وUser ID قبل تنفيذ أي أمر. تستخدم لوحة Telegram `inline_keyboard` و`callback_data` للأزرار، بينما تستعمل نتائج الأدلة `sendPhoto` أو `sendVideo` أو `sendAudio` حسب امتداد الملف. عند رفع ملف، تستعمل Bot API `multipart/form-data` وتعيد الاستجابة حقلَي `ok` و`description` لتسجيل الفشل بصورة قابلة للتشخيص. [1]

لا ينبغي أن يتجاوز التصميم حدود نقل الوسائط أو المعدلات التشغيلية لـTelegram. يعالج التطبيق أخطاء API كما تعود من الخادم ولا يعلن نجاح الإرسال عند فشل الرفع. وبحسب FAQ، يمكن للبوت إرسال ملفات حتى 50MB في الإعداد القياسي؛ لهذا تطبق الواجهة جودة قابلة للاختيار وضغط صور وحذف اختياري بعد نجاح التسليم. [2]

## References

[1] [Telegram Bot API](https://core.telegram.org/bots/api)

[2] [Telegram Bots FAQ](https://core.telegram.org/bots/faq)
