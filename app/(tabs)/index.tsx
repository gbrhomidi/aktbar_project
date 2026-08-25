import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Camera } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import Slider from "@react-native-community/slider";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  AgentSettings,
  AgentStatus,
  ChannelTestResult,
  DeliveryLogEntry,
  DeviceHealth,
  HardwareTestResult,
  clearAgentSecrets,
  clearDeliveryLog,
  exportDeliveryLog,
  defaultSettings,
  getAgentStatus,
  getDeliveryLog,
  getNativeDeviceHealth,
  hasStoredAgentConfig,
  loadSettings,
  closeAgentUi,
  persistSettings,
  requestBatteryOptimizationExemption,
  runNativeHardwareTest,
  saveAgentConfig,
  startAgent,
  stopAgent,
  testGmailConnection,
  testTelegramConnection,
} from "@/lib/telegram-agent";
import { isTelegramSettingsReady } from "@/lib/agent-protocol";
import { useThemeContext } from "@/lib/theme-provider";

I18nManager.allowRTL(true);

const initialStatus: AgentStatus = {
  running: false,
  phase: "جارٍ التحقق",
  message: "يتم تحميل الحالة المحلية للعامل.",
  updatedAt: "",
  lastError: "",
};

type Section = "overview" | "telegram" | "camera" | "detection" | "alerts" | "history" | "diagnostics" | "terms";

export default function AgentHomeScreen() {
  const { colorScheme, setColorScheme } = useThemeContext();
  const [section, setSection] = useState<Section>("overview");
  const [settings, setSettings] = useState<AgentSettings>(defaultSettings);
  const [status, setStatus] = useState<AgentStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [gmailPasswordVisible, setGmailPasswordVisible] = useState(false);
  const [storedConfigReady, setStoredConfigReady] = useState(false);
  const [telegramTest, setTelegramTest] = useState<ChannelTestResult | null>(null);
  const [gmailTest, setGmailTest] = useState<ChannelTestResult | null>(null);
  const [hardwareTest, setHardwareTest] = useState<HardwareTestResult | null>(null);
  const [deviceHealth, setDeviceHealth] = useState<DeviceHealth | null>(null);
  const [deliveryLog, setDeliveryLog] = useState<DeliveryLogEntry[]>([]);
  const [connectionCheck, setConnectionCheck] = useState<"telegram" | "gmail" | null>(null);
  const [connectionProgress, setConnectionProgress] = useState("");

  const hydrated = useMemo(() => isTelegramSettingsReady(settings.botToken, settings.chatId) || storedConfigReady, [settings.botToken, settings.chatId, storedConfigReady]);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getAgentStatus());
    } catch (error) {
      setStatus((current) => ({ ...current, phase: "خطأ", message: error instanceof Error ? error.message : "تعذر قراءة الحالة." }));
    }
  }, []);

  const refreshDeviceHealth = useCallback(async () => {
    try {
      setDeviceHealth(await getNativeDeviceHealth());
    } catch {
      setDeviceHealth(null);
    }
  }, []);

  const refreshDeliveryHistory = useCallback(async () => {
    try {
      setDeliveryLog(await getDeliveryLog());
    } catch {
      setDeliveryLog([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setSettings(await loadSettings());
      setStoredConfigReady(await hasStoredAgentConfig());
      await refreshStatus();
      await refreshDeviceHealth();
      await refreshDeliveryHistory();
    })();
  }, [refreshDeliveryHistory, refreshDeviceHealth, refreshStatus]);

  const update = <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    const saved = await saveAgentConfig(settings);
    if (saved) setStoredConfigReady(saved.telegramConfigured);
    if (Platform.OS !== "web") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return saved;
  };

  const runTelegramTest = async () => {
    setBusy(true);
    setConnectionCheck("telegram");
    setConnectionProgress("جارٍ حفظ الإعدادات المشفرة والتحقق من Bot Token مع Telegram…");
    setTelegramTest(null);
    try {
      setTelegramTest(await testTelegramConnection(settings));
    } catch (error) {
      setTelegramTest({ ok: false, message: error instanceof Error ? error.message : "فشل اختبار Telegram." });
    } finally {
      setConnectionCheck(null);
      setConnectionProgress("");
      setBusy(false);
    }
  };

  const runGmailTest = async () => {
    setBusy(true);
    setConnectionCheck("gmail");
    setConnectionProgress("جارٍ التحقق من خادم SMTP وبيانات Gmail المشفرة…");
    setGmailTest(null);
    try {
      setGmailTest(await testGmailConnection(settings));
    } catch (error) {
      setGmailTest({ ok: false, message: error instanceof Error ? error.message : "فشل اختبار Gmail." });
    } finally {
      setConnectionCheck(null);
      setConnectionProgress("");
      setBusy(false);
    }
  };

  const runHardwareTest = async () => {
    setBusy(true);
    try {
      setHardwareTest(await runNativeHardwareTest());
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل اختبار العتاد.";
      setHardwareTest({ cameraOk: false, cameraDetail: message, microphoneOk: false, microphoneDetail: message });
    } finally {
      setBusy(false);
    }
  };

  const requestBatteryExemption = async () => {
    try {
      await requestBatteryOptimizationExemption();
      Alert.alert("تحسين البطارية", "افتح صفحة النظام ووافق فقط إذا ظهرت نافذة السماح. لا يستطيع التطبيق تجاوز قرار النظام أو الشركة المصنعة.");
    } catch (error) {
      Alert.alert("تعذر فتح الإعداد", error instanceof Error ? error.message : "تعذر فتح إعداد تحسين البطارية.");
    }
  };

  const closeUi = () => {
    Alert.alert("إغلاق الواجهة", "سيُرسل التطبيق إلى الخلفية فقط. لا يوقف هذا العامل إذا كانت خدمة Android النشطة تعمل.", [
      { text: "إلغاء", style: "cancel" },
      { text: "إرسال للخلفية", onPress: () => { void closeAgentUi(); } },
    ]);
  };

  const clearHistory = () => {
    Alert.alert("مسح سجل الإرسال", "سيُحذف السجل المحلي فقط، ولن تتأثر الأدلة أو إعدادات القنوات.", [
      { text: "إلغاء", style: "cancel" },
      { text: "مسح السجل", style: "destructive", onPress: () => { void (async () => { await clearDeliveryLog(); await refreshDeliveryHistory(); })(); } },
    ]);
  };

  const exportHistory = async () => {
    try {
      const fileName = await exportDeliveryLog();
      Alert.alert("تم تجهيز السجل", `تم إنشاء ${fileName} وفتح خيارات المشاركة.`);
    } catch (error) {
      Alert.alert("تعذر تصدير السجل", error instanceof Error ? error.message : "تصدير السجل متاح داخل APK Android مخصص.");
    }
  };

  const requestPermissions = async () => {
    const [camera, microphone] = await Promise.all([
      Camera.requestCameraPermissionsAsync(),
      Camera.requestMicrophonePermissionsAsync(),
    ]);
    if (Platform.OS !== "web") await Notifications.requestPermissionsAsync();
    if (settings.smsAlertsEnabled && Platform.OS === "android") {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.SEND_SMS);
    }
    if (!camera.granted || !microphone.granted) {
      Alert.alert("صلاحيات مطلوبة", "يحتاج العامل صلاحية الكاميرا والميكروفون لتنفيذ الصورة والفيديو والصوت.");
      return false;
    }
    return true;
  };

  const runStart = async () => {
    if (!hydrated) {
      setSection("telegram");
      Alert.alert("إعداد Telegram ناقص", "أدخل Bot Token وChat ID ثم احفظهما قبل تشغيل العامل.");
      return;
    }
    setBusy(true);
    try {
      if (!(await requestPermissions())) return;
      await save();
      setStatus(await startAgent(settings));
      setStoredConfigReady(true);
      if (Platform.OS !== "web") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر تشغيل العامل.";
      setStatus((current) => ({ ...current, phase: "خطأ", message, lastError: message }));
      Alert.alert("تعذر التشغيل", message);
    } finally {
      setBusy(false);
    }
  };

  const runStop = async () => {
    setBusy(true);
    try {
      setStatus(await stopAgent());
    } catch (error) {
      Alert.alert("تعذر الإيقاف", error instanceof Error ? error.message : "تعذر إيقاف العامل.");
    } finally {
      setBusy(false);
    }
  };

  const forgetSecrets = async () => {
    Alert.alert("حذف بيانات Telegram", "سيُحذف Bot Token المحفوظ على الهاتف ولا يمكن للعامل استقبال أوامر حتى تدخله مجددًا.", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await clearAgentSecrets();
            setSettings((current) => ({ ...current, botToken: "" }));
            setStoredConfigReady(false);
            await persistSettings({ ...settings, botToken: "", gmailAppPassword: "" });
          })();
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      <View style={[styles.root, colorScheme === "light" && styles.rootLight]}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}><MaterialIcons name="security" size={22} color="#B8E7FF" /></View>
            <View>
              <Text style={styles.title}>المراقبة الذكية</Text>
              <Text style={styles.subtitle}>عامل Telegram للمراقبة الذكية</Text>
            </View>
          </View>
          <View style={styles.topActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="تبديل الوضع الفاتح أو المظلم" onPress={() => setColorScheme(colorScheme === "dark" ? "light" : "dark")} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <MaterialIcons name={colorScheme === "dark" ? "light-mode" : "dark-mode"} size={21} color="#DCEFFA" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="إرسال التطبيق إلى الخلفية" onPress={closeUi} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <MaterialIcons name="close" size={22} color="#FFCDD3" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="تحديث الحالة" onPress={() => { void refreshStatus(); void refreshDeviceHealth(); void refreshDeliveryHistory(); }} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <MaterialIcons name="refresh" size={22} color="#DCEFFA" />
            </Pressable>
          </View>
        </View>

        <View style={styles.segmented}>
          {([
            ["overview", "الحالة", "monitor-heart"],
            ["telegram", "Telegram", "send"],
            ["history", "السجل", "history"],
            ["diagnostics", "التشخيص", "fact-check"],
            ["terms", "الشروط", "gavel"],
          ] as const).map(([id, label, icon]) => (
            <Pressable key={id} accessibilityRole="tab" onPress={() => setSection(id)} style={({ pressed }) => [styles.tab, section === id && styles.tabActive, pressed && styles.pressed]}>
              <MaterialIcons name={icon} size={17} color={section === id ? "#071C2C" : "#8BA4B4"} />
              <Text style={[styles.tabText, section === id && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {section === "overview" && <Overview status={status} health={deviceHealth} ready={hydrated} busy={busy} onStart={() => void runStart()} onStop={() => void runStop()} onOpenTelegram={() => setSection("telegram")} />}
          {section === "telegram" && <TelegramSettings settings={settings} update={update} tokenVisible={tokenVisible} setTokenVisible={setTokenVisible} gmailPasswordVisible={gmailPasswordVisible} setGmailPasswordVisible={setGmailPasswordVisible} telegramTest={telegramTest} gmailTest={gmailTest} activeCheck={connectionCheck} progressText={connectionProgress} busy={busy} onSave={() => void save()} onTestTelegram={() => void runTelegramTest()} onTestGmail={() => void runGmailTest()} onForget={forgetSecrets} />}
          {section === "history" && <DeliveryHistory entries={deliveryLog} busy={busy} onRefresh={() => void refreshDeliveryHistory()} onClear={clearHistory} onExport={() => void exportHistory()} />}
          {section === "diagnostics" && <Diagnostics status={status} health={deviceHealth} hardwareTest={hardwareTest} busy={busy} onRefresh={() => { void refreshStatus(); void refreshDeviceHealth(); }} onHardwareTest={() => void runHardwareTest()} onRequestBatteryExemption={() => void requestBatteryExemption()} />}
          {section === "terms" && <TermsAndConditions />}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

function Overview({ status, health, ready, busy, onStart, onStop, onOpenTelegram }: { status: AgentStatus; health: DeviceHealth | null; ready: boolean; busy: boolean; onStart: () => void; onStop: () => void; onOpenTelegram: () => void }) {
  return <>
    <View style={[styles.statusCard, status.running ? styles.statusReady : styles.statusIdle]}>
      <View style={styles.statusIcon}><MaterialIcons name={status.running ? "shield" : "shield"} size={30} color={status.running ? "#55E0B9" : "#FFC776"} /></View>
      <View style={styles.statusCopy}>
        <Text style={styles.statusLabel}>{status.running ? "العامل نشط" : "العامل غير مشغّل"}</Text>
        <Text style={styles.statusMessage}>{status.message}</Text>
      </View>
      <View style={[styles.dot, { backgroundColor: status.running ? "#55E0B9" : "#FFC776" }]} />
    </View>
    <View style={styles.grid}>
      <Metric icon="lock" label="التشغيل" value={status.phase} color="#8EC5FF" />
      <Metric icon="notifications-active" label="الإشعار" value={status.running ? "مستمر" : "غير نشط"} color="#B9A1FF" />
      <Metric icon="camera-alt" label="الكاميرا" value="من خدمة Android" color="#55E0B9" />
      <Metric icon="mic" label="الميكروفون" value="حسب الأمر" color="#FFC776" />
      <Metric icon="battery-full" label="البطارية" value={health?.batteryPercent != null && health.batteryPercent >= 0 ? `${health.batteryPercent}%${health.charging ? " • شحن" : ""}` : "غير متاح"} color={health?.batteryPercent != null && health.batteryPercent <= 15 ? "#FFC776" : "#55E0B9"} />
      <Metric icon="wifi" label="الإنترنت" value={health ? (health.internetReachable ? "متاح" : "غير متاح") : "غير متاح"} color={health?.internetReachable ? "#55E0B9" : "#FFB4BD"} />
    </View>
    {!ready && <View style={styles.warningCard}><MaterialIcons name="key" size={22} color="#FFC776" /><View style={styles.warningCopy}><Text style={styles.warningTitle}>يلزم إعداد Telegram</Text><Text style={styles.warningText}>أدخل token ومعرّف المحادثة قبل بدء خدمة العامل.</Text><Pressable onPress={onOpenTelegram} style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}><Text style={styles.textActionText}>فتح الإعدادات</Text></Pressable></View></View>}
    <View style={styles.actionRow}>
      <PrimaryButton label={busy ? "جارٍ التنفيذ…" : "تشغيل العامل"} icon="play-arrow" disabled={busy} onPress={onStart} />
      <SecondaryButton label="إيقاف" icon="stop" disabled={busy || !status.running} onPress={onStop} />
    </View>
    <View style={styles.noteCard}><MaterialIcons name="info-outline" size={20} color="#8EC5FF" /><Text style={styles.noteText}>تظهر الأزرار والكنفاسات داخل Telegram بعد تشغيل العامل من هذه الواجهة ومنح الصلاحيات. لا يعمل هذا المسار داخل Expo Go أو معاينة الويب.</Text></View>
  </>;
}

function TelegramSettings({ settings, update, tokenVisible, setTokenVisible, gmailPasswordVisible, setGmailPasswordVisible, telegramTest, gmailTest, activeCheck, progressText, busy, onSave, onTestTelegram, onTestGmail, onForget }: { settings: AgentSettings; update: <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => void; tokenVisible: boolean; setTokenVisible: (value: boolean) => void; gmailPasswordVisible: boolean; setGmailPasswordVisible: (value: boolean) => void; telegramTest: ChannelTestResult | null; gmailTest: ChannelTestResult | null; activeCheck: "telegram" | "gmail" | null; progressText: string; busy: boolean; onSave: () => void; onTestTelegram: () => void; onTestGmail: () => void; onForget: () => void }) {
  return <View style={styles.sectionStack}>
    <SectionHeader icon="send" title="إعدادات Telegram وGmail" text="تُحفظ الأسرار في تخزين Android المشفر على الهاتف. لا تُرسل إلى خادم التطبيق أو بيئة الواجهة." />
    <Field label="Bot Token" value={settings.botToken} secure={!tokenVisible} placeholder="123456:ABC…" onChangeText={(value) => update("botToken", value)} trailing={<Pressable onPress={() => setTokenVisible(!tokenVisible)} style={({ pressed }) => [styles.trailingAction, pressed && styles.pressed]}><MaterialIcons name={tokenVisible ? "visibility-off" : "visibility"} size={19} color="#8BA4B4" /></Pressable>} />
    <Field label="Chat ID" value={settings.chatId} placeholder="مثال: 123456789 أو -100…" keyboardType="numbers-and-punctuation" onChangeText={(value) => update("chatId", value)} />
    <Field label="User IDs المصرح بها" value={settings.allowedUserIds} placeholder="افصل المعرفات بفاصلة، أو اتركه فارغًا" keyboardType="numbers-and-punctuation" onChangeText={(value) => update("allowedUserIds", value)} />
    <View style={styles.noteCard}><MaterialIcons name="security" size={20} color="#55E0B9" /><Text style={styles.noteText}>يقتصر العامل على Chat ID المحدد. إذا أدخلت User IDs، فلن ينفذ الأوامر إلا منهم. تدعم المجموعات ذات Chat ID السالب.</Text></View>
    <PrimaryButton label="حفظ الإعدادات" icon="save" onPress={onSave} />
    <SecondaryButton label={activeCheck === "telegram" ? "جارٍ اختبار Telegram…" : "اختبار اتصال Telegram"} icon="cloud-done" disabled={busy} onPress={onTestTelegram} />
    <ConnectionTestStatus active={activeCheck === "telegram"} text={progressText} result={telegramTest} />

    <View style={styles.deliveryDivider} />
    <Text style={styles.groupTitle}>نسخة احتياطية عبر Gmail</Text>
    <ToggleRow label="تفعيل النسخ الاحتياطي" text="لا يحذف العامل الدليل تلقائيًا إلا بعد نجاح Telegram وGmail عند تفعيله." value={settings.gmailBackupEnabled} onChange={(value) => update("gmailBackupEnabled", value)} />
    <Field label="خادم SMTP" value={settings.gmailHost} placeholder="smtp.gmail.com" onChangeText={(value) => update("gmailHost", value)} />
    <Field label="منفذ SMTP" value={String(settings.gmailPort)} placeholder="587 أو 465" keyboardType="number-pad" onChangeText={(value) => update("gmailPort", Number.parseInt(value, 10) || 587)} />
    <Field label="بريد Gmail المرسل" value={settings.gmailUsername} placeholder="name@gmail.com" keyboardType="email-address" onChangeText={(value) => update("gmailUsername", value)} />
    <Field label="كلمة مرور التطبيق" value={settings.gmailAppPassword} secure={!gmailPasswordVisible} placeholder="كلمة تطبيق Gmail" onChangeText={(value) => update("gmailAppPassword", value)} trailing={<Pressable onPress={() => setGmailPasswordVisible(!gmailPasswordVisible)} style={({ pressed }) => [styles.trailingAction, pressed && styles.pressed]}><MaterialIcons name={gmailPasswordVisible ? "visibility-off" : "visibility"} size={19} color="#8BA4B4" /></Pressable>} />
    <Field label="بريد المستلم" value={settings.gmailRecipient} placeholder="backup@example.com" keyboardType="email-address" onChangeText={(value) => update("gmailRecipient", value)} />
    <View style={styles.noteCard}><MaterialIcons name="vpn-key" size={20} color="#FFC776" /><Text style={styles.noteText}>يحتاج Gmail عادةً إلى كلمة مرور تطبيق عند تفعيل المصادقة الثنائية. استخدم 587 لـ STARTTLS أو 465 لـ SSL، ثم اضغط الاختبار قبل تشغيل العامل.</Text></View>
    <SecondaryButton label={activeCheck === "gmail" ? "جارٍ اختبار Gmail…" : "اختبار اتصال Gmail"} icon="alternate-email" disabled={busy || !settings.gmailBackupEnabled} onPress={onTestGmail} />
    <ConnectionTestStatus active={activeCheck === "gmail"} text={progressText} result={gmailTest} />
    <SecondaryButton label="حذف Bot Token المحلي" icon="delete-outline" destructive onPress={onForget} />
  </View>;
}

function AlertSettings({ settings, update, smsTest, busy, onSave, onTestSms }: { settings: AgentSettings; update: <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => void; smsTest: ChannelTestResult | null; busy: boolean; onSave: () => void; onTestSms: () => void }) {
  return <View style={styles.sectionStack}>
    <SectionHeader icon="sms" title="تنبيهات SMS واستمرارية العامل" text="تعمل التنبيهات من خدمة Android الأصلية بعد تفعيل صريح ومنح إذن SEND_SMS. لا يُحفظ رقم التنبيه في التخزين العام للواجهة." />
    <ToggleRow label="تفعيل تنبيهات SMS" text="يظل الإرسال معطلاً حتى تضيف رقمًا وتوافق على إذن Android." value={settings.smsAlertsEnabled} onChange={(value) => update("smsAlertsEnabled", value)} />
    <Field label="رقم تنبيه SMS" value={settings.smsAlertPhone} placeholder="مثال: +9665…" keyboardType="phone-pad" onChangeText={(value) => update("smsAlertPhone", value)} />
    <ToggleRow label="تنبيه عند انقطاع الإنترنت" text="يرسل تنبيهًا واحدًا عند انتقال العامل إلى حالة بلا إنترنت." value={settings.smsOnInternetLoss} onChange={(value) => update("smsOnInternetLoss", value)} />
    <Field label="نص SMS عند انقطاع الإنترنت" value={settings.smsInternetLossMessage} placeholder="اكتب رسالة التنبيه" multiline onChangeText={(value) => update("smsInternetLossMessage", value)} />
    <ToggleRow label={`تنبيه بطارية ${settings.smsBatteryThreshold}%`} text="يراقب الخدمة والفيديو الطويل مع كبح تكرار الرسائل 30 دقيقة." value={settings.smsOnLowBattery} onChange={(value) => update("smsOnLowBattery", value)} />
    <ChoiceRow label="عتبة تنبيه SMS للبطارية" values={[5, 10, 15, 20, 30, 50] as const} selected={settings.smsBatteryThreshold} labelFor={(value) => `${value}%`} onSelect={(value) => update("smsBatteryThreshold", value)} />
    <ChoiceRow label="عتبة حفظ الفيديو الآمن" values={[2, 5, 10, 15, 20] as const} selected={settings.videoSafetyBatteryThreshold} labelFor={(value) => `${value}%`} onSelect={(value) => update("videoSafetyBatteryThreshold", value)} />
    <Field label="نص SMS عند انخفاض البطارية" value={settings.smsLowBatteryMessage} placeholder="اكتب رسالة التنبيه" multiline onChangeText={(value) => update("smsLowBatteryMessage", value)} />
    <View style={styles.noteCard}><MaterialIcons name="data-object" size={20} color="#A78BFA" /><Text style={styles.noteText}>يمكنك كتابة المتغير «battery» بين قوسين معقوفين داخل رسالة البطارية ليضع العامل النسبة الفعلية تلقائيًا. تحفظ عتبة الفيديو النهائية ملف MP4 أولًا ثم تمرره للتحقق والضغط والتسليم.</Text></View>
    <ToggleRow label="استمرارية العامل" text="يعيد Android تشغيل الخدمة فقط عند قتلها من النظام. لا يتجاوز الإيقاف الصريح أو قرار الشركة المصنعة." value={settings.keepServiceAlive} onChange={(value) => update("keepServiceAlive", value)} />
    <View style={styles.noteCard}><MaterialIcons name="info-outline" size={20} color="#8EC5FF" /><Text style={styles.noteText}>رسالة الاختبار تطلب الإذن ثم تحاول الإرسال من الهاتف. تحقق من الشريحة ورصيد الرسائل؛ نجاح الطلب لا يثبت تسليم الشبكة.</Text></View>
    <PrimaryButton label="حفظ إعدادات التنبيه" icon="save" onPress={onSave} />
    <SecondaryButton label={busy ? "جارٍ اختبار SMS…" : "إرسال SMS اختبار"} icon="send" disabled={busy || !settings.smsAlertsEnabled || !settings.smsAlertPhone.trim()} onPress={onTestSms} />
    <TestResult result={smsTest} />
  </View>;
}

function CameraSettings({ settings, update, onSave }: { settings: AgentSettings; update: <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => void; onSave: () => void }) {
  return <View style={styles.sectionStack}>
    <SectionHeader icon="photo-camera" title="الكاميرا والوسائط" text="تطبّق هذه الإعدادات في CameraX عند تشغيل العامل أو عند وصول callback Telegram." />
    <ChoiceRow label="الكاميرا" values={["back", "front"] as const} selected={settings.cameraFacing} labelFor={(v) => v === "back" ? "خلفية" : "أمامية"} onSelect={(v) => update("cameraFacing", v)} />
    <ToggleRow label="ضوء الفلاش" text="يعمل مع الكاميرا الخلفية فقط" value={settings.flashEnabled} onChange={(value) => update("flashEnabled", value)} />
    <ChoiceRow label="جودة الفيديو" values={["sd", "hd", "fhd"] as const} selected={settings.videoQuality} labelFor={(v: "sd" | "hd" | "fhd") => ({ sd: "SD", hd: "HD", fhd: "FHD" })[v]} onSelect={(v) => update("videoQuality", v)} />
    <ChoiceRow label="جودة الصوت" values={["low", "medium", "high"] as const} selected={settings.audioQuality} labelFor={(v: "low" | "medium" | "high") => ({ low: "منخفضة", medium: "متوسطة", high: "عالية" })[v]} onSelect={(v) => update("audioQuality", v)} />
    <ZoomSlider value={settings.zoomRatio} onChange={(value) => update("zoomRatio", value)} />
    <ToggleRow label="ضغط الصور" text="يخفض حجم أدلة الصور قبل الإرسال" value={settings.compressionEnabled} onChange={(value) => update("compressionEnabled", value)} />
    <ToggleRow label="ضغط الفيديو قبل الإرسال" text="يحوّل MP4 محليًا إلى H.264/AAC بدقة أقل، ويرسل الأصل إذا لم ينتج ملف أصغر وصالح." value={settings.videoCompressionEnabled} onChange={(value) => update("videoCompressionEnabled", value)} />
    <ChoiceRow label="دقة ضغط الفيديو المستهدفة" values={[360, 480, 720] as const} selected={settings.videoCompressionHeight} labelFor={(value) => `${value}p`} onSelect={(value) => update("videoCompressionHeight", value)} />
    <ToggleRow label="الحذف التلقائي" text="يحذف الدليل المحلي بعد نجاح Telegram فقط" value={settings.autoDeleteEvidence} onChange={(value) => update("autoDeleteEvidence", value)} />
    <PrimaryButton label="حفظ إعدادات الوسائط" icon="save" onPress={onSave} />
  </View>;
}

function DetectionSettings({ settings, update, onSave }: { settings: AgentSettings; update: <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => void; onSave: () => void }) {
  return <View style={styles.sectionStack}>
    <SectionHeader icon="sensors" title="الكشف والإجراءات" text="يجري كشف الحركة من تحليل صورة الكاميرا وكشف الصوت من مستوى الميكروفون. تُنفذ الأدلة المختارة فقط بعد الرصد." />
    <ToggleRow label="كشف الحركة" text="يشغّل تحليل تغيّر الإضاءة محليًا" value={settings.motionEnabled} onChange={(value) => update("motionEnabled", value)} />
    <ChoiceRow label="حساسية الحركة" values={["low", "medium", "high"] as const} selected={settings.motionSensitivity} labelFor={(v: "low" | "medium" | "high") => ({ low: "منخفضة", medium: "متوسطة", high: "مرتفعة" })[v]} onSelect={(v) => update("motionSensitivity", v)} />
    <View style={styles.actionGroup}><Text style={styles.groupTitle}>عند كشف حركة</Text><ToggleRow label="صورة" value={settings.motionPhoto} onChange={(value) => update("motionPhoto", value)} compact /><ToggleRow label="تسجيل صوت" value={settings.motionAudio} onChange={(value) => update("motionAudio", value)} compact /><ToggleRow label="تسجيل فيديو" value={settings.motionVideo} onChange={(value) => update("motionVideo", value)} compact /></View>
    <ToggleRow label="كشف الصوت" text="يقيس مستوى الإشارة من الميكروفون" value={settings.soundEnabled} onChange={(value) => update("soundEnabled", value)} />
    <ChoiceRow label="حساسية الصوت" values={["low", "medium", "high"] as const} selected={settings.soundSensitivity} labelFor={(v: "low" | "medium" | "high") => ({ low: "منخفضة", medium: "متوسطة", high: "مرتفعة" })[v]} onSelect={(v) => update("soundSensitivity", v)} />
    <View style={styles.actionGroup}><Text style={styles.groupTitle}>عند كشف صوت</Text><ToggleRow label="صورة" value={settings.soundPhoto} onChange={(value) => update("soundPhoto", value)} compact /><ToggleRow label="تسجيل صوت" value={settings.soundAudio} onChange={(value) => update("soundAudio", value)} compact /><ToggleRow label="تسجيل فيديو" value={settings.soundVideo} onChange={(value) => update("soundVideo", value)} compact /></View>
    <ChoiceRow label="مدة فيديو الكشف" values={[15, 30, 60]} selected={settings.detectionVideoDuration} labelFor={(v) => `${v} ثانية`} onSelect={(v) => update("detectionVideoDuration", v)} />
    <ChoiceRow label="مدة صوت الكشف" values={[10, 20, 30]} selected={settings.detectionAudioDuration} labelFor={(v) => `${v} ثانية`} onSelect={(v) => update("detectionAudioDuration", v)} />
    <PrimaryButton label="حفظ إعدادات الكشف" icon="save" onPress={onSave} />
  </View>;
}

function Diagnostics({ status, health, hardwareTest, busy, onRefresh, onHardwareTest, onRequestBatteryExemption }: { status: AgentStatus; health: DeviceHealth | null; hardwareTest: HardwareTestResult | null; busy: boolean; onRefresh: () => void; onHardwareTest: () => void; onRequestBatteryExemption: () => void }) {
  return <View style={styles.sectionStack}>
    <SectionHeader icon="fact-check" title="تشخيص التنفيذ" text="تعكس هذه البطاقة آخر حالة مسجلة من خدمة Android، ولا تضع نتائج افتراضية." />
    <DiagnosticRow label="المرحلة" value={status.phase} />
    <DiagnosticRow label="الرسالة" value={status.message} />
    <DiagnosticRow label="آخر تحديث" value={status.updatedAt || "غير متاح"} />
    <DiagnosticRow label="آخر خطأ" value={status.lastError || "لا يوجد"} error={Boolean(status.lastError)} />
    <DiagnosticRow label="البطارية" value={health?.batteryPercent != null && health.batteryPercent >= 0 ? `${health.batteryPercent}%${health.charging ? " • متصل بالشحن" : ""}` : "غير متاح في المعاينة"} error={Boolean(health?.batteryPercent != null && health.batteryPercent <= 15)} />
    <DiagnosticRow label="الإنترنت" value={health ? (health.internetReachable ? "متاح" : "غير متاح") : "غير متاح في المعاينة"} error={health?.internetReachable === false} />
    <DiagnosticRow label="إذن SMS" value={health?.smsPermissionGranted ? "ممنوح" : "غير ممنوح أو غير متاح"} error={health?.smsPermissionGranted === false} />
    <PrimaryButton label="تحديث الحالة" icon="refresh" onPress={onRefresh} />
    <View style={styles.deliveryDivider} />
    <Text style={styles.groupTitle}>فحص الكاميرا والميكروفون</Text>
    <View style={styles.noteCard}><MaterialIcons name="perm-device-information" size={20} color="#8EC5FF" /><Text style={styles.noteText}>يفحص APK المخصص الكاميرا بالتقاط صورة اختبار تحذف فورًا، ويقرأ عينات PCM فعلية من الميكروفون. أوقف العامل أولًا لتجنب تعارض الكاميرا أو الميكروفون.</Text></View>
    <SecondaryButton label={busy ? "جارٍ الفحص…" : "فحص الكاميرا والميكروفون"} icon="settings-input-component" disabled={busy || status.running} onPress={onHardwareTest} />
    {hardwareTest ? <View style={styles.hardwareResult}><TestResult result={{ ok: hardwareTest.cameraOk, message: hardwareTest.cameraDetail }} /><TestResult result={{ ok: hardwareTest.microphoneOk, message: hardwareTest.microphoneDetail }} /></View> : null}
    <View style={styles.noteCard}><MaterialIcons name="battery-alert" size={20} color="#FFC776" /><Text style={styles.noteText}>يجب أن يبقى الإشعار المستمر ظاهرًا بعد التشغيل. إذا قيّد الهاتف التطبيق، أضف التطبيق إلى الاستثناء من تحسين البطارية من إعدادات النظام.</Text></View>
    <SecondaryButton label="طلب استثناء تحسين البطارية" icon="battery-charging-full" onPress={onRequestBatteryExemption} />
  </View>;
}

function DeliveryHistory({ entries, busy, onRefresh, onClear, onExport }: { entries: DeliveryLogEntry[]; busy: boolean; onRefresh: () => void; onClear: () => void; onExport: () => void }) {
  return <View style={styles.sectionStack}>
    <SectionHeader icon="history" title="سجل الإرسال والتنبيهات" text="يسجل الهاتف محليًا نتائج محاولات SMS ورسائل وملفات Telegram ونسخ Gmail، مع التاريخ وسبب الفشل عند ظهوره." />
    <View style={styles.actionRow}>
      <PrimaryButton label="تحديث السجل" icon="refresh" disabled={busy} onPress={onRefresh} />
      <SecondaryButton label="مسح" icon="delete-outline" disabled={busy || entries.length === 0} destructive onPress={onClear} />
      <SecondaryButton label="تصدير TXT" icon="share" disabled={busy || entries.length === 0} onPress={onExport} />
    </View>
    {entries.length === 0 ? <View style={styles.emptyHistory}><MaterialIcons name="inbox" size={28} color="#75D5FF" /><Text style={styles.emptyHistoryTitle}>لا توجد عمليات مسجلة بعد</Text><Text style={styles.emptyHistoryText}>سيظهر هنا نجاح أو فشل إرسال التنبيهات والأدلة من APK Android المخصص.</Text></View> : entries.map((entry) => <View key={entry.id} style={[styles.historyCard, entry.ok ? styles.historySuccess : styles.historyFailure]}><View style={styles.historyIcon}><MaterialIcons name={entry.ok ? "check" : "priority-high"} size={18} color={entry.ok ? "#39D7A7" : "#FF9EAA"} /></View><View style={styles.historyCopy}><View style={styles.historyTop}><Text style={styles.historyChannel}>{entry.channel} · {entry.kind}</Text><Text style={styles.historyTime}>{entry.timestamp}</Text></View><Text style={styles.historyDetail}>{entry.detail}</Text></View></View>)}
  </View>;
}

function TermsAndConditions() {
  const openContact = (url: string) => {
    void Linking.openURL(url).catch(() => Alert.alert("تعذر فتح الرابط", "تحقق من وجود تطبيق الهاتف أو WhatsApp أو البريد على الجهاز."));
  };
  const updatedDate = new Intl.DateTimeFormat("ar-YE", { year: "numeric", month: "long", day: "numeric" }).format(new Date());

  return <View style={styles.sectionStack}>
    <SectionHeader icon="gavel" title="الشروط والأحكام" text="ملخص تشغيلي مخصص لنظام المراقبة الذكية." />
    <View style={styles.termsCard}><Text style={styles.termsTitle}>الاستخدام المصرح</Text><Text style={styles.termsText}>استخدم العامل على جهاز تملكه أو لديك تفويض صريح لإدارته. لا تستخدم الكاميرا أو الميكروفون أو التنبيهات لمراقبة الآخرين دون موافقتهم أو بخلاف القوانين المحلية.</Text></View>
    <View style={styles.termsCard}><Text style={styles.termsTitle}>الأدلة والبيانات</Text><Text style={styles.termsText}>تُحفظ بيانات Telegram وGmail ورقم SMS داخل تخزين Android مشفّر. مسؤولية حماية الهاتف وبيانات الاعتماد والمحتوى المسجل تقع على مالك الجهاز.</Text></View>
    <View style={styles.termsCard}><Text style={styles.termsTitle}>التنبيهات والاتصال</Text><Text style={styles.termsText}>تعتمد نتائج Telegram وGmail وSMS على الشبكة والشريحة والصلاحيات والخدمات الخارجية. يحد التطبيق من تكرار SMS لكنه لا يضمن التسليم أو استمرار الشبكة.</Text></View>
    <View style={styles.termsCard}><Text style={styles.termsTitle}>الخلفية والطاقة</Text><Text style={styles.termsText}>يستخدم التطبيق إشعار foreground وخيار استثناء تحسين البطارية بطلب منك. قد تفرض الأجهزة أو أنظمة التشغيل قيودًا لا يستطيع التطبيق تجاوزها، ويمنع الإيقاف القسري أي إعادة تشغيل تلقائية.</Text></View>

    <View style={styles.contactCard}>
      <View style={styles.contactHeading}><MaterialIcons name="headset-mic" size={22} color="#8EC5FF" /><Text style={styles.contactTitle}>التواصل والدعم الفني</Text></View>
      <View style={styles.contactPerson}><MaterialIcons name="person" size={19} color="#B8E7FF" /><Text style={styles.contactText}>المهندس <Text style={styles.glowingText}>جبر الحميدي</Text></Text></View>
      <ContactAction icon="phone" label="اتصال هاتفي" caption="اضغــط هنــا" onPress={() => openContact("tel:+967106586714")} style={styles.phoneAction} />
      <ContactAction icon="whatsapp" label="WhatsApp" caption="اضغــط هنــا" onPress={() => openContact("https://wa.me/967781038203")} style={styles.whatsappAction} />
      <ContactAction icon="email" label="البريد الإلكتروني" caption="اضغــط هنــا" onPress={() => openContact("mailto:gbrhomidi@gmail.com")} style={styles.emailAction} />
    </View>
    <View style={styles.termsFooterNote}><MaterialIcons name="info-outline" size={18} color="#FFC776" /><Text style={styles.termsFooterText}>باستمرارك في استخدام النظام، فإنك تؤكد موافقتك الكاملة على هذه الشروط والأحكام.</Text></View>
    <Text style={styles.lastUpdated}>آخر تحديث: {updatedDate}</Text>
  </View>;
}

function ContactAction({ icon, label, caption, onPress, style }: { icon: "phone" | "whatsapp" | "email"; label: string; caption: string; onPress: () => void; style: object }) {
  const materialIcon = icon === "phone" ? "phone" : icon === "email" ? "email" : "chat";
  return <Pressable accessibilityRole="link" accessibilityLabel={`${label}: ${caption}`} onPress={onPress} style={({ pressed }) => [styles.contactAction, style, pressed && styles.pressed]}><MaterialIcons name={materialIcon as React.ComponentProps<typeof MaterialIcons>["name"]} size={18} color="#061522" /><Text style={styles.contactActionLabel}>{label}</Text><Text style={styles.contactActionCaption}>{caption}</Text></Pressable>;
}

function Metric({ icon, label, value, color }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; value: string; color: string }) {
  return <View style={styles.metric}><MaterialIcons name={icon} size={19} color={color} /><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue} numberOfLines={1}>{value}</Text></View>;
}

function SectionHeader({ icon, title, text }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; text: string }) {
  return <View style={styles.sectionHeader}><View style={styles.sectionIcon}><MaterialIcons name={icon} size={22} color="#8EC5FF" /></View><View style={styles.headerCopy}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionText}>{text}</Text></View></View>;
}

function ConnectionTestStatus({ active, text, result }: { active: boolean; text: string; result: ChannelTestResult | null }) {
  if (active) {
    return <View style={styles.testProgress}><ActivityIndicator size="small" color="#8EC5FF" /><View style={styles.progressCopy}><Text style={styles.progressTitle}>جارٍ اختبار الاتصال</Text><Text style={styles.progressText}>{text}</Text></View></View>;
  }
  return <TestResult result={result} />;
}

function TestResult({ result }: { result: ChannelTestResult | null }) {
  if (!result) return null;
  return <View style={[styles.testResult, result.ok ? styles.testSuccess : styles.testFailure]}><MaterialIcons name={result.ok ? "check-circle" : "error-outline"} size={19} color={result.ok ? "#55E0B9" : "#FFB4BD"} /><Text style={[styles.testText, !result.ok && styles.testErrorText]}>{result.message}</Text></View>;
}

function Field({ label, value, placeholder, onChangeText, secure, keyboardType, trailing, multiline = false }: { label: string; value: string; placeholder: string; onChangeText: (value: string) => void; secure?: boolean; keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"]; trailing?: React.ReactNode; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={[styles.inputShell, multiline && styles.inputShellMultiline]}><TextInput style={[styles.input, multiline && styles.inputMultiline]} value={value} placeholder={placeholder} placeholderTextColor="#5F788A" secureTextEntry={secure} autoCapitalize="none" autoCorrect={false} keyboardType={keyboardType} onChangeText={onChangeText} textAlign="left" multiline={multiline} numberOfLines={multiline ? 3 : 1} textAlignVertical={multiline ? "top" : "center"} /><View>{trailing}</View></View></View>;
}

function ToggleRow({ label, text, value, onChange, compact = false }: { label: string; text?: string; value: boolean; onChange: (value: boolean) => void; compact?: boolean }) {
  return <View style={[styles.toggleRow, compact && styles.toggleCompact]}><View style={styles.toggleCopy}><Text style={styles.toggleLabel}>{label}</Text>{text ? <Text style={styles.toggleText}>{text}</Text> : null}</View><Switch value={value} onValueChange={onChange} trackColor={{ false: "#304555", true: "#1F6FA9" }} thumbColor={value ? "#EAF7FF" : "#8BA4B4"} /></View>;
}

function ChoiceRow<T extends string | number>({ label, values, selected, labelFor, onSelect }: { label: string; values: readonly T[]; selected: T; labelFor: (value: T) => string; onSelect: (value: T) => void }) {
  return <View style={styles.choiceBlock}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.choices}>{values.map((value) => <Pressable key={String(value)} onPress={() => onSelect(value)} style={({ pressed }) => [styles.choice, selected === value && styles.choiceActive, pressed && styles.pressed]}><Text style={[styles.choiceText, selected === value && styles.choiceTextActive]}>{labelFor(value)}</Text></Pressable>)}</View></View>;
}

function ZoomSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <View style={styles.zoomBlock}>
    <View style={styles.zoomHeader}><Text style={styles.fieldLabel}>التقريب الحقيقي</Text><Text style={styles.zoomValue}>{value.toFixed(1)}×</Text></View>
    <Slider minimumValue={1} maximumValue={8} step={0.1} value={value} onValueChange={(next) => onChange(Number(next.toFixed(1)))} minimumTrackTintColor="#8EC5FF" maximumTrackTintColor="#294E64" thumbTintColor="#EAF7FF" accessibilityLabel="تقريب الكاميرا" />
    <View style={styles.zoomLabels}><Text style={styles.zoomHint}>1×</Text><Text style={styles.zoomHint}>8×</Text></View>
  </View>;
}

function DiagnosticRow({ label, value, error = false }: { label: string; value: string; error?: boolean }) {
  return <View style={styles.diagnostic}><Text style={styles.diagnosticLabel}>{label}</Text><Text style={[styles.diagnosticValue, error && styles.errorValue]}>{value}</Text></View>;
}

function PrimaryButton({ label, icon, onPress, disabled = false }: { label: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}><MaterialIcons name={icon} size={21} color="#071C2C" /><Text style={styles.primaryText}>{label}</Text></Pressable>;
}

function SecondaryButton({ label, icon, onPress, disabled = false, destructive = false }: { label: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; onPress: () => void; disabled?: boolean; destructive?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, destructive && styles.destructiveButton, disabled && styles.disabled, pressed && styles.pressed]}><MaterialIcons name={icon} size={20} color={destructive ? "#FFB4BD" : "#B8E7FF"} /><Text style={[styles.secondaryText, destructive && styles.destructiveText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09131F" },
  rootLight: { backgroundColor: "#E8F2F8" },
  topBar: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0D1C2C", borderBottomWidth: 1, borderBottomColor: "#1A3650" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  brandIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#123552", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#276083" },
  title: { color: "#F4FAFF", fontSize: 20, fontWeight: "800", writingDirection: "rtl" },
  subtitle: { color: "#9EB8C9", fontSize: 12, marginTop: 2, writingDirection: "rtl" },
  iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#142A3E", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#23465F" },
  segmented: { flexDirection: "row", flexWrap: "wrap", borderBottomWidth: 1, borderColor: "#1A3650", paddingVertical: 9, paddingHorizontal: 10, gap: 6, backgroundColor: "#0B1725" },
  tab: { minWidth: 78, flexGrow: 1, flexBasis: "28%", paddingVertical: 8, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 12 },
  tabActive: { backgroundColor: "#72D4FF" },
  tabText: { color: "#90AABD", fontSize: 10, fontWeight: "700" },
  tabTextActive: { color: "#071825" },
  content: { padding: 18, paddingBottom: 40, gap: 15 },
  statusCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, borderWidth: 1 },
  statusReady: { backgroundColor: "#0E312E", borderColor: "#1D6A5B" },
  statusIdle: { backgroundColor: "#3B2C1D", borderColor: "#6C502C" },
  statusIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: "#071C2C55", alignItems: "center", justifyContent: "center", marginRight: 12 },
  statusCopy: { flex: 1 },
  statusLabel: { color: "#F1F8FC", fontSize: 16, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  statusMessage: { color: "#C9DCE8", fontSize: 12, lineHeight: 18, marginTop: 4, writingDirection: "rtl", textAlign: "right" },
  dot: { width: 10, height: 10, borderRadius: 5, marginLeft: 9 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  metric: { width: "48%", flexGrow: 1, minHeight: 100, backgroundColor: "#112438", borderWidth: 1, borderColor: "#224863", borderRadius: 18, padding: 13, gap: 6 },
  metricLabel: { color: "#8BA4B4", fontSize: 11, writingDirection: "rtl", textAlign: "right" },
  metricValue: { color: "#F1F8FC", fontSize: 13, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  actionRow: { flexDirection: "row", gap: 10 },
  primaryButton: { minHeight: 50, borderRadius: 16, backgroundColor: "#6FD2FF", flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, shadowColor: "#35B8EF", shadowOpacity: 0.24, shadowRadius: 10, elevation: 3 },
  primaryText: { color: "#061522", fontWeight: "900", fontSize: 14 },
  secondaryButton: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: "#2E6A8B", backgroundColor: "#122A40", flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  secondaryText: { color: "#BCEAFF", fontWeight: "800", fontSize: 14 },
  destructiveButton: { borderColor: "#824451" },
  destructiveText: { color: "#FFB4BD" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  warningCard: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 16, backgroundColor: "#3B2C1D", borderWidth: 1, borderColor: "#6C502C" },
  warningCopy: { flex: 1 },
  warningTitle: { color: "#FFE1B1", fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  warningText: { color: "#E7C996", fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  textAction: { alignSelf: "flex-end", marginTop: 8, paddingVertical: 5 },
  textActionText: { color: "#B8E7FF", fontSize: 12, fontWeight: "800" },
  noteCard: { flexDirection: "row", gap: 10, padding: 13, borderRadius: 16, backgroundColor: "#0D263B", borderWidth: 1, borderColor: "#21506C" },
  noteText: { flex: 1, color: "#BBD3E2", fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
  deliveryDivider: { height: 1, backgroundColor: "#214B64", marginVertical: 4 },
  testResult: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: 14, borderWidth: 1 },
  testProgress: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: "#2E627E", backgroundColor: "#0C2D43" },
  progressCopy: { flex: 1, gap: 2 },
  progressTitle: { color: "#DCEFFA", fontSize: 13, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  progressText: { color: "#9DC7DD", fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl" },
  testSuccess: { backgroundColor: "#0E312E", borderColor: "#1D6A5B" },
  testFailure: { backgroundColor: "#3A2028", borderColor: "#824451" },
  testText: { flex: 1, color: "#C7F6E8", fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl" },
  testErrorText: { color: "#FFD2D8" },
  hardwareResult: { gap: 8 },
  termsCard: { gap: 7, padding: 15, borderRadius: 16, backgroundColor: "#102A3B", borderWidth: 1, borderColor: "#1B4159" },
  termsTitle: { color: "#B8E7FF", fontSize: 14, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  termsText: { color: "#D1E2EC", fontSize: 12, lineHeight: 20, writingDirection: "rtl", textAlign: "right" },
  contactCard: { gap: 10, padding: 16, borderRadius: 18, backgroundColor: "#102A3B", borderWidth: 1, borderColor: "#2B617F" },
  contactHeading: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  contactTitle: { color: "#EAF7FF", fontSize: 16, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  contactPerson: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 7 },
  contactText: { color: "#D1E2EC", fontSize: 13, writingDirection: "rtl", textAlign: "right" },
  glowingText: { color: "#72D4FF", fontWeight: "900" },
  contactAction: { minHeight: 48, borderRadius: 14, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  contactActionLabel: { color: "#061522", fontWeight: "900", fontSize: 13 },
  contactActionCaption: { color: "#061522", fontWeight: "800", fontSize: 12 },
  phoneAction: { backgroundColor: "#72D4FF" },
  whatsappAction: { backgroundColor: "#63E6A8" },
  emailAction: { backgroundColor: "#FFC776" },
  termsFooterNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 13, borderRadius: 14, backgroundColor: "#3B2C1D", borderWidth: 1, borderColor: "#6C502C" },
  termsFooterText: { flex: 1, color: "#FFE1B1", fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
  lastUpdated: { color: "#8BA4B4", fontSize: 12, textAlign: "center", writingDirection: "rtl", marginTop: 2 },
  sectionStack: { gap: 13 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 2 },
  sectionIcon: { width: 42, height: 42, backgroundColor: "#102E43", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  sectionTitle: { color: "#F1F8FC", fontSize: 18, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  sectionText: { color: "#8BA4B4", fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  field: { gap: 7 },
  fieldLabel: { color: "#C9DCE8", fontSize: 13, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  inputShell: { minHeight: 52, borderRadius: 15, backgroundColor: "#102A3B", borderWidth: 1, borderColor: "#214B64", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  inputShellMultiline: { alignItems: "flex-start", paddingVertical: 8 },
  input: { flex: 1, color: "#F1F8FC", fontSize: 14, minHeight: 48, writingDirection: "ltr" },
  inputMultiline: { minHeight: 72, writingDirection: "rtl", textAlign: "right", lineHeight: 20 },
  trailingAction: { padding: 6 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#102A3B", borderWidth: 1, borderColor: "#1B4159", paddingHorizontal: 14, paddingVertical: 13, borderRadius: 16 },
  toggleCompact: { backgroundColor: "#0B2232", paddingVertical: 10, borderColor: "#17384E" },
  toggleCopy: { flex: 1, paddingRight: 12 },
  toggleLabel: { color: "#F1F8FC", fontSize: 14, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  toggleText: { color: "#8BA4B4", fontSize: 11, lineHeight: 16, marginTop: 3, writingDirection: "rtl", textAlign: "right" },
  choiceBlock: { gap: 8 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 39, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: "#2A5A74", backgroundColor: "#102A3B", alignItems: "center", justifyContent: "center" },
  choiceActive: { borderColor: "#B8E7FF", backgroundColor: "#1C526E" },
  choiceText: { color: "#AFC7D5", fontSize: 12, fontWeight: "700" },
  choiceTextActive: { color: "#FFFFFF" },
  zoomBlock: { gap: 7, backgroundColor: "#102A3B", borderWidth: 1, borderColor: "#1B4159", borderRadius: 16, padding: 14 },
  zoomHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  zoomValue: { color: "#8EC5FF", fontSize: 16, fontWeight: "900" },
  zoomLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: -3 },
  zoomHint: { color: "#8BA4B4", fontSize: 11 },
  actionGroup: { gap: 8, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "#1B4159", backgroundColor: "#0C2638" },
  groupTitle: { color: "#8EC5FF", fontSize: 13, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginBottom: 2 },
  diagnostic: { gap: 5, padding: 14, borderRadius: 15, backgroundColor: "#102A3B", borderWidth: 1, borderColor: "#1B4159" },
  diagnosticLabel: { color: "#8BA4B4", fontSize: 11, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  diagnosticValue: { color: "#E5F0F6", fontSize: 13, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
  errorValue: { color: "#FFB4BD" },
  emptyHistory: { alignItems: "center", gap: 8, padding: 28, borderRadius: 18, backgroundColor: "#10283C", borderWidth: 1, borderColor: "#21516D" },
  emptyHistoryTitle: { color: "#E5F5FF", fontSize: 15, fontWeight: "900", writingDirection: "rtl" },
  emptyHistoryText: { color: "#9CB7C8", fontSize: 12, lineHeight: 18, textAlign: "center", writingDirection: "rtl" },
  historyCard: { flexDirection: "row", gap: 10, padding: 13, borderRadius: 16, borderWidth: 1 },
  historySuccess: { backgroundColor: "#0D302E", borderColor: "#1E7166" },
  historyFailure: { backgroundColor: "#36232B", borderColor: "#81505D" },
  historyIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#071C2C55", alignItems: "center", justifyContent: "center" },
  historyCopy: { flex: 1, gap: 4 },
  historyTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  historyChannel: { flex: 1, color: "#E6F5FF", fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  historyTime: { color: "#9CB7C8", fontSize: 10 },
  historyDetail: { color: "#C2D9E6", fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl" },
});
