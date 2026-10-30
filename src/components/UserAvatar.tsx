"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useRef, useState } from "react";
import { getInitials } from "@/lib/constants";
import { CameraIcon, LinkIcon, TrashIcon, UploadIcon } from "./Icons";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-5 w-5 text-[10px] rounded-md",
  sm: "h-6 w-6 text-[10px] rounded-md",
  md: "h-8 w-8 text-xs rounded-lg",
  lg: "h-10 w-10 text-sm rounded-xl",
  xl: "h-14 w-14 text-base rounded-2xl",
  "2xl": "h-[72px] w-[72px] text-lg rounded-2xl",
};

interface UserAvatarProps {
  name: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}

export function UserAvatar({
  name,
  avatarColor = "#2563eb",
  avatarUrl,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(avatarUrl && avatarUrl !== failedUrl);
  const sizeClass = SIZE_CLASSES[size];

  if (showImage && avatarUrl) {
    return (
      <span
        className={`relative inline-flex items-center justify-center overflow-hidden bg-slate-100 ring-1 ring-slate-900/10 shrink-0 ${sizeClass} ${className}`}
      >
        <img
          src={avatarUrl}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(avatarUrl)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      style={{ backgroundColor: avatarColor }}
      className={`inline-flex items-center justify-center text-white font-semibold select-none ring-1 ring-inset ring-black/8 shrink-0 ${sizeClass} ${className}`}
    >
      {getInitials(name || "U")}
    </span>
  );
}

/**
 * Center-crops and resizes any browser-decodable image file to a crisp 256x256 Data URI.
 */
export async function compressAvatarFile(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"].includes(file.type.toLowerCase())) {
    throw new Error("សូមជ្រើសរើសឯកសាររូបភាព (JPG, PNG, WebP ឬ GIF)។");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("ទំហំឯកសារធំលើស 12MB សូមជ្រើសរើសរូបភាពតូចជាងនេះ។");
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("មិនអាចអានឯកសាររូបភាពបានទេ។"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("ឯកសាររូបភាពមិនត្រឹមត្រូវទេ។"));
    el.src = rawDataUrl;
  });

  const targetSize = 256;
  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("មិនអាចដំណើរការរូបភាពលើ Browser បានទេ។");
  }

  const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const sx = Math.max(0, ((img.naturalWidth || img.width) - side) / 2);
  const sy = Math.max(0, ((img.naturalHeight || img.height) - side) / 2);

  ctx.clearRect(0, 0, targetSize, targetSize);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, targetSize, targetSize);

  const webp = canvas.toDataURL("image/webp", 0.86);
  if (webp.startsWith("data:image/webp")) {
    return webp;
  }
  return canvas.toDataURL("image/jpeg", 0.88);
}

interface AvatarPickerProps {
  fullName: string;
  avatarColor: string;
  avatarUrl: string | null;
  colors: string[];
  onChangeColor: (color: string) => void;
  onChangeAvatarUrl: (url: string | null) => void;
  onProcessingChange?: (processing: boolean) => void;
  compact?: boolean;
}

export function AvatarPicker({
  fullName,
  avatarColor,
  avatarUrl,
  colors,
  onChangeColor,
  onChangeAvatarUrl,
  onProcessingChange,
  compact = false,
}: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showUrlBox, setShowUrlBox] = useState(false);
  const [urlDraft, setUrlDraft] = useState(
    avatarUrl && avatarUrl.startsWith("http") ? avatarUrl : ""
  );
  const [localErr, setLocalErr] = useState<string | null>(null);

  async function handlePickedFile(file: File | undefined | null) {
    if (!file) return;
    if (processing) return;
    setLocalErr(null);
    setProcessing(true);
    onProcessingChange?.(true);
    try {
      const optimized = await compressAvatarFile(file);
      onChangeAvatarUrl(optimized);
      setShowUrlBox(false);
    } catch (err: unknown) {
      setLocalErr(
        err instanceof Error ? err.message : "មិនអាចបញ្ចូលរូបភាពបានទេ។"
      );
    } finally {
      setProcessing(false);
      onProcessingChange?.(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function applyUrlDraft() {
    const clean = urlDraft.trim();
    if (!clean) {
      onChangeAvatarUrl(null);
      setShowUrlBox(false);
      return;
    }
    try {
      const parsed = new URL(clean);
      if (clean.length > 2048 || !["https:", "http:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
        throw new Error("invalid image URL");
      }
    } catch {
      setLocalErr("តំណភ្ជាប់រូបភាពត្រូវផ្ដើមដោយ https:// ឬ http:// ហើយមានទម្រង់ត្រឹមត្រូវ។");
      return;
    }
    setLocalErr(null);
    onChangeAvatarUrl(clean);
    setShowUrlBox(false);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        void handlePickedFile(file);
      }}
      className={`rounded-xl border transition p-3.5 ${
        dragging
          ? "border-blue-500 bg-blue-50/50"
          : "border-slate-200/90 bg-slate-50/70"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label="ជ្រើសរើសរូបភាពគណនី"
        className="hidden"
        onChange={(e) => void handlePickedFile(e.target.files?.[0])}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
        {/* Clickable Live Avatar Preview */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          title="ចុចដើម្បីជ្រើសរើសរូបភាព"
          aria-label="ជ្រើសរើសរូបភាពគណនី"
          disabled={processing}
          className="group relative self-start shrink-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 cursor-pointer disabled:opacity-60"
        >
          <UserAvatar
            name={fullName || "U"}
            avatarColor={avatarColor}
            avatarUrl={avatarUrl}
            size={compact ? "xl" : "2xl"}
          />
          <span className="absolute inset-0 rounded-2xl bg-slate-900/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
            <CameraIcon className="w-5 h-5" />
          </span>
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <div className="text-xs font-semibold text-slate-800">
              រូបភាពគណនីអ្នកប្រើប្រាស់
            </div>
            <p className="text-[11px] text-slate-500">
              ចុចជ្រើសរើស ឬទាញរូបភាពដាក់ទីនេះ (JPG, PNG, WebP — កាត់ទំហំស្វ័យប្រវត្តិ)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={processing}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-medium shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <UploadIcon className="w-3.5 h-3.5 text-slate-600" />
              <span>
                {processing
                  ? "កំពុងរៀបចំ..."
                  : avatarUrl
                  ? "ប្ដូររូបភាព"
                  : "ជ្រើសរើសរូបភាព"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLocalErr(null);
                setShowUrlBox((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-medium transition cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>ដាក់ Link</span>
            </button>

            {avatarUrl && (
              <button
                type="button"
                onClick={() => {
                  onChangeAvatarUrl(null);
                  setUrlDraft("");
                  setLocalErr(null);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-xs font-medium transition cursor-pointer"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                <span>លុបរូប</span>
              </button>
            )}
          </div>

          {showUrlBox && (
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
              <button
                type="button"
                onClick={applyUrlDraft}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer shrink-0"
              >
                ដាក់រូប
              </button>
            </div>
          )}

          {localErr && (
            <div role="alert" className="text-[11px] text-rose-600 font-medium">
              {localErr}
            </div>
          )}

          {/* Fallback Color Picker */}
          <div className="pt-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">ពណ៌តំណាង៖</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChangeColor(c)}
                  style={{ backgroundColor: c }}
                  title={c}
                  aria-label={`ជ្រើសរើសពណ៌ ${c}`}
                  aria-pressed={avatarColor === c}
                  className={`h-5 w-5 rounded-full cursor-pointer transition ${
                    avatarColor === c
                      ? "ring-2 ring-offset-2 ring-slate-900 scale-105"
                      : "opacity-75 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
