import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, CreditCard, LogOut, FileText, CheckCircle, AlertCircle, Loader2, AlertTriangle, User, Camera, Gift, Copy, Share2, Globe, MessageSquare, ChevronRight, Smartphone, Ruler } from "lucide-react";
import { PremiumIcon } from "@/components/ui/premium-icons";
import { FeedbackButton } from "@/components/FeedbackButton";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/api";
import { ObjectUploader } from "@/components/ObjectUploader";
import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface HealthDocument {
  id: string;
  fileName: string;
  fileType: string;
  documentType: string;
  analysisResult: any;
  createdAt: string;
}

interface DocumentsResponse {
  documents: HealthDocument[];
  uploadsThisMonth: number;
  monthlyLimit: number;
  remainingUploads: number;
}

export default function Profile() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);

  const { data: documentsData, isLoading: docsLoading } = useQuery<DocumentsResponse>({
    queryKey: ['/api/documents'],
  });

  interface ReferralStats {
    referralCode: string | null;
    totalReferrals: number;
    paidReferrals: number;
    freeMonthsEarned: number;
    referralsNeededForReward: number;
    progressToNextReward: number;
  }

  const { data: referralStats, isLoading: referralLoading } = useQuery<ReferralStats>({
    queryKey: ['/api/referral/stats'],
  });

  const [profileForm, setProfileForm] = useState({
    username: '',
    firstName: '',
    lastName: '',
  });
  const [profileFormDirty, setProfileFormDirty] = useState(false);

  // Initialize profile form when user data loads
  useEffect(() => {
    if (user && !profileFormDirty) {
      setProfileForm({
        username: user.username || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
      });
    }
  }, [user, profileFormDirty]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { username?: string; firstName?: string; lastName?: string }) => {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update profile');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setProfileFormDirty(false);
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const handleProfileFormChange = (field: string, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
    setProfileFormDirty(true);
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileForm);
  };

  const generateCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/referral/code', {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to generate referral code');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/referral/stats'] });
    },
  });

  const copyReferralLink = () => {
    const code = referralStats?.referralCode;
    if (code) {
      const link = `${window.location.origin}?ref=${code}`;
      navigator.clipboard.writeText(link);
      toast({
        title: "Link copied!",
        description: "Share this link with friends to earn free months.",
      });
    }
  };

  const shareToWhatsApp = () => {
    const code = referralStats?.referralCode;
    if (code) {
      const link = `${window.location.origin}?ref=${code}`;
      const message = `Join me on NutriCore - Your AI Fitness Coach! Use my link to sign up: ${link}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/account/deactivate', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to deactivate account');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Account deactivated",
        description: "Your account has been deactivated. You can reactivate it by signing in again.",
      });
      queryClient.clear();
      setLocation('/');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateWeightUnitMutation = useMutation({
    mutationFn: async (weightUnit: 'kg' | 'lb') => {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ weightUnit }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update unit preference');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({ title: "Units updated", description: "Your measurement preference has been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: async ({ fileName, fileType, uploadURL }: { fileName: string; fileType: string; uploadURL: string }) => {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, fileType, uploadURL }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to save document');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: "Document uploaded",
        description: "Your health document has been saved successfully.",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    const res = await fetch('/api/documents/upload-url', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to get upload URL');
    }
    const { uploadURL } = await res.json();
    return {
      method: 'PUT' as const,
      url: uploadURL,
    };
  };

  const handleUploadComplete = async (result: any) => {
    const successfulUpload = result.successful?.[0];
    if (successfulUpload) {
      await createDocumentMutation.mutateAsync({
        fileName: successfulUpload.name || 'document',
        fileType: successfulUpload.type || 'application/octet-stream',
        uploadURL: successfulUpload.uploadURL,
      });
    }
  };

  const remainingUploads = documentsData?.remainingUploads ?? 3;
  const canUpload = remainingUploads > 0;

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPEG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingProfilePic(true);
    try {
      const urlRes = await fetch('/api/user/profile-picture/upload-url', {
        method: 'POST',
        credentials: 'include',
      });
      if (!urlRes.ok) throw new Error('Failed to get upload URL');
      const { uploadURL, publicURL } = await urlRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });
      if (!uploadRes.ok) throw new Error('Failed to upload image');

      const saveRes = await fetch('/api/user/profile-picture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: publicURL }),
        credentials: 'include',
      });
      if (!saveRes.ok) throw new Error('Failed to save profile picture');

      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Profile picture updated",
        description: "Your new profile picture has been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setUploadingProfilePic(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-6">
        <div className="relative group">
          <Avatar className="w-24 h-24 border-4 border-card shadow-xl">
            <AvatarImage src={user?.profileImageUrl?.startsWith('/objects/') ? user.profileImageUrl : (user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.firstName || 'User'}`)} />
            <AvatarFallback>{user?.firstName?.[0] || 'U'}{user?.lastName?.[0] || ''}</AvatarFallback>
          </Avatar>
          <label 
            className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            data-testid="button-upload-profile-pic"
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleProfilePicUpload}
              disabled={uploadingProfilePic}
            />
            {uploadingProfilePic ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Camera className="w-6 h-6 text-white" />
            )}
          </label>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">{user?.firstName} {user?.lastName}</h1>
          {user?.username && (
            <p className="text-muted-foreground text-sm mt-0.5">@{user.username}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-primary/20 text-primary border-0">
              Member
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Hover over photo to change</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          
          <Card className="bg-card border-white/5">
            <CardHeader>
              <CardTitle className="text-white">Personal Information</CardTitle>
              <CardDescription>Manage your account details and create your unique username.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                  <Input 
                    value={profileForm.username}
                    onChange={(e) => handleProfileFormChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="choose_a_username"
                    className="bg-white/5 border-white/10 pl-8"
                    data-testid="input-username"
                  />
                </div>
                <p className="text-xs text-muted-foreground">3-30 characters, letters, numbers, and underscores only</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input 
                    value={profileForm.firstName}
                    onChange={(e) => handleProfileFormChange('firstName', e.target.value)}
                    className="bg-white/5 border-white/10"
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input 
                    value={profileForm.lastName}
                    onChange={(e) => handleProfileFormChange('lastName', e.target.value)}
                    className="bg-white/5 border-white/10"
                    data-testid="input-last-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  value={user?.email || ''} 
                  disabled 
                  className="bg-white/5 border-white/10 opacity-50 cursor-not-allowed"
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <Button 
                onClick={handleSaveProfile}
                disabled={!profileFormDirty || updateProfileMutation.isPending}
                className="bg-primary text-primary-foreground"
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Health Documents</CardTitle>
                  <CardDescription>Upload lab results and health tests for AI analysis.</CardDescription>
                </div>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {remainingUploads} of 3 uploads left this month
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ObjectUploader
                maxFileSize={10485760}
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                disabled={!canUpload}
                buttonClassName="w-full h-24 border-2 border-dashed border-white/10 bg-white/5 hover:bg-white/10 hover:border-primary/50 transition-all"
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-6 h-6 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {canUpload ? 'Click to upload health document (PDF or Image)' : 'Monthly upload limit reached'}
                  </span>
                </div>
              </ObjectUploader>

              {docsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : documentsData?.documents && documentsData.documents.length > 0 ? (
                <div className="space-y-3 mt-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Uploaded Documents</h4>
                  {documentsData.documents.map((doc) => (
                    <div 
                      key={doc.id} 
                      className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/5"
                      data-testid={`document-${doc.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.analysisResult ? (
                          <Badge className="bg-green-500/20 text-green-400 border-0">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Analyzed
                          </Badge>
                        ) : analyzingDocId === doc.id ? (
                          <Badge className="bg-blue-500/20 text-blue-400 border-0">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Analyzing...
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-0">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No documents uploaded yet. Upload your first health test to get AI-powered insights.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-white/5">
            <CardHeader>
              <CardTitle className="text-white">Subscription & Billing</CardTitle>
              <CardDescription>Manage your membership.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Current Plan</p>
                  <p className="text-sm text-muted-foreground">
                    Premium membership - $90/year or $9.99/month
                  </p>
                </div>
                <Badge variant="outline" className="border-primary text-primary">
                  Active
                </Badge>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" className="border-white/10">
                  Manage Subscription
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-primary" />
                Invite Friends
              </CardTitle>
              <CardDescription>Earn 1 free month for every 3 friends who subscribe!</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {referralLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : referralStats?.referralCode ? (
                <>
                  <div className="p-3 bg-black/20 rounded-lg border border-white/10">
                    <p className="text-xs text-muted-foreground mb-1">Your referral code</p>
                    <p className="text-lg font-mono font-bold text-primary" data-testid="text-referral-code">
                      {referralStats.referralCode}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={copyReferralLink}
                      variant="outline" 
                      className="flex-1 border-primary/30 hover:bg-primary/10"
                      data-testid="button-copy-referral"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </Button>
                    <Button 
                      onClick={shareToWhatsApp}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      data-testid="button-share-whatsapp"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      WhatsApp
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress to next free month</span>
                      <span className="text-primary font-medium">
                        {referralStats.progressToNextReward}/3 referrals
                      </span>
                    </div>
                    <Progress 
                      value={(referralStats.progressToNextReward / 3) * 100} 
                      className="h-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <p className="text-2xl font-bold text-white">{referralStats.paidReferrals}</p>
                      <p className="text-xs text-muted-foreground">Paid Referrals</p>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{referralStats.freeMonthsEarned}</p>
                      <p className="text-xs text-muted-foreground">Free Months Earned</p>
                    </div>
                  </div>
                </>
              ) : (
                <Button 
                  onClick={() => generateCodeMutation.mutate()}
                  className="w-full bg-primary"
                  disabled={generateCodeMutation.isPending}
                  data-testid="button-generate-referral"
                >
                  {generateCodeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Gift className="w-4 h-4 mr-2" />
                  )}
                  Get Your Referral Link
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                Language / اللغة
              </CardTitle>
              <CardDescription>Choose your preferred language</CardDescription>
            </CardHeader>
            <CardContent>
              <LanguageSwitcher variant="full" />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-teal-500/10 border-green-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Ruler className="w-5 h-5 text-green-400" />
                Measurement Units
              </CardTitle>
              <CardDescription>Choose between metric and imperial units</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant={(user as any)?.weightUnit === 'kg' || !(user as any)?.weightUnit ? 'default' : 'outline'}
                  className={`flex-1 ${(user as any)?.weightUnit === 'kg' || !(user as any)?.weightUnit ? 'bg-primary' : 'border-white/10'}`}
                  onClick={() => updateWeightUnitMutation.mutate('kg')}
                  disabled={updateWeightUnitMutation.isPending}
                  data-testid="button-unit-metric"
                >
                  <span className="font-medium">Metric</span>
                  <span className="text-xs ml-2 opacity-70">kg, cm</span>
                </Button>
                <Button
                  variant={(user as any)?.weightUnit === 'lb' ? 'default' : 'outline'}
                  className={`flex-1 ${(user as any)?.weightUnit === 'lb' ? 'bg-primary' : 'border-white/10'}`}
                  onClick={() => updateWeightUnitMutation.mutate('lb')}
                  disabled={updateWeightUnitMutation.isPending}
                  data-testid="button-unit-imperial"
                >
                  <span className="font-medium">Imperial</span>
                  <span className="text-xs ml-2 opacity-70">lb, in</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-400" />
                Send Feedback
              </CardTitle>
              <CardDescription>Help us improve NutriCore</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Share your experience, report issues, or suggest new features. Your feedback helps us build a better app for everyone.
              </p>
              <FeedbackButton variant="inline" />
            </CardContent>
          </Card>

          <Card className="bg-destructive/10 border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Deactivate Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Temporarily disable your account. Your data will be retained for 30 days and you can reactivate it by signing in again.
              </p>
              <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    data-testid="button-deactivate-account"
                  >
                    Deactivate Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will temporarily deactivate your account. Your data will be retained for 30 days during which you can reactivate by signing in again. After 30 days, your data may be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deactivateMutation.mutate()}
                      disabled={deactivateMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="button-confirm-deactivate"
                    >
                      {deactivateMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Deactivating...
                        </>
                      ) : (
                        'Yes, deactivate my account'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
          
          <Button 
            variant="outline" 
            className="w-full gap-2 border-white/10 hover:bg-white/5"
            onClick={async () => {
              // Clear session cache before logout (for PWA persistence)
              try {
                localStorage.removeItem('nutricore_user_cache');
                localStorage.removeItem('nutricore_session_active');
              } catch (e) {
                // Ignore localStorage errors
              }
              // Also clear IndexedDB
              try {
                const request = indexedDB.open('nutricore_auth', 1);
                request.onsuccess = () => {
                  const db = request.result;
                  const tx = db.transaction('session', 'readwrite');
                  tx.objectStore('session').clear();
                };
              } catch (e) {
                // Ignore IndexedDB errors
              }
              window.location.href = "/api/logout";
            }}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
