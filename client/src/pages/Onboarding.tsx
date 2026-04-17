import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, ArrowRight } from "lucide-react";
import phoenixLogo from "@assets/generated_images/phoenix_muted_olive_champagne.png";

interface ProfileData {
  firstName: string;
  age: number | null;
  height: number | null;
  currentWeight: number | null;
}

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: "",
    age: null,
    height: null,
    currentWeight: null,
  });

  const saveProfile = useMutation({
    mutationFn: async (data: ProfileData) => {
      const res = await fetch("/api/profile/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to save profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/chat");
    },
  });

  const handleSubmit = () => {
    saveProfile.mutate(profileData);
  };

  const isValid = () => {
    return (
      profileData.firstName.trim() !== "" &&
      profileData.age !== null &&
      profileData.age >= 13 &&
      profileData.height !== null &&
      profileData.height > 0 &&
      profileData.currentWeight !== null &&
      profileData.currentWeight > 0
    );
  };

  const updateField = <K extends keyof ProfileData>(field: K, value: ProfileData[K]) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center mx-auto mb-4 overflow-hidden">
            <img src={phoenixLogo} alt="NutriCore" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-xl font-display font-bold">Let's get you started</h1>
        </div>

        <Card className="bg-card/50 border-0">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={profileData.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                placeholder="Your name"
                className="bg-white/5 border-white/10"
                data-testid="input-first-name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min={13}
                max={120}
                value={profileData.age || ""}
                onChange={(e) => updateField("age", parseInt(e.target.value) || null)}
                placeholder="25"
                className="bg-white/5 border-white/10"
                data-testid="input-age"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  min={100}
                  max={250}
                  value={profileData.height || ""}
                  onChange={(e) => updateField("height", parseFloat(e.target.value) || null)}
                  placeholder="175"
                  className="bg-white/5 border-white/10"
                  data-testid="input-height"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentWeight">Weight (kg)</Label>
                <Input
                  id="currentWeight"
                  type="number"
                  min={30}
                  max={300}
                  step={0.1}
                  value={profileData.currentWeight || ""}
                  onChange={(e) => updateField("currentWeight", parseFloat(e.target.value) || null)}
                  placeholder="70"
                  className="bg-white/5 border-white/10"
                  data-testid="input-current-weight"
                />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!isValid() || saveProfile.isPending}
              className="w-full gradient-primary text-white mt-4"
              data-testid="button-continue"
            >
              {saveProfile.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
