#!/usr/bin/env bash
# Builds a locally signed Android Release APK without committing signing material.
set -Eeuo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
OUTPUT_DIR="${AKEER14_RELEASE_OUTPUT_DIR:-$ROOT_DIR/dist/apk/release}"

fail() {
  printf 'خطأ: %s\n' "$1" >&2
  exit 1
}

prompt_value() {
  local variable="$1"
  local label="$2"
  local secret="${3:-false}"
  local current="${!variable:-}"
  if [[ -n "$current" ]]; then
    return
  fi
  [[ -t 0 ]] || fail "المتغير $variable مطلوب في بيئة غير تفاعلية. لا تمرره في سطر الأوامر."
  if [[ "$secret" == "true" ]]; then
    read -r -s -p "$label: " current
    printf '\n'
  else
    read -r -p "$label: " current
  fi
  [[ -n "$current" ]] || fail "لم تُدخل قيمة لـ$variable."
  printf -v "$variable" '%s' "$current"
  export "$variable"
}

prompt_value AKEER14_KEYSTORE_FILE "مسار ملف keystore المحلي"
prompt_value AKEER14_KEY_ALIAS "اسم مفتاح التوقيع (alias)"
prompt_value AKEER14_STORE_PASSWORD "كلمة مرور مخزن المفاتيح" true
prompt_value AKEER14_KEY_PASSWORD "كلمة مرور المفتاح" true

[[ -f "$AKEER14_KEYSTORE_FILE" ]] || fail "ملف keystore غير موجود: $AKEER14_KEYSTORE_FILE"
[[ -d "$ANDROID_DIR" ]] || fail "مجلد Android غير موجود. شغّل Expo prebuild قبل البناء."

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
  fail "عيّن ANDROID_HOME أو ANDROID_SDK_ROOT قبل البناء."
fi

SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT}}"
APKSIGNER="$(command -v apksigner || true)"
if [[ -z "$APKSIGNER" ]]; then
  APKSIGNER="$(find "$SDK_ROOT/build-tools" -type f -name apksigner -perm -u+x 2>/dev/null | sort -V | tail -n 1)"
fi
[[ -n "$APKSIGNER" && -x "$APKSIGNER" ]] || fail "لم يُعثر على apksigner ضمن Android SDK. ثبّت Android SDK Build-Tools."

cleanup() {
  unset AKEER14_STORE_PASSWORD AKEER14_KEY_PASSWORD
}
trap cleanup EXIT

printf 'يبدأ بناء Release APK موقّع محليًا…\n'
(cd "$ANDROID_DIR" && ./gradlew :app:assembleRelease --console=plain)

SOURCE_APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
[[ -s "$SOURCE_APK" ]] || fail "لم ينتج Gradle ملف APK موقّعًا في المسار المتوقع."

mkdir -p "$OUTPUT_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_APK="$OUTPUT_DIR/akeer14-release-$TIMESTAMP.apk"
cp -f "$SOURCE_APK" "$OUTPUT_APK"

printf 'يتحقق apksigner من توقيع APK…\n'
"$APKSIGNER" verify --verbose --print-certs "$OUTPUT_APK"

printf '\nتم إنشاء APK الموقّع: %s\n' "$OUTPUT_APK"
sha256sum "$OUTPUT_APK"
