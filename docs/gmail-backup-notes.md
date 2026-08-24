# ملاحظات النسخة الاحتياطية عبر Gmail

يدعم Gmail بروتوكول SMTP القياسي عبر `smtp.gmail.com` مع SSL على المنفذ 465 أو STARTTLS على المنفذ 587. يعتمد التنفيذ الافتراضي في التطبيق STARTTLS عبر 587، مع مصادقة SMTP للمستخدم الذي يدخله مالك الهاتف. [1]

توضح Google أن كلمة مرور التطبيق تتطلب تفعيل التحقق بخطوتين، وأنها رمز من 16 خانة مخصص لتطبيق أو جهاز لا يستعمل "تسجيل الدخول باستخدام Google". تبقى كلمة المرور ضمن `EncryptedSharedPreferences` على الهاتف، ولا تدخل في AsyncStorage أو مصدر المشروع أو أي خادم. [2]

يتيح التطبيق اختبار اتصال SMTP صريحًا قبل تفعيل النسخ الاحتياطية. عند تفعيل النسخ، يرسل العامل الدليل إلى Telegram أولًا، ثم يرسل نسخة Gmail إن نجح تسليم Telegram ولم يوجد خطأ في ملف الدليل؛ لا يحذف الدليل المحلي تلقائيًا إلا بعد نجاح كل قنوات التسليم المفعّلة.

## References

[1] [Gmail IMAP, POP, and SMTP — Google for Developers](https://developers.google.com/workspace/gmail/imap/imap-smtp)

[2] [Sign in with app passwords — Gmail Help](https://support.google.com/mail/answer/185833?hl=en)
