import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Database, Eye, Lock, Globe, Mail, Trash2, Users, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import phoenixLogo from "@assets/generated_images/phoenix_muted_olive_champagne.png";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            className="mb-4 text-muted-foreground hover:text-foreground"
            onClick={() => window.location.href = '/'}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          
          <div className="flex items-center gap-4 mb-6">
            <img src={phoenixLogo} alt="NutriCore" className="w-16 h-16" />
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Privacy Policy</h1>
              <p className="text-muted-foreground">Last updated: December 6, 2025</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-white/10">
            <CardContent className="p-6">
              <p className="text-muted-foreground leading-relaxed">
                NutriCore ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our fitness and nutrition application. Please read this policy carefully. By using NutriCore, you consent to the data practices described in this policy.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/10">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Information We Collect</h2>
              </div>
              
              <div className="space-y-4 text-sm text-muted-foreground pl-13">
                <div>
                  <h3 className="font-medium text-foreground mb-2">Personal Information</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Name and email address (from your account)</li>
                    <li>Profile information you provide (age, weight, height, fitness goals)</li>
                    <li>Profile photo (if provided)</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-medium text-foreground mb-2">Fitness & Health Data</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Workout logs and exercise history</li>
                    <li>Food entries and nutrition tracking data</li>
                    <li>Health metrics (weight, calories, sleep, etc.)</li>
                    <li>Fitness goals and milestones</li>
                    <li>Scheduled workouts and training plans</li>
                    <li>Uploaded health documents (blood tests, medical records)</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-medium text-foreground mb-2">Usage Data</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Chat messages with our AI trainer</li>
                    <li>App usage patterns and feature interactions</li>
                    <li>Device and browser information</li>
                    <li>IP address and general location</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-medium text-foreground mb-2">Third-Party Data</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Authentication data from our sign-in provider</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/10">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">How We Use Your Information</h2>
              </div>
              
              <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                <li><strong className="text-foreground">Personalized AI Guidance:</strong> To provide customized workout plans, nutrition advice, and fitness recommendations through our AI trainer</li>
                <li><strong className="text-foreground">Progress Tracking:</strong> To track your fitness journey and display your health metrics and achievements</li>
                <li><strong className="text-foreground">Service Improvement:</strong> To analyze usage patterns and improve our application's features and user experience</li>
                <li><strong className="text-foreground">Communication:</strong> To send important service updates, respond to support requests, and provide account-related notifications</li>
                <li><strong className="text-foreground">Document Analysis:</strong> To analyze uploaded health documents and provide relevant insights (premium feature)</li>
                <li><strong className="text-foreground">Security:</strong> To detect and prevent fraud, abuse, and security threats</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/10">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Information Sharing</h2>
              </div>
              
              <div className="space-y-3 text-sm text-muted-foreground">
                <p><strong className="text-foreground">We do not sell your personal data.</strong> We may share your information only in the following circumstances:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong className="text-foreground">AI Processing:</strong> Your chat messages and relevant fitness data are processed by our AI systems to generate personalized responses and recommendations.</li>
                  <li><strong className="text-foreground">Service Providers:</strong> We use trusted third-party services for hosting, database storage, and file storage to operate our application securely.</li>
                  <li><strong className="text-foreground">Legal Requirements:</strong> We may disclose information if required by law or to protect our rights, safety, or property.</li>
                  <li><strong className="text-foreground">Aggregated Data:</strong> We may share anonymized, aggregated data for research or statistical purposes. This data cannot identify you personally.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/10">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Data Security</h2>
              </div>
              
              <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                <li>All data transmission is encrypted using HTTPS/TLS</li>
                <li>User authentication is managed through secure industry-standard systems</li>
                <li>Health documents are stored securely with access controls</li>
                <li>Database access is restricted and monitored</li>
                <li>Regular security reviews and updates are performed</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-3">
                While we implement reasonable security measures, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security of your data.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/10">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Your Rights</h2>
              </div>
              
              <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                <li><strong className="text-foreground">Access:</strong> You can view your personal data through your profile and app features at any time</li>
                <li><strong className="text-foreground">Correction:</strong> You can update your profile information and fitness data through the app</li>
                <li><strong className="text-foreground">Deletion:</strong> You can request deletion of your account and all associated data through the Profile settings. Data will be permanently deleted within 30 days</li>
                <li><strong className="text-foreground">Export:</strong> You may request a copy of your data by contacting us</li>
                <li><strong className="text-foreground">Withdraw Consent:</strong> You may stop using the app at any time. Deleting your account will remove your data from our systems</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/10">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Data Retention</h2>
              </div>
              
              <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                <li>We retain your data for as long as your account is active</li>
                <li>After account deactivation, data is retained for 30 days to allow account recovery</li>
                <li>After the 30-day period, all personal data is permanently deleted</li>
                <li>Anonymized, aggregated data may be retained indefinitely for analytics</li>
                <li>Backup data is purged according to our backup rotation schedule</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/10">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Governing Law</h2>
              </div>
              
              <p className="text-sm text-muted-foreground">
                This Privacy Policy shall be governed by and construed in accordance with the Laws & Regulations of the Kingdom of Bahrain. Any disputes arising from or related to this policy shall be subject to the exclusive jurisdiction of the courts of the Kingdom of Bahrain.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/10">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-rose-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Contact Us</h2>
              </div>
              
              <p className="text-sm text-muted-foreground">
                If you have questions about this Privacy Policy, your personal data, or wish to exercise your data rights, please contact us through our AI chat support or reach out to our team. We aim to respond to all inquiries within 48 hours.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/10">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Changes to This Policy</h2>
              <p className="text-sm text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date. Your continued use of NutriCore after any changes constitutes acceptance of the updated policy.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>NutriCore - AI Fitness & Nutrition</p>
          <p className="mt-1">Governed by the Laws & Regulations of the Kingdom of Bahrain</p>
        </div>
      </div>
    </div>
  );
}
