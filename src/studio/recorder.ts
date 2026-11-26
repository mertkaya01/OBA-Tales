/**
 * VİDEO KAYDI — kompozitör tuvalini tarayıcının kendi kaydedicisiyle (MediaRecorder) video dosyasına çevirir.
 *
 * Tercih sırası: MP4 (Instagram ve TikTok doğrudan kabul eder; yeni Chrome, Edge ve Safari) → WebM (Firefox ve
 * eski Chrome). Müzik ve efektler açıksa ses de aynı dosyaya girer. Hiçbir şey sunucuya gönderilmez; dosya doğrudan
 * bilgisayara iner.
 */

const MIME_TYPES = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"] as const;
/** Sesli kayıt: video + ses kodekleri birlikte (MP4: AAC, WebM: Opus). */
const MIME_TYPES_AUDIO = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"] as const;

export function recordingSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;
}

export function pickMimeType(withAudio = false): string | null {
  if (!recordingSupported()) return null;
  return (withAudio ? MIME_TYPES_AUDIO : MIME_TYPES).find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export interface Recording {
  /** Kaydı bitirir ve video dosyasını döndürür. */
  stop: () => Promise<{ blob: Blob; extension: "mp4" | "webm" }>;
}

/** Tuvali (ve verilirse sesi) kaydetmeye başlar. */
export function startRecording(canvas: HTMLCanvasElement, fps = 30, audio?: MediaStream): Recording {
  const audioTracks = audio?.getAudioTracks() ?? [];
  const mimeType = pickMimeType(audioTracks.length > 0);
  if (!mimeType) throw new Error("Bu tarayıcı video kaydını desteklemiyor.");
  const stream = canvas.captureStream(fps);
  for (const track of audioTracks) stream.addTrack(track);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start(250);

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          // Ses izleri ObaSound'a ait (önizlemede de çalar): yalnızca tuvalin görüntü izi durdurulur.
          stream.getVideoTracks().forEach((track) => track.stop());
          resolve({ blob: new Blob(chunks, { type: mimeType }), extension: mimeType.startsWith("video/mp4") ? "mp4" : "webm" });
        };
        recorder.stop();
      }),
  };
}

/** Dosyayı kullanıcının bilgisayarına indirir. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "obatales-bolum-3-2026-11-25.mp4" gibi bir dosya adı. */
export function reelFilename(slug: string, extension: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return `obatales-${slug}-${day}.${extension}`;
}
