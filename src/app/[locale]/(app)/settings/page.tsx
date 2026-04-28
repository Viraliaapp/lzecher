"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { logout } from "@/lib/firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export default function SettingsPage() {
  const t = useTranslations("common");
  const { user, profile } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "lzecher_users", user.uid), {
        displayName: displayName.trim() || null,
        language: locale,
      });
      toast.success(t("success"));
    } catch {
      toast.error(t("error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
          <Settings className="h-5 w-5 text-gold-deep" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-navy">{t("settings")}</h1>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.photoURL || undefined} />
                <AvatarFallback className="text-lg">
                  {(profile?.displayName || user?.email || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-navy">{profile?.displayName || user?.email}</p>
                <p className="text-sm text-muted">{user?.email}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-navy mb-1 block">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {t("save")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <Button variant="destructive" onClick={handleLogout} className="w-full">
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
