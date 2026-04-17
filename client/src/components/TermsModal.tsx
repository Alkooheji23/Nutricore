import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Shield, FileText, Heart, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { useAcceptTerms } from "@/lib/api";
import { Link } from "wouter";

interface TermsModalProps {
  open: boolean;
  onAccept: () => void;
}

export function TermsModal({ open, onAccept }: TermsModalProps) {
  const [agreed, setAgreed] = useState(false);
  const acceptTerms = useAcceptTerms();

  const handleAccept = async () => {
    if (!agreed) return;
    try {
      await acceptTerms.mutateAsync();
      onAccept();
    } catch (error) {
      console.error("Failed to accept terms:", error);
    }
  };

  const handleDecline = () => {
    window.location.href = "/api/logout";
  };

  return (
    <Dialog open={open} modal>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] p-0 bg-card border-white/10"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-display">Terms & Conditions</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Please review and accept to continue
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] px-6">
          <div className="space-y-6 py-4">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <Shield className="w-5 h-5" />
                  <h3 className="font-semibold">Data Protection & Privacy</h3>
                </div>
                <Link href="/privacy" className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="link-full-privacy">
                  Full Policy <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="text-sm text-muted-foreground space-y-2 pl-7">
                <p>By using NutriCore, you acknowledge and agree that:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>We collect and store your fitness data, including workout logs, nutrition entries, health metrics, and any documents you upload.</li>
                  <li>Your data is used to provide personalized AI-powered fitness and nutrition guidance.</li>
                  <li>We implement industry-standard security measures to protect your personal information.</li>
                  <li>You may request deletion of your data at any time by contacting support.</li>
                  <li>We do not sell your personal data to third parties.</li>
                  <li>Anonymized, aggregated data may be used to improve our services.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-red-400">
                <Heart className="w-5 h-5" />
                <h3 className="font-semibold">Medical Disclaimer & Health Warnings</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-2 pl-7">
                <p className="font-medium text-foreground">IMPORTANT: NutriCore is NOT a medical service. All recommendations are for informational purposes only and are NOT medical advice.</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Not Medical Advice:</strong> All workout plans, nutrition recommendations, and supplement suggestions provided by NutriCore are general fitness information only. They are NOT a substitute for professional medical advice, diagnosis, or treatment.</li>
                  <li><strong>AI Margin of Error:</strong> Our AI-generated recommendations may contain inaccuracies. There is an inherent degree of error in all AI-generated content. You must verify all information and use your own judgment.</li>
                  <li><strong>Exercise with Caution:</strong> Always exercise within your capabilities and stop immediately if you experience pain, dizziness, or discomfort. Warm up properly and use correct form to prevent injury.</li>
                  <li><strong>Allergy Warning:</strong> Before following any diet plan or taking any supplements recommended by NutriCore, YOU MUST verify that you are not allergic to any ingredients. Check all food and supplement labels carefully. Consult a healthcare provider if you have known allergies or sensitivities.</li>
                  <li><strong>Supplement Risks:</strong> Supplements may interact with medications or have side effects. Always consult a qualified healthcare professional before starting any new supplement regimen.</li>
                  <li>Our AI trainer does NOT provide medical diagnoses, treatment recommendations, or prescriptions.</li>
                  <li>Always consult a qualified healthcare professional before starting any diet or exercise program, especially if you have pre-existing health conditions.</li>
                  <li>In case of a medical emergency, contact emergency services immediately - do not rely on this app.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-semibold">Assumption of Risk & Limitation of Liability</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-2 pl-7">
                <p>By using NutriCore, you acknowledge that:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Use at Your Own Risk:</strong> You assume full responsibility for any risks associated with using the fitness and nutrition guidance provided by this app.</li>
                  <li><strong>No Guarantees:</strong> We do not guarantee any specific results from following our recommendations.</li>
                  <li><strong>Limitation of Liability:</strong> NutriCore and its creators shall not be held liable for any injuries, health issues, or damages arising from the use of this application.</li>
                  <li><strong>AI Limitations:</strong> Our AI-generated content may occasionally be inaccurate. You are responsible for verifying any information and making informed decisions about your health.</li>
                  <li><strong>Physical Activity Risks:</strong> Exercise carries inherent risks of injury. You are responsible for exercising safely and within your capabilities.</li>
                  <li><strong>Estimated Data & Calculations:</strong> Calorie burn estimates, BMR (Basal Metabolic Rate), TDEE (Total Daily Energy Expenditure), and other fitness metrics displayed in the app are <strong>calculated estimates based on scientific formulas</strong> (such as Mifflin-St Jeor and Harris-Benedict equations). These are NOT precise measurements. Actual calorie expenditure varies based on individual metabolism, genetics, body composition, and other factors. For accurate biometric data, we recommend using a certified fitness wearable device with heart rate monitoring.</li>
                  <li><strong>Nutritional Data Accuracy:</strong> Calorie and macro information for foods may be sourced from third-party databases and may contain inaccuracies. Always verify nutritional information from product labels when precision is required.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-semibold">Prohibited Content & User Conduct</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-2 pl-7">
                <p>By using NutriCore, you agree that you will NOT:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Upload Illegal Content:</strong> You shall not upload, share, or communicate any content that is illegal, unlawful, harmful, threatening, abusive, harassing, defamatory, obscene, or otherwise objectionable under the laws of the Kingdom of Bahrain or any applicable jurisdiction.</li>
                  <li><strong>Prohibited Materials:</strong> This includes but is not limited to: illegal substances, weapons, pornographic material, content promoting violence or terrorism, copyrighted material you do not own, and any content that violates the rights of others.</li>
                  <li><strong>Legal Consequences:</strong> Violation of these terms may result in immediate account termination and may be reported to the appropriate legal authorities. <strong>Users may be subject to criminal prosecution and civil liability under applicable laws.</strong></li>
                  <li><strong>Monitoring:</strong> We reserve the right to review uploaded content and communications to ensure compliance with these terms and applicable laws.</li>
                  <li><strong>Cooperation with Authorities:</strong> We will cooperate fully with law enforcement agencies and court orders requesting disclosure of user information in connection with illegal activities.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-blue-400">
                <FileText className="w-5 h-5" />
                <h3 className="font-semibold">Governing Law</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-2 pl-7">
                <p>These Terms & Conditions shall be governed by and construed in accordance with the Laws & Regulations of the Kingdom of Bahrain. Any disputes arising from or related to the use of NutriCore shall be subject to the exclusive jurisdiction of the courts of the Kingdom of Bahrain.</p>
              </div>
            </section>

            <section className="space-y-3">
              <div className="text-sm text-muted-foreground pl-7">
                <p>By checking the box below and clicking "I Agree", you confirm that you have read, understood, and agree to be bound by these Terms & Conditions in accordance with the Laws & Regulations of the Kingdom of Bahrain.</p>
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="p-6 pt-4 border-t border-white/5 space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox 
              id="terms-checkbox" 
              checked={agreed} 
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-0.5"
              data-testid="checkbox-accept-terms"
            />
            <Label 
              htmlFor="terms-checkbox" 
              className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
            >
              I have read and agree to the Terms & Conditions, including the Data Protection policy, Medical Disclaimer, and Governing Law provisions. I understand that NutriCore does not provide medical advice, that I use this service at my own risk, and that these terms are governed by the Laws & Regulations of the Kingdom of Bahrain.
            </Label>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 border-white/10 hover:bg-white/5"
              onClick={handleDecline}
              data-testid="button-decline-terms"
            >
              Decline & Sign Out
            </Button>
            <Button 
              className="flex-1 gradient-primary text-white"
              onClick={handleAccept}
              disabled={!agreed || acceptTerms.isPending}
              data-testid="button-accept-terms"
            >
              {acceptTerms.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "I Agree & Continue"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TermsModal;
