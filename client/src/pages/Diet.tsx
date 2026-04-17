import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Utensils, MessageCircle, Target, Apple, Beef, Droplet, ChevronRight, Sparkles, TrendingUp, Clock, RefreshCw, Plus, Search, X, Trash2, Check, Sun, Moon, ScanLine } from "lucide-react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { BarcodeScanner } from "@/components/BarcodeScanner";

interface Macros {
  protein: number;
  carbs: number;
  fats: number;
}

interface FoodItem {
  food: string;
  quantity: string;
}

interface DietPlanData {
  dailyCalories: number | null;
  macros: Macros | null;
  contextLabel: string | null;
  foodPlan: FoodItem[] | null;
  confirmedAt: string | null;
}

interface FoodSearchResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: string;
}

interface FoodLog {
  id: string;
  date: string;
  mealType: string;
  foodName: string;
  servingSize: string | null;
  servingQuantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface NutritionSummary {
  consumed: { calories: number; protein: number; carbs: number; fats: number };
  goals: { calories: number; protein: number; carbs: number; fats: number };
  status: { calories: string; protein: string; carbs: string; fats: string };
  remaining: { calories: number; protein: number; carbs: number; fats: number };
  percentages: { calories: number; protein: number; carbs: number; fats: number };
}

function ProgressRing({ 
  percentage, 
  color, 
  size = 80,
  strokeWidth = 6 
}: { 
  percentage: number; 
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500 ease-out"
      />
    </svg>
  );
}

function MacroProgressCard({ 
  label, 
  consumed, 
  goal, 
  color,
  icon: Icon 
}: { 
  label: string;
  consumed: number;
  goal: number;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  const percentage = goal > 0 ? Math.round((consumed / goal) * 100) : 0;
  const remaining = Math.max(0, goal - consumed);
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <ProgressRing percentage={percentage} color={color} size={72} strokeWidth={5} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold">{consumed}g</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground/70">{remaining}g left</div>
      </div>
    </div>
  );
}

function TrainerCard({ onTalkToTrainer }: { onTalkToTrainer: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-0 overflow-hidden">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Your AI Trainer</h3>
                <p className="text-xs text-muted-foreground">Manages your personalized diet</p>
              </div>
            </div>
            <Button
              onClick={onTalkToTrainer}
              size="sm"
              className="gradient-primary text-white"
              data-testid="button-talk-to-trainer"
            >
              <MessageCircle className="w-4 h-4 mr-1.5" />
              Chat
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface BarcodeResult {
  name: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: string;
  barcode: string;
  imageUrl: string | null;
}

function FoodSearchDialog({ 
  open, 
  onOpenChange,
  onAddFood 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddFood: (food: FoodSearchResult, quantity: number, mealType: string) => void;
}) {
  const [mode, setMode] = useState<"search" | "manual" | "scan">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [mealType, setMealType] = useState("snack");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Manual entry state
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFats, setManualFats] = useState("");

  const { data: searchResults = [], isLoading } = useQuery<FoodSearchResult[]>({
    queryKey: ["/api/food/search", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const res = await fetch(`/api/food/search?q=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to search foods");
      return res.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const handleSelect = (food: FoodSearchResult) => {
    setSelectedFood(food);
  };

  const handleAdd = () => {
    if (selectedFood) {
      onAddFood(selectedFood, quantity, mealType);
      resetDialog();
      onOpenChange(false);
    }
  };

  const handleManualAdd = () => {
    const calories = parseFloat(manualCalories) || 0;
    const protein = parseFloat(manualProtein) || 0;
    const carbs = parseFloat(manualCarbs) || 0;
    const fats = parseFloat(manualFats) || 0;
    
    if (!manualName.trim()) return;
    
    // Calculate calories from macros if not provided
    const calculatedCals = calories || (protein * 4) + (carbs * 4) + (fats * 9);
    
    const manualFood: FoodSearchResult = {
      name: manualName.trim(),
      calories: Math.round(calculatedCals),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fats: Math.round(fats),
      servingSize: "1 serving",
    };
    
    onAddFood(manualFood, 1, mealType);
    resetDialog();
    onOpenChange(false);
  };

  const handleBarcodeScan = async (barcode: string) => {
    setIsLookingUp(true);
    setScanError(null);
    
    try {
      const res = await fetch(`/api/food/barcode/${barcode}`, { credentials: "include" });
      
      if (!res.ok) {
        if (res.status === 404) {
          setScanError("Product not found. Try manual entry.");
          toast({
            title: "Product not found",
            description: "This barcode isn't in our database. You can add it manually.",
            variant: "destructive",
          });
          return;
        }
        throw new Error("Failed to lookup barcode");
      }
      
      const data: BarcodeResult = await res.json();
      
      const displayName = data.brand 
        ? `${data.name} (${data.brand})`
        : data.name;
      
      const scannedFood: FoodSearchResult = {
        name: displayName,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        servingSize: data.servingSize,
      };
      
      setSelectedFood(scannedFood);
      setMode("search");
      
      toast({
        title: "Product found!",
        description: displayName,
      });
    } catch (error) {
      console.error("Barcode lookup error:", error);
      setScanError("Failed to lookup barcode. Please try again.");
      toast({
        title: "Lookup failed",
        description: "Could not retrieve product info. Try again or enter manually.",
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const resetDialog = useCallback(() => {
    setSelectedFood(null);
    setSearchQuery("");
    setQuantity(1);
    setMode("search");
    setManualName("");
    setManualCalories("");
    setManualProtein("");
    setManualCarbs("");
    setManualFats("");
    setScanError(null);
    setIsLookingUp(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetDialog();
    }
  }, [open, resetDialog]);

  const adjustedCalories = selectedFood ? Math.round(selectedFood.calories * quantity) : 0;
  const adjustedProtein = selectedFood ? Math.round(selectedFood.protein * quantity) : 0;
  const adjustedCarbs = selectedFood ? Math.round(selectedFood.carbs * quantity) : 0;
  const adjustedFats = selectedFood ? Math.round(selectedFood.fats * quantity) : 0;

  // Calculate preview for manual entry
  const manualPreviewCals = parseFloat(manualCalories) || ((parseFloat(manualProtein) || 0) * 4) + ((parseFloat(manualCarbs) || 0) * 4) + ((parseFloat(manualFats) || 0) * 9);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Log Food
          </DialogTitle>
        </DialogHeader>

        {!selectedFood && !isLookingUp && (
          <div className="flex gap-2 mb-2">
            <Button
              variant={mode === "scan" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("scan")}
              className="flex-1"
              data-testid="button-mode-scan"
            >
              <ScanLine className="w-4 h-4 mr-1" />
              Scan
            </Button>
            <Button
              variant={mode === "search" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("search")}
              className="flex-1"
              data-testid="button-mode-search"
            >
              <Search className="w-4 h-4 mr-1" />
              Search
            </Button>
            <Button
              variant={mode === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("manual")}
              className="flex-1"
              data-testid="button-mode-manual"
            >
              <Plus className="w-4 h-4 mr-1" />
              Manual
            </Button>
          </div>
        )}
        
        {isLookingUp && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Looking up product...</p>
          </div>
        )}

        {mode === "scan" && !selectedFood && !isLookingUp ? (
          <div className="space-y-4">
            <BarcodeScanner
              onScan={handleBarcodeScan}
              onClose={() => setMode("search")}
            />
            {scanError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{scanError}</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setScanError(null);
                    setMode("manual");
                  }}
                  className="mt-1 p-0 h-auto text-primary"
                >
                  Add manually instead
                </Button>
              </div>
            )}
          </div>
        ) : mode === "search" && !selectedFood && !isLookingUp ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search foods (e.g., chicken, biryani, pizza...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-food-search"
                autoFocus
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
              {searchResults.length === 0 && searchQuery.length >= 2 && !isLoading && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <p>No foods found.</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setMode("manual");
                      setManualName(searchQuery);
                    }}
                    className="mt-2"
                  >
                    Add "{searchQuery}" manually
                  </Button>
                </div>
              )}
              {searchResults.map((food, index) => (
                <motion.div
                  key={food.name}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <button
                    onClick={() => handleSelect(food)}
                    className="w-full text-left px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors"
                    data-testid={`button-select-food-${index}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{food.name}</div>
                        <div className="text-xs text-muted-foreground">{food.servingSize}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-primary">{food.calories} cal</div>
                        <div className="text-[10px] text-muted-foreground">
                          P:{food.protein}g C:{food.carbs}g F:{food.fats}g
                        </div>
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        ) : mode === "manual" && !selectedFood && !isLookingUp ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">Food Name</label>
              <Input
                placeholder="e.g., Homemade Pasta"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                data-testid="input-manual-name"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">Calories (optional)</label>
                <Input
                  type="number"
                  placeholder="Auto-calc from macros"
                  value={manualCalories}
                  onChange={(e) => setManualCalories(e.target.value)}
                  data-testid="input-manual-calories"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Meal</label>
                <Select value={mealType} onValueChange={setMealType}>
                  <SelectTrigger data-testid="select-manual-meal-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                    <SelectItem value="snack">Snack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium flex items-center gap-1">
                  <Beef className="w-3 h-3 text-rose-500" />
                  Protein (g)
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={manualProtein}
                  onChange={(e) => setManualProtein(e.target.value)}
                  data-testid="input-manual-protein"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium flex items-center gap-1">
                  <Apple className="w-3 h-3 text-amber-500" />
                  Carbs (g)
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={manualCarbs}
                  onChange={(e) => setManualCarbs(e.target.value)}
                  data-testid="input-manual-carbs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium flex items-center gap-1">
                  <Droplet className="w-3 h-3 text-sky-500" />
                  Fats (g)
                </label>
                <Input
                  type="number"
                  placeholder="0"
                  value={manualFats}
                  onChange={(e) => setManualFats(e.target.value)}
                  data-testid="input-manual-fats"
                />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Calculated Calories</span>
                <span className="text-lg font-bold text-primary">{Math.round(manualPreviewCals)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {!manualCalories && "Auto-calculated: (Protein × 4) + (Carbs × 4) + (Fats × 9)"}
              </div>
            </div>

            <Button 
              onClick={handleManualAdd} 
              className="w-full gradient-primary text-white"
              disabled={!manualName.trim()}
              data-testid="button-add-manual-food"
            >
              <Check className="w-4 h-4 mr-2" />
              Add to Log
            </Button>
          </div>
        ) : selectedFood && !isLookingUp ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <div className="font-medium">{selectedFood.name}</div>
                <div className="text-xs text-muted-foreground">{selectedFood.servingSize}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFood(null)}
                data-testid="button-clear-selection"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">Servings</label>
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                  data-testid="input-quantity"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Meal</label>
                <Select value={mealType} onValueChange={setMealType}>
                  <SelectTrigger data-testid="select-meal-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                    <SelectItem value="snack">Snack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total Calories</span>
                <span className="text-lg font-bold text-primary">{adjustedCalories}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Protein: {adjustedProtein}g</span>
                <span>Carbs: {adjustedCarbs}g</span>
                <span>Fats: {adjustedFats}g</span>
              </div>
            </div>

            <Button 
              onClick={handleAdd} 
              className="w-full gradient-primary text-white"
              data-testid="button-add-food"
            >
              <Check className="w-4 h-4 mr-2" />
              Add to Log
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ onTalkToTrainer }: { onTalkToTrainer: () => void }) {
  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center pt-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center mx-auto mb-6"
          >
            <Utensils className="w-12 h-12 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-display font-bold mb-2">Diet Dashboard</h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Get a personalized nutrition plan tailored to your goals
          </p>
        </div>

        <Card className="bg-card/50 border-0">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Target className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Personalized Targets</h3>
                  <p className="text-xs text-muted-foreground">Calorie and macro goals based on your body and goals</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Apple className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Food Recommendations</h3>
                  <p className="text-xs text-muted-foreground">Suggested meals aligned with your preferences</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Adaptive Planning</h3>
                  <p className="text-xs text-muted-foreground">Your trainer adjusts based on your progress</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-0">
            <CardContent className="pt-6 pb-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="font-medium">Get Started with Your Trainer</h2>
                <p className="text-sm text-muted-foreground">
                  Chat with your AI trainer to create your personalized diet plan
                </p>
              </div>
              <Button
                onClick={onTalkToTrainer}
                className="gradient-primary text-white w-full"
                data-testid="button-go-to-trainer"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Talk to Trainer
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function Diet() {
  const [, setLocation] = useLocation();
  const [addFoodOpen, setAddFoodOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: dietPlan, isLoading: dietLoading } = useQuery<DietPlanData>({
    queryKey: ["/api/diet/current"],
    queryFn: async () => {
      const res = await fetch("/api/diet/current", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch diet plan");
      }
      return res.json();
    },
  });

  const { data: nutritionSummary, isLoading: summaryLoading } = useQuery<NutritionSummary>({
    queryKey: ["/api/food/summary", today],
    queryFn: async () => {
      const res = await fetch(`/api/food/summary?date=${today}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch nutrition summary");
      return res.json();
    },
  });

  const { data: foodLogs = [], isLoading: logsLoading } = useQuery<FoodLog[]>({
    queryKey: ["/api/food/logs", today],
    queryFn: async () => {
      const res = await fetch(`/api/food/logs?date=${today}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch food logs");
      return res.json();
    },
  });

  const addFoodMutation = useMutation({
    mutationFn: async ({ food, quantity, mealType }: { food: FoodSearchResult; quantity: number; mealType: string }) => {
      const res = await fetch("/api/food/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          foodName: food.name,
          calories: food.calories * quantity,
          protein: food.protein * quantity,
          carbs: food.carbs * quantity,
          fats: food.fats * quantity,
          servingSize: food.servingSize,
          servingQuantity: quantity,
          mealType,
          date: today,
        }),
      });
      if (!res.ok) throw new Error("Failed to log food");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food/summary"] });
      toast({
        title: "Food logged!",
        description: "Your food has been added to today's log.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to log food. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteFoodMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/food/logs/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete food log");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/food/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/food/summary"] });
      toast({
        title: "Food removed",
        description: "The item has been removed from your log.",
      });
    },
  });

  const handleTalkToTrainer = () => {
    setLocation("/chat");
  };

  const handleAddFood = (food: FoodSearchResult, quantity: number, mealType: string) => {
    addFoodMutation.mutate({ food, quantity, mealType });
  };

  const isLoading = summaryLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const consumed = nutritionSummary?.consumed || { calories: 0, protein: 0, carbs: 0, fats: 0 };
  const goals = nutritionSummary?.goals || { calories: 2000, protein: 150, carbs: 250, fats: 65 };
  const percentages = nutritionSummary?.percentages || { calories: 0, protein: 0, carbs: 0, fats: 0 };
  const remaining = nutritionSummary?.remaining || { calories: goals.calories, protein: goals.protein, carbs: goals.carbs, fats: goals.fats };

  const mealGroups = foodLogs.reduce((acc, log) => {
    const meal = log.mealType || 'snack';
    if (!acc[meal]) acc[meal] = [];
    acc[meal].push(log);
    return acc;
  }, {} as Record<string, FoodLog[]>);

  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'];
  const mealLabels: Record<string, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snacks',
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Diet</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {format(new Date(), "EEEE, MMM d")}
            </p>
          </div>
          <Link href="/chat">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary hover:text-primary/80"
              data-testid="button-adjust-diet"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Adjust
            </Button>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-card/50 border-0 overflow-hidden">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Today's Progress</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-primary" data-testid="text-consumed-calories">
                      {consumed.calories}
                    </span>
                    <span className="text-muted-foreground text-sm">/ {goals.calories} cal</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {remaining.calories > 0 ? `${remaining.calories} remaining` : 'Goal reached!'}
                  </div>
                </div>
                <div className="relative">
                  <ProgressRing percentage={percentages.calories} color="hsl(var(--primary))" size={80} strokeWidth={6} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold">{Math.min(percentages.calories, 100)}%</span>
                  </div>
                </div>
              </div>

              <Progress 
                value={Math.min(percentages.calories, 100)} 
                className="h-2 bg-muted" 
              />

              <div className="flex justify-around pt-5">
                <MacroProgressCard
                  label="Protein"
                  consumed={consumed.protein}
                  goal={goals.protein}
                  color="#f43f5e"
                  icon={Beef}
                />
                <MacroProgressCard
                  label="Carbs"
                  consumed={consumed.carbs}
                  goal={goals.carbs}
                  color="#f59e0b"
                  icon={Apple}
                />
                <MacroProgressCard
                  label="Fats"
                  consumed={consumed.fats}
                  goal={goals.fats}
                  color="#0ea5e9"
                  icon={Droplet}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Button
            onClick={() => setAddFoodOpen(true)}
            className="w-full gradient-primary text-white h-12"
            data-testid="button-log-food"
          >
            <Plus className="w-5 h-5 mr-2" />
            Log Food
          </Button>
        </motion.div>

        {logsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {mealOrder.map((mealType, idx) => {
              const meals = mealGroups[mealType] || [];
              const mealCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
              const mealIcons: Record<string, typeof Sun> = {
                breakfast: Sun,
                lunch: Utensils,
                dinner: Moon,
                snack: Apple,
              };
              const MealIcon = mealIcons[mealType] || Utensils;
              
              return (
                <motion.div
                  key={mealType}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                >
                  <Card className="bg-card/50 border-0">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <MealIcon className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <span className="text-sm font-medium">{mealLabels[mealType]}</span>
                        </div>
                        {meals.length > 0 && (
                          <span className="text-xs text-muted-foreground font-medium">{mealCalories} cal</span>
                        )}
                      </div>
                      
                      {meals.length === 0 ? (
                        <div className="py-4 text-center">
                          <p className="text-xs text-muted-foreground">No {mealLabels[mealType].toLowerCase()} logged</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <AnimatePresence>
                            {meals.map((log) => (
                              <motion.div
                                key={log.id}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 group"
                                data-testid={`row-food-log-${log.id}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{log.foodName}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {log.servingQuantity}x {log.servingSize}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className="text-sm font-semibold text-primary">{log.calories}</div>
                                    <div className="text-[10px] text-muted-foreground">cal</div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => deleteFoodMutation.mutate(log.id)}
                                    data-testid={`button-delete-food-${log.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        <TrainerCard onTalkToTrainer={handleTalkToTrainer} />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card 
            className="bg-card/30 border border-dashed border-white/10 cursor-pointer hover:bg-card/50 transition-colors"
            onClick={handleTalkToTrainer}
            data-testid="card-trainer-cta"
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Need to adjust your goals?</p>
                    <p className="text-xs text-muted-foreground">Talk to your trainer to update targets</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <p className="text-xs text-center text-muted-foreground pt-2 pb-4">
          Track your meals to stay on target with your nutrition goals.
        </p>
      </div>

      <FoodSearchDialog
        open={addFoodOpen}
        onOpenChange={setAddFoodOpen}
        onAddFood={handleAddFood}
      />
    </div>
  );
}
