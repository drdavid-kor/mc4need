import React, { useState } from "react";
import { t } from "./i18n";
export function Cover({
  scene,
  url,
  large = false,
}: {
  scene: string;
  url?: string | null;
  large?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const custom = !!url && failed !== url;
  const category = ["birthday", "training", "basketball"].includes(scene)
    ? scene
    : "other";
  return (
    <figure className={`need-cover ${large ? "large" : ""}`}>
      <img
        src={custom ? url! : `/images/covers/${category}.webp`}
        onError={() => {
          if (custom) setFailed(url!);
        }}
        alt={custom ? t("发起方提供的需求配图") : t("餐食共享场景插画")}
        loading={large ? "eager" : "lazy"}
        width="1536"
        height="1024"
      />
      <figcaption>
        {custom ? t("发起方配图") : t("AI 场景插画 · 非实景照片")}
      </figcaption>
    </figure>
  );
}
async function stripMetadata(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const chunks: Uint8Array[] = [];
  for (let pos = 12; pos + 8 <= bytes.length;) {
    const tag = new TextDecoder().decode(bytes.slice(pos, pos + 4));
    const size = view.getUint32(pos + 4, true);
    const end = pos + 8 + size + (size % 2);
    if (end > bytes.length)
      throw new Error(t("图片压缩后仍过大，请选择更小的图片"));
    if (["VP8X", "VP8 ", "VP8L", "ALPH"].includes(tag)) {
      const chunk = bytes.slice(pos, end);
      if (tag === "VP8X") chunk[8] &= 0x10;
      chunks.push(chunk);
    }
    pos = end;
  }
  const output = new Uint8Array(
    12 + chunks.reduce((sum, c) => sum + c.length, 0),
  );
  output.set(bytes.slice(0, 12));
  new DataView(output.buffer).setUint32(4, output.length - 8, true);
  let at = 12;
  for (const chunk of chunks) {
    output.set(chunk, at);
    at += chunk.length;
  }
  return new Blob([output], { type: "image/webp" });
}
async function normalize(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10000000
  )
    throw new Error(t("请选择 10 MB 以内的 JPG、PNG 或 WebP 图片"));
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40000000)
      throw new Error(t("图片尺寸过大，请缩小后重试"));
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f6f1e7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.5, 0.35]) {
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/webp", quality),
      );
      if (blob?.type === "image/webp" && blob.size <= 400000)
        return stripMetadata(blob);
    }
    throw new Error(t("图片压缩后仍过大，请选择更小的图片"));
  } finally {
    bitmap.close();
  }
}
export function CoverEditor({
  need,
  refresh,
}: {
  need: any;
  refresh: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("");
  async function choose(f?: File) {
    setMsg("");
    setFile(null);
    setConsent(false);
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    if (!f) return;
    try {
      const blob = await normalize(f);
      const clean = new File([blob], "cover.webp", { type: "image/webp" });
      setFile(clean);
      setPreview(URL.createObjectURL(clean));
    } catch (e: any) {
      setMsg(e.message);
    }
  }
  async function save(remove = false) {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`/api/needs/${need.id}/cover`, {
        method: remove ? "DELETE" : "PUT",
        headers: remove
          ? {}
          : {
              "Content-Type": "image/webp",
              "X-Public-Image-Consent": String(consent),
            },
        body: remove ? undefined : file,
      });
      if (!r.ok) {
        const v: any = await r.json();
        throw new Error(t(v.error));
      }
      setFile(null);
      setConsent(false);
      if (preview) URL.revokeObjectURL(preview);
      setPreview("");
      setMsg(t("配图已更新"));
      refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="cover-editor">
      <summary>{t("管理配图")}</summary>
      <p>{t("可选上传；未上传时使用类别默认插画。图片将在需求公开后展示。")}</p>
      <Cover
        scene={need.scene}
        url={
          preview ||
          (need.coverRevision
            ? `/api/private/needs/${need.id}/cover?v=${need.coverRevision}`
            : null)
        }
      />
      <label>
        {t("选择配图")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => void choose(e.target.files?.[0])}
        />
      </label>
      <p className="muted">
        {t(
          "支持 JPG、PNG、WebP，最大 10 MB；上传前在本机压缩并去除照片元数据。请勿上传含私人联系方式的图片。",
        )}
      </p>
      {file && (
        <>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {t("我有权公开此图片，涉及人物已获得所需许可。")}
          </label>
          <button
            className="button dark small"
            disabled={busy || !consent}
            onClick={() => void save()}
          >
            {busy ? t("上传中…") : t("保存配图")}
          </button>
        </>
      )}
      {need.coverRevision && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void save(true)}
        >
          {t("移除配图，恢复默认插画")}
        </button>
      )}
      {msg && <p role="status">{msg}</p>}
    </details>
  );
}
