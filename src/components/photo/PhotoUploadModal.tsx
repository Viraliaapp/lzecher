"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Upload, Camera, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { storage, auth } from "@/lib/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onUploadComplete: (photoUrl: string) => void;
}

async function getCroppedImg(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const size = 600; // output 600x600
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    size,
    size
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.85);
  });
}

export function PhotoUploadModal({
  open,
  onOpenChange,
  projectId,
  onUploadComplete,
}: Props) {
  const t = useTranslations("photo");
  const [file, setFile] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faceStatus, setFaceStatus] = useState<"pending" | "valid" | "invalid">("pending");
  const inputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError(t("invalidType"));
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError(t("tooLarge"));
      return;
    }

    setError(null);
    setFaceStatus("valid"); // Skip face detection for now - will rely on server-side SafeSearch
    const reader = new FileReader();
    reader.onload = () => setFile(reader.result as string);
    reader.readAsDataURL(selected);
  }

  async function handleUpload() {
    if (!file || !croppedArea) return;

    setUploading(true);
    setError(null);

    try {
      const croppedBlob = await getCroppedImg(file, croppedArea);
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setError(t("notAuthenticated"));
        return;
      }

      const storageRef = ref(storage, `lzecher/photos/${uid}/${projectId}.jpg`);
      await uploadBytes(storageRef, croppedBlob, {
        contentType: "image/jpeg",
      });
      const downloadUrl = await getDownloadURL(storageRef);

      // Update project doc with photo URL via API
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch("/api/projects/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, photoUrl: downloadUrl, idToken }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t("uploadError"));
        return;
      }

      onUploadComplete(downloadUrl);
      handleClose();
    } catch (err) {
      console.error("Upload error:", err);
      setError(t("uploadError"));
    } finally {
      setUploading(false);
    }
  }

  function handleClose() {
    setFile(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setError(null);
    setFaceStatus("pending");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        {!file ? (
          <div className="space-y-4">
            {/* Drop zone */}
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-navy/20 rounded-xl p-8 hover:border-gold/50 hover:bg-gold/5 transition-all text-center group"
            >
              <Upload className="h-8 w-8 mx-auto text-muted group-hover:text-gold mb-3" />
              <p className="text-sm font-medium text-navy">{t("dropzone")}</p>
              <p className="text-xs text-muted mt-1">{t("formats")}</p>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-xs text-center text-muted font-serif italic">
              {t("dignity")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Crop area */}
            <div className="relative w-full h-64 rounded-lg overflow-hidden bg-navy/5">
              <Cropper
                image={file}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            {/* Zoom control */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">{t("zoom")}</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            {t("cancel")}
          </Button>
          {file && (
            <Button
              onClick={handleUpload}
              disabled={uploading || !croppedArea}
            >
              {uploading ? <Spinner className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {t("upload")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
