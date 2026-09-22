"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader, Card, Button, Field, TextInput } from "@/components/ui";

export default function DashboardSettingsPage() {
  const { db, setDB } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [appName, setAppName] = useState(db.settings.appName);
  const [appSubtitle, setAppSubtitle] = useState(db.settings.appSubtitle);
  const [logoDataUrl, setLogoDataUrl] = useState(db.settings.logoDataUrl);
  const [saved, setSaved] = useState(false);

  /** Downscale so a logo fits comfortably in localStorage. */
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxW = 160;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setLogoDataUrl(canvas.toDataURL("image/png"));
        setSaved(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const submit = () => {
    setDB((prev) => ({
      ...prev,
      settings: {
        appName: appName.trim() || "Farm Manager",
        appSubtitle: appSubtitle.trim(),
        logoDataUrl,
      },
    }));
    setSaved(true);
  };

  return (
    <div>
      <PageHeader title="Dashboard Setting" subtitle="App name, subtitle and logo shown in the sidebar" />
      <Card title="Dashboard branding">
        <div className="max-w-md space-y-4">
          <Field label="App name">
            <TextInput
              value={appName}
              onChange={(e) => {
                setAppName(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
          <Field label="Subtitle">
            <TextInput
              value={appSubtitle}
              onChange={(e) => {
                setAppSubtitle(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-2">Logo</p>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-hairline bg-surface-2">
                {logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoDataUrl} alt="Logo preview" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm font-bold text-accent">{(appName.trim()[0] ?? "F").toUpperCase()}</span>
                )}
              </div>
              <Button small variant="ghost" onClick={() => fileRef.current?.click()}>
                Upload logo
              </Button>
              {logoDataUrl && (
                <Button
                  small
                  variant="ghost"
                  onClick={() => {
                    setLogoDataUrl(undefined);
                    setSaved(false);
                  }}
                >
                  Remove logo
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={submit}>Save changes</Button>
            {saved && <span className="text-xs text-good">Saved</span>}
          </div>
        </div>
      </Card>
    </div>
  );
}
