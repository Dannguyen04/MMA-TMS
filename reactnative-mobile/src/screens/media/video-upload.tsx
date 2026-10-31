import { Ionicons } from "@expo/vector-icons";
import { useEffect, useReducer, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useToastMessage } from "@/components/toast/app-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isApiError } from "@/api";
import {
  uploadVideo,
  VIDEO_CAMERA_ANGLES,
  VIDEO_TRAINING_TYPES,
} from "@/api/media";
import { media } from "@/i18n/media";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { uploadIssue, type UploadIssue } from "@/screens/media/upload-rules";
import { VideoScreenHeader } from "@/screens/media/video-chrome";
import {
  formatFileSize,
  initialUploadForm,
  uploadBlocker,
  uploadFormReducer,
  type PickedVideo,
} from "@/screens/media/video-model";
import { useTypography } from "@/theme";

function issueLabel(issue: UploadIssue): string {
  if (issue === "title") return media.needTitle;
  if (issue === "file") return media.needFile;
  if (issue === "duration") return media.needDuration;
  if (issue === "durationRange") return media.durationRange;
  if (issue === "size") return media.needSize;
  if (issue === "mime") return media.badMime;
  if (issue === "type") return media.trainingType;
  return media.cameraAngle;
}

function messageFor(error: unknown): string {
  if (!isApiError(error)) return media.generic;
  if (error.status === 0 || error.code === "NETWORK_ERROR") return media.network;
  if (error.status === 403) return media.forbidden;
  return error.message || media.generic;
}

export function VideoUploadContent({
  fighterId,
  onUploaded,
  onBack,
}: {
  fighterId: string | null;
  onUploaded: (videoId: string) => void;
  onBack: () => void;
}) {
  const colors = useFighterPalette();
  const live = useTypography();
  const insets = useSafeAreaInsets();
  const [form, dispatch] = useReducer(uploadFormReducer, undefined, initialUploadForm);
  useToastMessage(form.error, "error");
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const sendingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const onPick = async () => {
    let picker: {
      requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
      launchImageLibraryAsync: (options: { mediaTypes: string[]; allowsEditing?: boolean }) => Promise<{
        canceled: boolean;
        assets?: Array<{
          uri: string;
          fileName?: string | null;
          mimeType?: string | null;
          duration?: number | null;
          fileSize?: number | null;
        }>;
      }>;
    };
    try {
      // Metro only allows a string-literal require. A variable require
      // fails the web bundle with "Invalid call: require(moduleName)".
      picker = require("expo-image-picker") as typeof picker;
    } catch {
      dispatch({ type: "pickerMissing" });
      return;
    }
    const permission = await picker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      dispatch({ type: "permissionDenied" });
      return;
    }
    const picked = await picker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
    });
    if (picked.canceled || !picked.assets?.[0]) {
      dispatch({ type: "pickCanceled" });
      return;
    }
    const file = picked.assets[0];
    const asset: PickedVideo = {
      uri: file.uri,
      filename: file.fileName ?? "video.mp4",
      mimeType: file.mimeType ?? null,
      durationMs: typeof file.duration === "number" ? Math.round(file.duration) : null,
      fileSizeBytes: typeof file.fileSize === "number" ? file.fileSize : null,
    };
    dispatch({ type: "fileSelected", asset });
  };

  const onSubmit = async () => {
    if (!fighterId || form.phase === "sending" || sendingRef.current) return;
    const issue = uploadBlocker(form);
    const asset = form.asset;
    const durationMs = asset?.durationMs ?? null;
    const mimeType = asset?.mimeType ?? null;
    const fileSizeBytes = asset?.fileSizeBytes ?? null;
    if (issue || !asset || !form.trainingType || !form.cameraAngle || durationMs == null || fileSizeBytes == null || !mimeType) {
      dispatch({ type: "invalid", error: issue ? issueLabel(issue) : media.needFile });
      return;
    }
    const trainingType = form.trainingType;
    const cameraAngle = form.cameraAngle;
    sendingRef.current = true;
    dispatch({ type: "submitStart" });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const fileResponse = await fetch(asset.uri, { signal: controller.signal });
      const body = await fileResponse.blob();
      const size = body.size > 0 ? body.size : fileSizeBytes;
      const created = await uploadVideo(
        {
          fighterId,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          trainingType,
          cameraAngle,
          durationMs,
          originalFilename: asset.filename,
          mimeType,
          fileSizeBytes: size,
          body,
        },
        controller.signal,
      );
      if (!mountedRef.current || controller.signal.aborted) return;
      dispatch({ type: "submitSuccess" });
      onUploaded(created.id);
    } catch (cause: unknown) {
      sendingRef.current = false;
      if (!mountedRef.current || controller.signal.aborted) return;
      dispatch({ type: "submitFailure", error: messageFor(cause) });
    }
  };

  const ready = uploadIssue({
    title: form.title,
    trainingType: form.trainingType,
    cameraAngle: form.cameraAngle,
    durationMs: form.asset?.durationMs ?? null,
    fileSizeBytes: form.asset?.fileSizeBytes ?? null,
    mimeType: form.asset?.mimeType ?? null,
    filename: form.asset?.filename ?? null,
  }) == null && !!fighterId;
  const sending = form.phase === "sending";
  const submitEnabled = ready && !sending;
  const sizeLabel = formatFileSize(form.asset?.fileSizeBytes ?? null);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <VideoScreenHeader title={media.uploadTitle} onBack={onBack} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.form}
      >
        {!fighterId ? <Text style={{ color: colors.muted }}>{media.needFighter}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={media.chooseExisting}
          onPress={() => {
            void onPick();
          }}
          style={[styles.picker, { backgroundColor: colors.bg, borderColor: colors.line }]}
        >
          <Ionicons name="document-text-outline" size={28} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {form.asset ? form.asset.filename : media.noVideoYet}
          </Text>
          {sizeLabel ? <Text style={{ color: colors.muted, fontSize: 12 }}>{sizeLabel}</Text> : null}
          <View style={[styles.choose, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={{ color: colors.accent, fontFamily: live.faces.semibold, fontSize: 14 }}>
              {media.chooseExisting}
            </Text>
          </View>
        </Pressable>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.ink, fontFamily: live.faces.semibold }]}>{media.title}</Text>
          <TextInput
            accessibilityLabel={media.title}
            value={form.title}
            onChangeText={(value) => dispatch({ type: "title", value })}
            maxLength={200}
            placeholder={media.titlePlaceholder}
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.bg }]}
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.ink, fontFamily: live.faces.semibold }]}>{media.description}</Text>
          <TextInput
            accessibilityLabel={media.description}
            value={form.description}
            onChangeText={(value) => dispatch({ type: "description", value })}
            maxLength={2000}
            multiline
            placeholder={media.descriptionPlaceholder}
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              styles.area,
              { color: colors.ink, borderColor: colors.line, backgroundColor: colors.bg },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.ink, fontFamily: live.faces.semibold }]}>{media.trainingType}</Text>
          <View style={styles.choiceGrid}>
            {VIDEO_TRAINING_TYPES.map((value) => (
              <Choice
                key={value}
                label={media.training[value]}
                selected={form.trainingType === value}
                radio
                onPress={() => dispatch({ type: "trainingType", value })}
              />
            ))}
          </View>
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.ink, fontFamily: live.faces.semibold }]}>{media.cameraAngle}</Text>
          <View style={styles.angleRow}>
            {VIDEO_CAMERA_ANGLES.map((value) => (
              <Choice
                key={value}
                label={media.angle[value]}
                selected={form.cameraAngle === value}
                onPress={() => dispatch({ type: "cameraAngle", value })}
              />
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.submitBar, { borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !submitEnabled }}
          disabled={!submitEnabled}
          onPress={() => void onSubmit()}
          style={[
            styles.submit,
            { backgroundColor: submitEnabled ? colors.accent : colors.disabled },
          ]}
        >
          <Text
            style={{
              color: submitEnabled ? colors.onAccent : colors.disabledInk,
              fontFamily: live.faces.semibold,
              fontSize: 15,
            }}
          >
            {sending ? media.sending : media.submit}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Choice({
  label,
  selected,
  onPress,
  radio,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  radio?: boolean;
}) {
  const colors = useFighterPalette();
  const live = useTypography();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={selected ? `${label}, ${media.selected}` : label}
      onPress={onPress}
      style={[
        styles.choice,
        radio ? styles.choiceHalf : styles.choiceThird,
        {
          borderColor: selected ? colors.accent : colors.line,
          backgroundColor: selected ? colors.accentSoft : "transparent",
        },
      ]}
    >
      {radio ? (
        <Ionicons
          name={selected ? "radio-button-on" : "radio-button-off"}
          size={16}
          color={selected ? colors.accent : colors.ink}
        />
      ) : null}
      <Text
        style={{
          color: colors.ink,
          fontFamily: live.faces.medium,
          fontSize: 13,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  picker: {
    minHeight: 150,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
  },
  choose: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 99,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  field: { gap: 8 },
  label: { fontSize: 13 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  area: { minHeight: 76, textAlignVertical: "top" },
  choiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  angleRow: { flexDirection: "row", gap: 8 },
  choice: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  choiceHalf: { width: "48%", flexGrow: 1 },
  choiceThird: { flex: 1, justifyContent: "center" },
  submitBar: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12 },
  submit: { minHeight: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
