import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Share2, 
  Download, 
  Flame, 
  Dumbbell, 
  Copy,
  Check,
  X
} from "lucide-react";
import phoenixLogo from "@assets/generated_images/phoenix_muted_olive_champagne.png";

interface ProgressStats {
  firstName: string;
  workoutsCompleted: number;
  currentStreak: number;
  referralCode?: string;
}

interface ShareProgressCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: ProgressStats;
}

export function ShareProgressCard({ open, onOpenChange, stats }: ShareProgressCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const referralLink = stats.referralCode 
    ? `https://nutricoreapp.com?ref=${stats.referralCode}` 
    : 'https://nutricoreapp.com';

  const shareText = `I've completed ${stats.workoutsCompleted} workouts with a ${stats.currentStreak} day streak on NutriCore! 💪\n\nJoin me on my fitness journey: ${referralLink}`;

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast({ title: "Copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const handleShareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0a0a0b',
        scale: 2,
      });
      
      const link = document.createElement('a');
      link.download = `nutricore-progress-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast({ title: "Progress card downloaded!" });
    } catch {
      toast({ 
        title: "Download failed", 
        description: "Try using the copy or share options instead.",
        variant: "destructive" 
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Share Your Progress
          </DialogTitle>
          <DialogDescription>
            Show off your achievements and invite friends to join you!
          </DialogDescription>
        </DialogHeader>

        <div 
          ref={cardRef}
          className="p-6 rounded-xl bg-gradient-to-br from-[#1a1f1a] via-[#0f1210] to-[#0a0a0b] border border-primary/20"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center overflow-hidden">
              <img src={phoenixLogo} alt="NutriCore" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-white">NutriCore</h3>
              <p className="text-xs text-primary">AI Fitness Coach</p>
            </div>
          </div>

          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-1">Progress Report</p>
            <p className="text-2xl font-bold text-white">{stats.firstName || 'Athlete'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-white/5 text-center">
              <Dumbbell className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.workoutsCompleted}</p>
              <p className="text-xs text-muted-foreground">Workouts</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5 text-center">
              <Flame className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stats.currentStreak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </div>
          </div>

          {stats.referralCode && (
            <div className="text-center py-3 px-4 rounded-lg bg-primary/10 border border-primary/30">
              <p className="text-xs text-muted-foreground mb-1">Join me on NutriCore</p>
              <p className="text-sm font-medium text-primary break-all">{referralLink}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-4">
          <Button 
            onClick={handleCopyToClipboard}
            variant="outline"
            className="flex-1"
            data-testid="button-copy-share"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            Copy
          </Button>
          <Button 
            onClick={handleShareWhatsApp}
            className="flex-1 bg-green-600 hover:bg-green-700"
            data-testid="button-share-whatsapp"
          >
            WhatsApp
          </Button>
          <Button 
            onClick={handleShareTwitter}
            variant="outline"
            className="flex-1"
            data-testid="button-share-twitter"
          >
            <X className="w-4 h-4 mr-2" />
            Post
          </Button>
          <Button 
            onClick={handleDownload}
            variant="outline"
            className="flex-1"
            data-testid="button-download-card"
          >
            <Download className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ShareProgressButton({ stats }: { stats: ProgressStats }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button 
        onClick={() => setOpen(true)}
        variant="outline"
        className="gap-2"
        data-testid="button-share-progress"
      >
        <Share2 className="w-4 h-4" />
        Share Progress
      </Button>
      <ShareProgressCard open={open} onOpenChange={setOpen} stats={stats} />
    </>
  );
}
