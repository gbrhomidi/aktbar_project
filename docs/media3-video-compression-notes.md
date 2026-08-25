# ملاحظات ضغط الفيديو عبر Media3 Transformer

يعتمد ضغط الفيديو في عامل Akeer14 على Jetpack Media3 Transformer لتصدير MP4 محليًا باستخدام MediaCodec. يستخدم المعالج تأثير `Presentation.createForHeight` لإخراج H.264/AAC بدقة مستهدفة، ثم يقارن حجم الناتج بالأصل؛ لا يستبدل الدليل إلا إذا كان الناتج صالحًا وأصغر.

ينفذ `Transformer` التصدير بصورة غير متزامنة ويجب استخدامه من خيط تطبيق واحد، بينما يبقى عمل التشفير في الخلفية. عند فشل التصدير أو عدم توفير حجم أصغر، يحتفظ العامل بالملف الأصلي ويرسله بدلًا من الإبلاغ عن ضغط وهمي.

## المرجع

- [Android Developers — Media3 Transformer](https://developer.android.com/media/media3/transformer)
- [Android Developers — Media3 Transformer: getting started](https://developer.android.com/media/media3/transformer/getting-started)
- [Android Developers — Media3 Transformer: transformations](https://developer.android.com/media/media3/transformer/transformations)
