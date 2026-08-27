import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Camera } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
import type { ColorScheme } from "@/constants/theme";
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
type AgentStyles = ReturnType<typeof createAgentStyles>;
const TERMS_ACCEPTANCE_STORAGE_KEY = "akeer14.agent.terms-acceptance.v1";

const AgentStylesContext = createContext<AgentStyles | null>(null);

function useAgentStyles(): AgentStyles {
  const styles = useContext(AgentStylesContext);
  if (!styles) throw new Error("Agent styles must be available inside the main screen.");
  return styles;
}

export default function AgentHomeScreen() {
  const { colorScheme, setColorScheme } = useThemeContext();
  const styles = useMemo(() => createAgentStyles(colorScheme), [colorScheme]);
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
    <AgentStylesContext.Provider value={styles}>
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
    </AgentStylesContext.Provider>
  );
}

function Overview({ status, health, ready, busy, onStart, onStop, onOpenTelegram }: { status: AgentStatus; health: DeviceHealth | null; ready: boolean; busy: boolean; onStart: () => void; onStop: () => void; onOpenTelegram: () => void }) {
  const styles = useAgentStyles();
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
  const styles = useAgentStyles();
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

function Diagnostics({ status, health, hardwareTest, busy, onRefresh, onHardwareTest, onRequestBatteryExemption }: { status: AgentStatus; health: DeviceHealth | null; hardwareTest: HardwareTestResult | null; busy: boolean; onRefresh: () => void; onHardwareTest: () => void; onRequestBatteryExemption: () => void }) {
  const styles = useAgentStyles();
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
  const styles = useAgentStyles();
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
  const styles = useAgentStyles();
  const openContact = (url: string) => {
    void Linking.openURL(url).catch(() => Alert.alert("تعذر فتح الرابط", "تحقق من وجود تطبيق الهاتف أو WhatsApp أو البريد على الجهاز."));
  };
  const updatedDate = new Intl.DateTimeFormat("ar-YE", { year: "numeric", month: "long", day: "numeric" }).format(new Date());
  const [expandedSection, setExpandedSection] = useState<string | null>("authorized-use");
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(TERMS_ACCEPTANCE_STORAGE_KEY)
      .then((value) => { if (mounted && value) setAcceptedAt(value); })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  const acceptTerms = () => {
    const timestamp = new Date().toISOString();
    setAcceptedAt(timestamp);
    void AsyncStorage.setItem(TERMS_ACCEPTANCE_STORAGE_KEY, timestamp).catch(() => {
      setAcceptedAt(null);
      Alert.alert("تعذر حفظ الموافقة", "حاول مرة أخرى بعد التحقق من مساحة تخزين التطبيق.");
    });
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const terms = [
    { id: "authorized-use", icon: "verified-user", title: "الاستخدام المصرح", text: "استخدم العامل على جهاز تملكه أو لديك تفويض صريح لإدارته. لا تستخدم الكاميرا أو الميكروفون أو التنبيهات لمراقبة الآخرين دون موافقتهم أو بخلاف القوانين المحلية." },
    { id: "evidence-data", icon: "lock", title: "الأدلة والبيانات", text: "تُحفظ بيانات Telegram وGmail ورقم SMS داخل تخزين Android مشفّر. مسؤولية حماية الهاتف وبيانات الاعتماد والمحتوى المسجل تقع على مالك الجهاز." },
    { id: "alerts-network", icon: "wifi", title: "التنبيهات والاتصال", text: "تعتمد نتائج Telegram وGmail وSMS على الشبكة والشريحة والصلاحيات والخدمات الخارجية. يحد التطبيق من تكرار SMS لكنه لا يضمن التسليم أو استمرار الشبكة." },
    { id: "background-power", icon: "battery-charging-full", title: "الخلفية والطاقة", text: "يستخدم التطبيق إشعار foreground وخيار استثناء تحسين البطارية بطلب منك. قد تفرض الأجهزة أو أنظمة التشغيل قيودًا لا يستطيع التطبيق تجاوزها، ويمنع الإيقاف القسري أي إعادة تشغيل تلقائية." },
  ] as const;

  return <View style={styles.sectionStack}>
    <SectionHeader icon="gavel" title="الشروط والأحكام" text="ملخص تشغيلي مخصص لنظام المراقبة الذكية." />
    <Text style={styles.termsHint}>اضغط على أي بند لعرض التفاصيل أو إخفائها.</Text>
    {terms.map((term) => <TermsDisclosure key={term.id} {...term} expanded={expandedSection === term.id} onPress={() => setExpandedSection((current) => current === term.id ? null : term.id)} />)}

    <View style={styles.contactCard}>
      <View style={styles.contactHeading}><MaterialIcons name="headset-mic" size={22} color="#8EC5FF" /><Text style={styles.contactTitle}>التواصل والدعم الفني</Text></View>
      <View style={styles.contactPerson}><MaterialIcons name="person" size={19} color="#B8E7FF" /><Text style={styles.contactText}>المهندس <Text style={styles.glowingText}>جبر الحميدي</Text></Text></View>
      <ContactAction icon="phone" label="اتصال هاتفي" caption="اضغــط هنــا" onPress={() => openContact("tel:+967106586714")} style={styles.phoneAction} />
      <ContactAction icon="whatsapp" label="WhatsApp" caption="اضغــط هنــا" onPress={() => openContact("https://wa.me/967781038203")} style={styles.whatsappAction} />
      <ContactAction icon="email" label="البريد الإلكتروني" caption="اضغــط هنــا" onPress={() => openContact("mailto:gbrhomidi@gmail.com")} style={styles.emailAction} />
    </View>
    <View style={styles.termsFooterNote}><MaterialIcons name="info-outline" size={18} color="#FFC776" /><Text style={styles.termsFooterText}>باستمرارك في استخدام النظام، فإنك تؤكد موافقتك الكاملة على هذه الشروط والأحكام.</Text></View>
    {acceptedAt ? <View style={styles.termsConsentStatus}><MaterialIcons name="verified" size={20} color="#16826A" /><View style={styles.termsConsentCopy}><Text style={styles.termsConsentTitle}>تم تسجيل موافقتك على جميع الشروط</Text><Text style={styles.termsConsentText}>حُفظت الموافقة محليًا على هذا الجهاز.</Text></View></View> : <Pressable accessibilityRole="button" accessibilityLabel="موافق على جميع الشروط" onPress={acceptTerms} style={({ pressed }) => [styles.termsConsentButton, pressed && styles.pressed]}><MaterialIcons name="check-circle" size={21} color="#FFFFFF" /><Text style={styles.termsConsentButtonText}>موافق على جميع الشروط</Text></Pressable>}
    <Text style={styles.lastUpdated}>آخر تحديث: {updatedDate}</Text>
  </View>;
}

function TermsDisclosure({ icon, title, text, expanded, onPress }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; text: string; expanded: boolean; onPress: () => void }) {
  const styles = useAgentStyles();
  return <View style={[styles.termsDisclosure, expanded && styles.termsDisclosureExpanded]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}`} accessibilityState={{ expanded }} onPress={onPress} style={({ pressed }) => [styles.termsDisclosureHeader, pressed && styles.pressed]}>
      <MaterialIcons name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color="#8EC5FF" />
      <View style={styles.termsDisclosureCopy}><Text style={styles.termsTitle}>{title}</Text><Text style={styles.termsDisclosureAction}>{expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}</Text></View>
      <View style={styles.termsDisclosureIcon}><MaterialIcons name={icon} size={19} color="#8EC5FF" /></View>
    </Pressable>
    {expanded ? <View style={styles.termsDisclosureBody}><Text style={styles.termsText}>{text}</Text></View> : null}
  </View>;
}

function ContactAction({ icon, label, caption, onPress, style }: { icon: "phone" | "whatsapp" | "email"; label: string; caption: string; onPress: () => void; style: object }) {
  const styles = useAgentStyles();
  const materialIcon = icon === "phone" ? "phone" : icon === "email" ? "email" : "chat";
  return <Pressable accessibilityRole="link" accessibilityLabel={`${label}: ${caption}`} onPress={onPress} style={({ pressed }) => [styles.contactAction, style, pressed && styles.pressed]}><MaterialIcons name={materialIcon as React.ComponentProps<typeof MaterialIcons>["name"]} size={18} color="#061522" /><Text style={styles.contactActionLabel}>{label}</Text><Text style={styles.contactActionCaption}>{caption}</Text></Pressable>;
}

function Metric({ icon, label, value, color }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; value: string; color: string }) {
  const styles = useAgentStyles();
  return <View style={styles.metric}><MaterialIcons name={icon} size={19} color={color} /><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue} numberOfLines={1}>{value}</Text></View>;
}

function SectionHeader({ icon, title, text }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; text: string }) {
  const styles = useAgentStyles();
  return <View style={styles.sectionHeader}><View style={styles.sectionIcon}><MaterialIcons name={icon} size={22} color="#8EC5FF" /></View><View style={styles.headerCopy}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionText}>{text}</Text></View></View>;
}

function ConnectionTestStatus({ active, text, result }: { active: boolean; text: string; result: ChannelTestResult | null }) {
  const styles = useAgentStyles();
  if (active) {
    return <View style={styles.testProgress}><ActivityIndicator size="small" color="#8EC5FF" /><View style={styles.progressCopy}><Text style={styles.progressTitle}>جارٍ اختبار الاتصال</Text><Text style={styles.progressText}>{text}</Text></View></View>;
  }
  return <TestResult result={result} />;
}

function TestResult({ result }: { result: ChannelTestResult | null }) {
  const styles = useAgentStyles();
  if (!result) return null;
  return <View style={[styles.testResult, result.ok ? styles.testSuccess : styles.testFailure]}><MaterialIcons name={result.ok ? "check-circle" : "error-outline"} size={19} color={result.ok ? "#55E0B9" : "#FFB4BD"} /><Text style={[styles.testText, !result.ok && styles.testErrorText]}>{result.message}</Text></View>;
}

function Field({ label, value, placeholder, onChangeText, secure, keyboardType, trailing, multiline = false }: { label: string; value: string; placeholder: string; onChangeText: (value: string) => void; secure?: boolean; keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"]; trailing?: React.ReactNode; multiline?: boolean }) {
  const styles = useAgentStyles();
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={[styles.inputShell, multiline && styles.inputShellMultiline]}><TextInput style={[styles.input, multiline && styles.inputMultiline]} value={value} placeholder={placeholder} placeholderTextColor="#5F788A" secureTextEntry={secure} autoCapitalize="none" autoCorrect={false} keyboardType={keyboardType} onChangeText={onChangeText} textAlign="left" multiline={multiline} numberOfLines={multiline ? 3 : 1} textAlignVertical={multiline ? "top" : "center"} /><View>{trailing}</View></View></View>;
}

function ToggleRow({ label, text, value, onChange, compact = false }: { label: string; text?: string; value: boolean; onChange: (value: boolean) => void; compact?: boolean }) {
  const styles = useAgentStyles();
  return <View style={[styles.toggleRow, compact && styles.toggleCompact]}><View style={styles.toggleCopy}><Text style={styles.toggleLabel}>{label}</Text>{text ? <Text style={styles.toggleText}>{text}</Text> : null}</View><Switch value={value} onValueChange={onChange} trackColor={{ false: "#304555", true: "#1F6FA9" }} thumbColor={value ? "#EAF7FF" : "#8BA4B4"} /></View>;
}

function DiagnosticRow({ label, value, error = false }: { label: string; value: string; error?: boolean }) {
  const styles = useAgentStyles();
  return <View style={styles.diagnostic}><Text style={styles.diagnosticLabel}>{label}</Text><Text style={[styles.diagnosticValue, error && styles.errorValue]}>{value}</Text></View>;
}

function PrimaryButton({ label, icon, onPress, disabled = false }: { label: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; onPress: () => void; disabled?: boolean }) {
  const styles = useAgentStyles();
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}><MaterialIcons name={icon} size={21} color="#071C2C" /><Text style={styles.primaryText}>{label}</Text></Pressable>;
}

function SecondaryButton({ label, icon, onPress, disabled = false, destructive = false }: { label: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; onPress: () => void; disabled?: boolean; destructive?: boolean }) {
  const styles = useAgentStyles();
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, destructive && styles.destructiveButton, disabled && styles.disabled, pressed && styles.pressed]}><MaterialIcons name={icon} size={20} color={destructive ? "#FFB4BD" : "#B8E7FF"} /><Text style={[styles.secondaryText, destructive && styles.destructiveText]}>{label}</Text></Pressable>;
}

function createAgentStyles(scheme: ColorScheme) {
  const light = scheme === "light";
  const palette = light
    ? {
        canvas: "#F5F8FC", chrome: "#FFFFFF", chromeAlt: "#EEF5F9", card: "#FFFFFF", cardAlt: "#EFF6FA",
        border: "#C9DCE8", borderStrong: "#A9CCDE", text: "#0B2435", textSoft: "#587080", textMuted: "#47687B",
        accent: "#1F6FA9", accentSoft: "#DCEFFC", onAccent: "#FFFFFF", info: "#EAF6FD", success: "#E4F7F1",
        successBorder: "#8BCFBE", warning: "#FFF3DD", warningBorder: "#E4C688", danger: "#FCEBED", dangerBorder: "#E5A5AD",
      }
    : {
        canvas: "#09131F", chrome: "#0D1C2C", chromeAlt: "#0B1725", card: "#102A3B", cardAlt: "#0D263B",
        border: "#1B4159", borderStrong: "#2B617F", text: "#F1F8FC", textSoft: "#8BA4B4", textMuted: "#BBD3E2",
        accent: "#72D4FF", accentSoft: "#143B53", onAccent: "#071825", info: "#0C2D43", success: "#0E312E",
        successBorder: "#1D6A5B", warning: "#3B2C1D", warningBorder: "#6C502C", danger: "#3A2028", dangerBorder: "#824451",
      };
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  rootLight: {},
  topBar: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: palette.chrome, borderBottomWidth: 1, borderBottomColor: palette.border },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  brandIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.accentSoft, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.borderStrong },
  title: { color: palette.text, fontSize: 20, fontWeight: "800", writingDirection: "rtl" },
  subtitle: { color: palette.textSoft, fontSize: 12, marginTop: 2, writingDirection: "rtl" },
  iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.cardAlt, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.border },
  segmented: { flexDirection: "row", flexWrap: "wrap", borderBottomWidth: 1, borderColor: palette.border, paddingVertical: 9, paddingHorizontal: 10, gap: 6, backgroundColor: palette.chromeAlt },
  tab: { minWidth: 78, flexGrow: 1, flexBasis: "28%", paddingVertical: 8, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 12 },
  tabActive: { backgroundColor: palette.accent },
  tabText: { color: palette.textSoft, fontSize: 10, fontWeight: "700" },
  tabTextActive: { color: palette.onAccent },
  content: { padding: 18, paddingBottom: 40, gap: 15 },
  statusCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, borderWidth: 1 },
  statusReady: { backgroundColor: palette.success, borderColor: palette.successBorder },
  statusIdle: { backgroundColor: palette.warning, borderColor: palette.warningBorder },
  statusIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: "#071C2C55", alignItems: "center", justifyContent: "center", marginRight: 12 },
  statusCopy: { flex: 1 },
  statusLabel: { color: palette.text, fontSize: 16, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  statusMessage: { color: palette.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4, writingDirection: "rtl", textAlign: "right" },
  dot: { width: 10, height: 10, borderRadius: 5, marginLeft: 9 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  metric: { width: "48%", flexGrow: 1, minHeight: 100, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 13, gap: 6 },
  metricLabel: { color: palette.textSoft, fontSize: 11, writingDirection: "rtl", textAlign: "right" },
  metricValue: { color: palette.text, fontSize: 13, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  actionRow: { flexDirection: "row", gap: 10 },
  primaryButton: { minHeight: 50, borderRadius: 16, backgroundColor: palette.accent, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, shadowColor: palette.accent, shadowOpacity: 0.24, shadowRadius: 10, elevation: 3 },
  primaryText: { color: palette.onAccent, fontWeight: "900", fontSize: 14 },
  secondaryButton: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: palette.borderStrong, backgroundColor: palette.card, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  secondaryText: { color: palette.accent, fontWeight: "800", fontSize: 14 },
  destructiveButton: { borderColor: "#824451" },
  destructiveText: { color: "#FFB4BD" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  warningCard: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 16, backgroundColor: palette.warning, borderWidth: 1, borderColor: palette.warningBorder },
  warningCopy: { flex: 1 },
  warningTitle: { color: "#FFE1B1", fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  warningText: { color: "#E7C996", fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  textAction: { alignSelf: "flex-end", marginTop: 8, paddingVertical: 5 },
  textActionText: { color: "#B8E7FF", fontSize: 12, fontWeight: "800" },
  noteCard: { flexDirection: "row", gap: 10, padding: 13, borderRadius: 16, backgroundColor: palette.info, borderWidth: 1, borderColor: palette.borderStrong },
  noteText: { flex: 1, color: palette.textMuted, fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
  deliveryDivider: { height: 1, backgroundColor: palette.border, marginVertical: 4 },
  testResult: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: 14, borderWidth: 1 },
  testProgress: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: palette.borderStrong, backgroundColor: palette.info },
  progressCopy: { flex: 1, gap: 2 },
  progressTitle: { color: palette.text, fontSize: 13, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  progressText: { color: palette.textMuted, fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl" },
  testSuccess: { backgroundColor: palette.success, borderColor: palette.successBorder },
  testFailure: { backgroundColor: palette.danger, borderColor: palette.dangerBorder },
  testText: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl" },
  testErrorText: { color: "#FFD2D8" },
  hardwareResult: { gap: 8 },
  termsCard: { gap: 7, padding: 15, borderRadius: 16, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  termsTitle: { color: palette.accent, fontSize: 14, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  termsText: { color: palette.textMuted, fontSize: 12, lineHeight: 20, writingDirection: "rtl", textAlign: "right" },
  termsHint: { color: palette.textSoft, fontSize: 12, lineHeight: 18, writingDirection: "rtl", textAlign: "right", marginTop: -3 },
  termsDisclosure: { overflow: "hidden", borderRadius: 16, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  termsDisclosureExpanded: { borderColor: palette.borderStrong, backgroundColor: palette.cardAlt },
  termsDisclosureHeader: { minHeight: 64, paddingHorizontal: 13, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  termsDisclosureCopy: { flex: 1, gap: 3 },
  termsDisclosureAction: { color: palette.textSoft, fontSize: 11, writingDirection: "rtl", textAlign: "right" },
  termsDisclosureIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: palette.accentSoft, alignItems: "center", justifyContent: "center" },
  termsDisclosureBody: { borderTopWidth: 1, borderTopColor: palette.border, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 15 },
  contactCard: { gap: 10, padding: 16, borderRadius: 18, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.borderStrong },
  contactHeading: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  contactTitle: { color: palette.text, fontSize: 16, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  contactPerson: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 7 },
  contactText: { color: palette.textMuted, fontSize: 13, writingDirection: "rtl", textAlign: "right" },
  glowingText: { color: palette.accent, fontWeight: "900" },
  contactAction: { minHeight: 48, borderRadius: 14, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  contactActionLabel: { color: "#061522", fontWeight: "900", fontSize: 13 },
  contactActionCaption: { color: "#061522", fontWeight: "800", fontSize: 12 },
  phoneAction: { backgroundColor: "#72D4FF" },
  whatsappAction: { backgroundColor: "#63E6A8" },
  emailAction: { backgroundColor: "#FFC776" },
  termsFooterNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 13, borderRadius: 14, backgroundColor: palette.warning, borderWidth: 1, borderColor: palette.warningBorder },
  termsFooterText: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
  termsConsentButton: { minHeight: 52, borderRadius: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#16826A", shadowColor: "#16826A", shadowOpacity: 0.2, shadowRadius: 8, elevation: 2 },
  termsConsentButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", writingDirection: "rtl" },
  termsConsentStatus: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, backgroundColor: palette.success, borderWidth: 1, borderColor: palette.successBorder },
  termsConsentCopy: { flex: 1, gap: 3 },
  termsConsentTitle: { color: palette.text, fontSize: 13, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  termsConsentText: { color: palette.textMuted, fontSize: 11, textAlign: "right", writingDirection: "rtl" },
  lastUpdated: { color: palette.textSoft, fontSize: 12, textAlign: "center", writingDirection: "rtl", marginTop: 2 },
  sectionStack: { gap: 13 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 2 },
  sectionIcon: { width: 42, height: 42, backgroundColor: palette.accentSoft, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  sectionText: { color: palette.textSoft, fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  field: { gap: 7 },
  fieldLabel: { color: palette.textMuted, fontSize: 13, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  inputShell: { minHeight: 52, borderRadius: 15, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.borderStrong, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  inputShellMultiline: { alignItems: "flex-start", paddingVertical: 8 },
  input: { flex: 1, color: palette.text, fontSize: 14, minHeight: 48, writingDirection: "ltr" },
  inputMultiline: { minHeight: 72, writingDirection: "rtl", textAlign: "right", lineHeight: 20 },
  trailingAction: { padding: 6 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 16 },
  toggleCompact: { backgroundColor: palette.cardAlt, paddingVertical: 10, borderColor: palette.border },
  toggleCopy: { flex: 1, paddingRight: 12 },
  toggleLabel: { color: palette.text, fontSize: 14, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  toggleText: { color: palette.textSoft, fontSize: 11, lineHeight: 16, marginTop: 3, writingDirection: "rtl", textAlign: "right" },
  choiceBlock: { gap: 8 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 39, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: palette.borderStrong, backgroundColor: palette.card, alignItems: "center", justifyContent: "center" },
  choiceActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  choiceText: { color: palette.textMuted, fontSize: 12, fontWeight: "700" },
  choiceTextActive: { color: palette.accent, fontWeight: "900" },
  zoomBlock: { gap: 7, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: 16, padding: 14 },
  zoomHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  zoomValue: { color: palette.accent, fontSize: 16, fontWeight: "900" },
  zoomLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: -3 },
  zoomHint: { color: palette.textSoft, fontSize: 11 },
  actionGroup: { gap: 8, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.cardAlt },
  groupTitle: { color: palette.accent, fontSize: 13, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginBottom: 2 },
  diagnostic: { gap: 5, padding: 14, borderRadius: 15, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  diagnosticLabel: { color: palette.textSoft, fontSize: 11, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  diagnosticValue: { color: palette.text, fontSize: 13, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
  errorValue: { color: "#FFB4BD" },
  emptyHistory: { alignItems: "center", gap: 8, padding: 28, borderRadius: 18, backgroundColor: palette.cardAlt, borderWidth: 1, borderColor: palette.borderStrong },
  emptyHistoryTitle: { color: palette.text, fontSize: 15, fontWeight: "900", writingDirection: "rtl" },
  emptyHistoryText: { color: palette.textSoft, fontSize: 12, lineHeight: 18, textAlign: "center", writingDirection: "rtl" },
  historyCard: { flexDirection: "row", gap: 10, padding: 13, borderRadius: 16, borderWidth: 1 },
  historySuccess: { backgroundColor: palette.success, borderColor: palette.successBorder },
  historyFailure: { backgroundColor: palette.danger, borderColor: palette.dangerBorder },
  historyIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#071C2C55", alignItems: "center", justifyContent: "center" },
  historyCopy: { flex: 1, gap: 4 },
  historyTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  historyChannel: { flex: 1, color: palette.text, fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  historyTime: { color: palette.textSoft, fontSize: 10 },
  historyDetail: { color: palette.textMuted, fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl" },
  });
}
