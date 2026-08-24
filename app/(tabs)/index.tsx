import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Camera } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import Slider from "@react-native-community/slider";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  I18nManager,
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
  HardwareTestResult,
  clearAgentSecrets,
  defaultSettings,
  getAgentStatus,
  hasStoredAgentConfig,
  loadSettings,
  persistSettings,
  runNativeHardwareTest,
  saveAgentConfig,
  startAgent,
  stopAgent,
  testGmailConnection,
  testTelegramConnection,
} from "@/lib/telegram-agent";
import { isTelegramSettingsReady } from "@/lib/agent-protocol";

I18nManager.allowRTL(true);

const initialStatus: AgentStatus = {
  running: false,
  phase: "جارٍ التحقق",
  message: "يتم تحميل الحالة المحلية للعامل.",
  updatedAt: "",
  lastError: "",
};

type Section = "overview" | "telegram" | "camera" | "detection" | "diagnostics";

export default function AgentHomeScreen() {
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

  const hydrated = useMemo(() => isTelegramSettingsReady(settings.botToken, settings.chatId) || storedConfigReady, [settings.botToken, settings.chatId, storedConfigReady]);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getAgentStatus());
    } catch (error) {
      setStatus((current) => ({ ...current, phase: "خطأ", message: error instanceof Error ? error.message : "تعذر قراءة الحالة." }));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setSettings(await loadSettings());
      setStoredConfigReady(await hasStoredAgentConfig());
      await refreshStatus();
    })();
  }, [refreshStatus]);

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
    try {
      setTelegramTest(await testTelegramConnection(settings));
    } catch (error) {
      setTelegramTest({ ok: false, message: error instanceof Error ? error.message : "فشل اختبار Telegram." });
    } finally {
      setBusy(false);
    }
  };

  const runGmailTest = async () => {
    setBusy(true);
    try {
      setGmailTest(await testGmailConnection(settings));
    } catch (error) {
      setGmailTest({ ok: false, message: error instanceof Error ? error.message : "فشل اختبار Gmail." });
    } finally {
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

  const requestPermissions = async () => {
    const [camera, microphone] = await Promise.all([
      Camera.requestCameraPermissionsAsync(),
      Camera.requestMicrophonePermissionsAsync(),
    ]);
    if (Platform.OS !== "web") await Notifications.requestPermissionsAsync();
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
      <View style={styles.root}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}><MaterialIcons name="security" size={22} color="#B8E7FF" /></View>
            <View>
              <Text style={styles.title}>عامل Akeer14</Text>
              <Text style={styles.subtitle}>تحكم Telegram من الهاتف الثابت</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="تحديث الحالة" onPress={() => void refreshStatus()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <MaterialIcons name="refresh" size={22} color="#DCEFFA" />
          </Pressable>
        </View>

        <View style={styles.segmented}>
          {([
            ["overview", "الحالة", "monitor-heart"],
            ["telegram", "Telegram", "send"],
            ["camera", "الكاميرا", "photo-camera"],
            ["detection", "الكشف", "sensors"],
            ["diagnostics", "التشخيص", "fact-check"],
          ] as const).map(([id, label, icon]) => (
            <Pressable key={id} accessibilityRole="tab" onPress={() => setSection(id)} style={({ pressed }) => [styles.tab, section === id && styles.tabActive, pressed && styles.pressed]}>
              <MaterialIcons name={icon} size={17} color={section === id ? "#071C2C" : "#8BA4B4"} />
              <Text style={[styles.tabText, section === id && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {section === "overview" && <Overview status={status} ready={hydrated} busy={busy} onStart={() => void runStart()} onStop={() => void runStop()} onOpenTelegram={() => setSection("telegram")} />}
          {section === "telegram" && <TelegramSettings settings={settings} update={update} tokenVisible={tokenVisible} setTokenVisible={setTokenVisible} gmailPasswordVisible={gmailPasswordVisible} setGmailPasswordVisible={setGmailPasswordVisible} telegramTest={telegramTest} gmailTest={gmailTest} busy={busy} onSave={() => void save()} onTestTelegram={() => void runTelegramTest()} onTestGmail={() => void runGmailTest()} onForget={forgetSecrets} />}
          {section === "camera" && <CameraSettings settings={settings} update={update} onSave={() => void save()} />}
          {section === "detection" && <DetectionSettings settings={settings} update={update} onSave={() => void save()} />}
          {section === "diagnostics" && <Diagnostics status={status} hardwareTest={hardwareTest} busy={busy} onRefresh={() => void refreshStatus()} onHardwareTest={() => void runHardwareTest()} />}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

function Overview({ status, ready, busy, onStart, onStop, onOpenTelegram }: { status: AgentStatus; ready: boolean; busy: boolean; onStart: () => void; onStop: () => void; onOpenTelegram: () => void }) {
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
    </View>
    {!ready && <View style={styles.warningCard}><MaterialIcons name="key" size={22} color="#FFC776" /><View style={styles.warningCopy}><Text style={styles.warningTitle}>يلزم إعداد Telegram</Text><Text style={styles.warningText}>أدخل token ومعرّف المحادثة قبل بدء خدمة العامل.</Text><Pressable onPress={onOpenTelegram} style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}><Text style={styles.textActionText}>فتح الإعدادات</Text></Pressable></View></View>}
    <View style={styles.actionRow}>
      <PrimaryButton label={busy ? "جارٍ التنفيذ…" : "تشغيل العامل"} icon="play-arrow" disabled={busy} onPress={onStart} />
      <SecondaryButton label="إيقاف" icon="stop" disabled={busy || !status.running} onPress={onStop} />
    </View>
    <View style={styles.noteCard}><MaterialIcons name="info-outline" size={20} color="#8EC5FF" /><Text style={styles.noteText}>تظهر الأزرار والكنفاسات داخل Telegram بعد تشغيل العامل من هذه الواجهة ومنح الصلاحيات. لا يعمل هذا المسار داخل Expo Go أو معاينة الويب.</Text></View>
  </>;
}

function TelegramSettings({ settings, update, tokenVisible, setTokenVisible, gmailPasswordVisible, setGmailPasswordVisible, telegramTest, gmailTest, busy, onSave, onTestTelegram, onTestGmail, onForget }: { settings: AgentSettings; update: <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => void; tokenVisible: boolean; setTokenVisible: (value: boolean) => void; gmailPasswordVisible: boolean; setGmailPasswordVisible: (value: boolean) => void; telegramTest: ChannelTestResult | null; gmailTest: ChannelTestResult | null; busy: boolean; onSave: () => void; onTestTelegram: () => void; onTestGmail: () => void; onForget: () => void }) {
  return <View style={styles.sectionStack}>
    <SectionHeader icon="send" title="إعدادات Telegram وGmail" text="تُحفظ الأسرار في تخزين Android المشفر على الهاتف. لا تُرسل إلى خادم التطبيق أو بيئة الواجهة." />
    <Field label="Bot Token" value={settings.botToken} secure={!tokenVisible} placeholder="123456:ABC…" onChangeText={(value) => update("botToken", value)} trailing={<Pressable onPress={() => setTokenVisible(!tokenVisible)} style={({ pressed }) => [styles.trailingAction, pressed && styles.pressed]}><MaterialIcons name={tokenVisible ? "visibility-off" : "visibility"} size={19} color="#8BA4B4" /></Pressable>} />
    <Field label="Chat ID" value={settings.chatId} placeholder="مثال: 123456789 أو -100…" keyboardType="numbers-and-punctuation" onChangeText={(value) => update("chatId", value)} />
    <Field label="User IDs المصرح بها" value={settings.allowedUserIds} placeholder="افصل المعرفات بفاصلة، أو اتركه فارغًا" keyboardType="numbers-and-punctuation" onChangeText={(value) => update("allowedUserIds", value)} />
    <View style={styles.noteCard}><MaterialIcons name="security" size={20} color="#55E0B9" /><Text style={styles.noteText}>يقتصر العامل على Chat ID المحدد. إذا أدخلت User IDs، فلن ينفذ الأوامر إلا منهم. تدعم المجموعات ذات Chat ID السالب.</Text></View>
    <PrimaryButton label="حفظ الإعدادات" icon="save" onPress={onSave} />
    <SecondaryButton label={busy ? "جارٍ الاختبار…" : "اختبار اتصال Telegram"} icon="cloud-done" disabled={busy} onPress={onTestTelegram} />
    <TestResult result={telegramTest} />

    <View style={styles.deliveryDivider} />
    <Text style={styles.groupTitle}>نسخة احتياطية عبر Gmail</Text>
    <ToggleRow label="تفعيل النسخ الاحتياطي" text="لا يحذف العامل الدليل تلقائيًا إلا بعد نجاح Telegram وGmail عند تفعيله." value={settings.gmailBackupEnabled} onChange={(value) => update("gmailBackupEnabled", value)} />
    <Field label="خادم SMTP" value={settings.gmailHost} placeholder="smtp.gmail.com" onChangeText={(value) => update("gmailHost", value)} />
    <Field label="منفذ SMTP" value={String(settings.gmailPort)} placeholder="587 أو 465" keyboardType="number-pad" onChangeText={(value) => update("gmailPort", Number.parseInt(value, 10) || 587)} />
    <Field label="بريد Gmail المرسل" value={settings.gmailUsername} placeholder="name@gmail.com" keyboardType="email-address" onChangeText={(value) => update("gmailUsername", value)} />
    <Field label="كلمة مرور التطبيق" value={settings.gmailAppPassword} secure={!gmailPasswordVisible} placeholder="كلمة تطبيق Gmail" onChangeText={(value) => update("gmailAppPassword", value)} trailing={<Pressable onPress={() => setGmailPasswordVisible(!gmailPasswordVisible)} style={({ pressed }) => [styles.trailingAction, pressed && styles.pressed]}><MaterialIcons name={gmailPasswordVisible ? "visibility-off" : "visibility"} size={19} color="#8BA4B4" /></Pressable>} />
    <Field label="بريد المستلم" value={settings.gmailRecipient} placeholder="backup@example.com" keyboardType="email-address" onChangeText={(value) => update("gmailRecipient", value)} />
    <View style={styles.noteCard}><MaterialIcons name="vpn-key" size={20} color="#FFC776" /><Text style={styles.noteText}>يحتاج Gmail عادةً إلى كلمة مرور تطبيق عند تفعيل المصادقة الثنائية. استخدم 587 لـ STARTTLS أو 465 لـ SSL، ثم اضغط الاختبار قبل تشغيل العامل.</Text></View>
    <SecondaryButton label={busy ? "جارٍ الاختبار…" : "اختبار اتصال Gmail"} icon="alternate-email" disabled={busy || !settings.gmailBackupEnabled} onPress={onTestGmail} />
    <TestResult result={gmailTest} />
    <SecondaryButton label="حذف Bot Token المحلي" icon="delete-outline" destructive onPress={onForget} />
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

function Diagnostics({ status, hardwareTest, busy, onRefresh, onHardwareTest }: { status: AgentStatus; hardwareTest: HardwareTestResult | null; busy: boolean; onRefresh: () => void; onHardwareTest: () => void }) {
  return <View style={styles.sectionStack}>
    <SectionHeader icon="fact-check" title="تشخيص التنفيذ" text="تعكس هذه البطاقة آخر حالة مسجلة من خدمة Android، ولا تضع نتائج افتراضية." />
    <DiagnosticRow label="المرحلة" value={status.phase} />
    <DiagnosticRow label="الرسالة" value={status.message} />
    <DiagnosticRow label="آخر تحديث" value={status.updatedAt || "غير متاح"} />
    <DiagnosticRow label="آخر خطأ" value={status.lastError || "لا يوجد"} error={Boolean(status.lastError)} />
    <PrimaryButton label="تحديث الحالة" icon="refresh" onPress={onRefresh} />
    <View style={styles.deliveryDivider} />
    <Text style={styles.groupTitle}>فحص الكاميرا والميكروفون</Text>
    <View style={styles.noteCard}><MaterialIcons name="perm-device-information" size={20} color="#8EC5FF" /><Text style={styles.noteText}>يفحص APK المخصص الكاميرا بالتقاط صورة اختبار تحذف فورًا، ويقرأ عينات PCM فعلية من الميكروفون. أوقف العامل أولًا لتجنب تعارض الكاميرا أو الميكروفون.</Text></View>
    <SecondaryButton label={busy ? "جارٍ الفحص…" : "فحص الكاميرا والميكروفون"} icon="settings-input-component" disabled={busy || status.running} onPress={onHardwareTest} />
    {hardwareTest ? <View style={styles.hardwareResult}><TestResult result={{ ok: hardwareTest.cameraOk, message: hardwareTest.cameraDetail }} /><TestResult result={{ ok: hardwareTest.microphoneOk, message: hardwareTest.microphoneDetail }} /></View> : null}
    <View style={styles.noteCard}><MaterialIcons name="battery-alert" size={20} color="#FFC776" /><Text style={styles.noteText}>يجب أن يبقى الإشعار المستمر ظاهرًا بعد التشغيل. إذا قيّد الهاتف التطبيق، أضف التطبيق إلى الاستثناء من تحسين البطارية من إعدادات النظام.</Text></View>
  </View>;
}

function Metric({ icon, label, value, color }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; value: string; color: string }) {
  return <View style={styles.metric}><MaterialIcons name={icon} size={19} color={color} /><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue} numberOfLines={1}>{value}</Text></View>;
}

function SectionHeader({ icon, title, text }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; text: string }) {
  return <View style={styles.sectionHeader}><View style={styles.sectionIcon}><MaterialIcons name={icon} size={22} color="#8EC5FF" /></View><View style={styles.headerCopy}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionText}>{text}</Text></View></View>;
}

function TestResult({ result }: { result: ChannelTestResult | null }) {
  if (!result) return null;
  return <View style={[styles.testResult, result.ok ? styles.testSuccess : styles.testFailure]}><MaterialIcons name={result.ok ? "check-circle" : "error-outline"} size={19} color={result.ok ? "#55E0B9" : "#FFB4BD"} /><Text style={[styles.testText, !result.ok && styles.testErrorText]}>{result.message}</Text></View>;
}

function Field({ label, value, placeholder, onChangeText, secure, keyboardType, trailing }: { label: string; value: string; placeholder: string; onChangeText: (value: string) => void; secure?: boolean; keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"]; trailing?: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.inputShell}><TextInput style={styles.input} value={value} placeholder={placeholder} placeholderTextColor="#5F788A" secureTextEntry={secure} autoCapitalize="none" autoCorrect={false} keyboardType={keyboardType} onChangeText={onChangeText} textAlign="left" /><View>{trailing}</View></View></View>;
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
  root: { flex: 1, backgroundColor: "#071C2C" },
  topBar: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#10334D", alignItems: "center", justifyContent: "center" },
  title: { color: "#F1F8FC", fontSize: 20, fontWeight: "800", writingDirection: "rtl" },
  subtitle: { color: "#8BA4B4", fontSize: 12, marginTop: 2, writingDirection: "rtl" },
  iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#102E43", alignItems: "center", justifyContent: "center" },
  segmented: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#17384E", paddingVertical: 7, paddingHorizontal: 8, gap: 5 },
  tab: { minWidth: 58, flex: 1, paddingVertical: 8, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 12 },
  tabActive: { backgroundColor: "#B8E7FF" },
  tabText: { color: "#8BA4B4", fontSize: 10, fontWeight: "700" },
  tabTextActive: { color: "#071C2C" },
  content: { padding: 18, paddingBottom: 36, gap: 14 },
  statusCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, borderWidth: 1 },
  statusReady: { backgroundColor: "#0E312E", borderColor: "#1D6A5B" },
  statusIdle: { backgroundColor: "#3B2C1D", borderColor: "#6C502C" },
  statusIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: "#071C2C55", alignItems: "center", justifyContent: "center", marginRight: 12 },
  statusCopy: { flex: 1 },
  statusLabel: { color: "#F1F8FC", fontSize: 16, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  statusMessage: { color: "#C9DCE8", fontSize: 12, lineHeight: 18, marginTop: 4, writingDirection: "rtl", textAlign: "right" },
  dot: { width: 10, height: 10, borderRadius: 5, marginLeft: 9 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  metric: { width: "48%", flexGrow: 1, minHeight: 100, backgroundColor: "#102A3B", borderWidth: 1, borderColor: "#1B4159", borderRadius: 17, padding: 13, gap: 6 },
  metricLabel: { color: "#8BA4B4", fontSize: 11, writingDirection: "rtl", textAlign: "right" },
  metricValue: { color: "#F1F8FC", fontSize: 13, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  actionRow: { flexDirection: "row", gap: 10 },
  primaryButton: { minHeight: 50, borderRadius: 16, backgroundColor: "#B8E7FF", flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryText: { color: "#071C2C", fontWeight: "900", fontSize: 14 },
  secondaryButton: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: "#2E627E", backgroundColor: "#102A3B", flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  secondaryText: { color: "#B8E7FF", fontWeight: "800", fontSize: 14 },
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
  noteCard: { flexDirection: "row", gap: 10, padding: 13, borderRadius: 16, backgroundColor: "#0E283A", borderWidth: 1, borderColor: "#1B4763" },
  noteText: { flex: 1, color: "#BBD3E2", fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
  deliveryDivider: { height: 1, backgroundColor: "#214B64", marginVertical: 4 },
  testResult: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: 14, borderWidth: 1 },
  testSuccess: { backgroundColor: "#0E312E", borderColor: "#1D6A5B" },
  testFailure: { backgroundColor: "#3A2028", borderColor: "#824451" },
  testText: { flex: 1, color: "#C7F6E8", fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl" },
  testErrorText: { color: "#FFD2D8" },
  hardwareResult: { gap: 8 },
  sectionStack: { gap: 13 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 2 },
  sectionIcon: { width: 42, height: 42, backgroundColor: "#102E43", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  sectionTitle: { color: "#F1F8FC", fontSize: 18, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  sectionText: { color: "#8BA4B4", fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  field: { gap: 7 },
  fieldLabel: { color: "#C9DCE8", fontSize: 13, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  inputShell: { minHeight: 52, borderRadius: 15, backgroundColor: "#102A3B", borderWidth: 1, borderColor: "#214B64", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  input: { flex: 1, color: "#F1F8FC", fontSize: 14, minHeight: 48, writingDirection: "ltr" },
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
});
