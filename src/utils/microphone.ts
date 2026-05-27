export type MicrophonePermissionResult =
  | { granted: true }
  | {
      granted: false;
      reason: "unsupported" | "denied" | "unavailable";
      error?: unknown;
    };

export type MicrophonePermissionFailure = Extract<
  MicrophonePermissionResult,
  { granted: false }
>;

export const isMicrophonePermissionFailure = (
  result: MicrophonePermissionResult,
): result is MicrophonePermissionFailure => result.granted === false;

const getErrorName = (error: unknown) => {
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException
  ) {
    return error.name;
  }
  if (error && typeof error === "object" && "name" in error) {
    return String((error as { name?: unknown }).name || "");
  }
  return "";
};

export const requestMicrophoneAccess =
  async (): Promise<MicrophonePermissionResult> => {
    if (typeof navigator === "undefined") {
      return { granted: false, reason: "unsupported" };
    }

    const getUserMedia = navigator.mediaDevices?.getUserMedia;
    if (!getUserMedia) {
      return { granted: false, reason: "unsupported" };
    }

    try {
      const stream = await getUserMedia.call(navigator.mediaDevices, {
        audio: true,
      });
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true };
    } catch (error) {
      const errorName = getErrorName(error);
      if (
        errorName === "NotAllowedError" ||
        errorName === "PermissionDeniedError"
      ) {
        return { granted: false, reason: "denied", error };
      }
      return { granted: false, reason: "unavailable", error };
    }
  };

export const getMicrophonePermissionMessage = (
  result: MicrophonePermissionResult,
  language: "zh" | "en" = "zh",
) => {
  if (!isMicrophonePermissionFailure(result)) return "";
  if (language === "en") {
    if (result.reason === "denied") {
      return "Microphone permission is blocked. Please allow it in Settings and try again.";
    }
    if (result.reason === "unsupported") {
      return "This device does not support microphone recording here.";
    }
    return "I can't access the microphone. Please try again.";
  }

  if (result.reason === "denied") {
    return "没有麦克风权限，请在系统设置里允许后再试。";
  }
  if (result.reason === "unsupported") {
    return "当前环境不支持麦克风录音，请在手机包或浏览器中使用。";
  }
  return "无法访问麦克风，请检查设备权限后再试。";
};
