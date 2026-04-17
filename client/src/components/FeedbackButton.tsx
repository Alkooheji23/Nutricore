import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Star, Send, X, Loader2, Mail } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const categories = [
  { value: "general", labelEn: "General Feedback", labelAr: "ملاحظات عامة" },
  { value: "ai_trainer", labelEn: "My Trainer", labelAr: "مدربي" },
  { value: "tracker", labelEn: "Daily Tracker", labelAr: "المتابعة اليومية" },
  { value: "ui", labelEn: "Design & Interface", labelAr: "التصميم والواجهة" },
  { value: "feature_request", labelEn: "Feature Request", labelAr: "طلب ميزة جديدة" },
];

export function FeedbackButton({ variant = "floating" }: { variant?: "floating" | "inline" }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState("general");
  const [comment, setComment] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const { toast } = useToast();
  const { t, language } = useTranslation();

  const submitFeedback = useMutation({
    mutationFn: async (data: { rating: number; category: string; comment: string; userEmail?: string; pageUrl: string }) => {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to submit feedback");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: language === 'ar' ? "شكراً لملاحظاتك!" : "Thank you for your feedback!",
        description: language === 'ar' ? "رأيك يساعدنا على التحسين" : "Your input helps us improve",
      });
      setOpen(false);
      setRating(0);
      setCategory("general");
      setComment("");
      setUserEmail("");
    },
    onError: () => {
      toast({
        title: language === 'ar' ? "حدث خطأ" : "Error",
        description: language === 'ar' ? "فشل إرسال الملاحظات" : "Failed to submit feedback",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      toast({
        title: language === 'ar' ? "اختر تقييم" : "Select a rating",
        description: language === 'ar' ? "يرجى اختيار عدد النجوم" : "Please select a star rating",
        variant: "destructive",
      });
      return;
    }
    submitFeedback.mutate({
      rating,
      category,
      comment,
      userEmail: userEmail || undefined,
      pageUrl: window.location.pathname,
    });
  };

  const buttonContent = (
    <Button
      variant={variant === "floating" ? "default" : "outline"}
      size={variant === "floating" ? "icon" : "sm"}
      className={variant === "floating" 
        ? "fixed bottom-20 right-4 z-50 rounded-full w-12 h-12 shadow-lg bg-primary hover:bg-primary/90" 
        : ""}
      data-testid="button-feedback"
    >
      <MessageSquare className={variant === "floating" ? "w-5 h-5" : "w-4 h-4 mr-2"} />
      {variant === "inline" && (language === 'ar' ? "ملاحظات" : "Feedback")}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {buttonContent}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            {language === 'ar' ? "شاركنا رأيك" : "Share Your Feedback"}
          </DialogTitle>
          <DialogDescription>
            {language === 'ar' 
              ? "رأيك يساعدنا على تحسين التطبيق"
              : "Your feedback helps us improve NutriCore"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{language === 'ar' ? "كيف تقيم تجربتك؟" : "How would you rate your experience?"}</Label>
            <div className="flex gap-1 justify-center py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                  data-testid={`button-star-${star}`}
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoverRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{language === 'ar' ? "الفئة" : "Category"}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-feedback-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {language === 'ar' ? cat.labelAr : cat.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{language === 'ar' ? "تعليقات (اختياري)" : "Comments (optional)"}</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={language === 'ar' ? "أخبرنا برأيك..." : "Tell us what you think..."}
              rows={3}
              data-testid="input-feedback-comment"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              {language === 'ar' ? "بريدك الإلكتروني (للمتابعة)" : "Your email (for follow-up)"}
            </Label>
            <Input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder={language === 'ar' ? "example@email.com" : "example@email.com"}
              data-testid="input-feedback-email"
            />
            <p className="text-xs text-muted-foreground">
              {language === 'ar' ? "اختياري - سنتواصل معك إذا احتجنا لمزيد من التفاصيل" : "Optional - we'll reach out if we need more details"}
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-feedback">
            {language === 'ar' ? "إلغاء" : "Cancel"}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitFeedback.isPending}
            data-testid="button-submit-feedback"
          >
            {submitFeedback.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {language === 'ar' ? "إرسال" : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
