import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays, subWeeks, subMonths, subYears, parseISO, startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import { ArrowUp, ArrowDown, Pencil, Smartphone, EyeOff, Eye, MessageSquare, Plus, Ruler, TrendingUp, Calendar, Dumbbell, Activity } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { 
  TIME_RANGES, 
  TimeRangeKey, 
  calculateTrendLine, 
  calculateChangeSummary,
  BodyweightDataPoint,
  TrendDataPoint
} from "@shared/bodyweightTrendLogic";
import { 
  analyzeTrend, 
  generateInterpretation,
  AIInterpretation 
} from "@shared/bodyweightAIInterpretation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/api";

const TIME_RANGE_SHORT_LABELS: Record<TimeRangeKey, string> = {
  TWO_WEEKS: "2W",
  ONE_MONTH: "1M",
  THREE_MONTHS: "3M",
  SIX_MONTHS: "6M",
  ONE_YEAR: "1Y",
};

const SUB_TABS = [
  { id: "weight", label: "Weight", icon: TrendingUp },
  { id: "measurements", label: "Body Comp", icon: Ruler },
  { id: "strength", label: "Strength", icon: Dumbbell },
  { id: "activity", label: "Activity", icon: Activity },
];

const KG_TO_LB = 2.20462;
const LB_TO_KG = 0.453592;
const CM_TO_IN = 0.393701;
const IN_TO_CM = 2.54;

type WeightUnit = "kg" | "lb";
type LengthUnit = "cm" | "in";

function convertWeight(weight: number, fromUnit: WeightUnit, toUnit: WeightUnit): number {
  if (fromUnit === toUnit) return weight;
  if (fromUnit === "kg" && toUnit === "lb") return weight * KG_TO_LB;
  return weight * LB_TO_KG;
}

function convertLength(length: number, fromUnit: LengthUnit, toUnit: LengthUnit): number {
  if (fromUnit === toUnit) return length;
  if (fromUnit === "cm" && toUnit === "in") return length * CM_TO_IN;
  return length * IN_TO_CM;
}

function formatWeight(weight: number, unit: WeightUnit): string {
  return `${weight.toFixed(1)} ${unit}`;
}

function formatLength(length: number, unit: LengthUnit): string {
  return `${length.toFixed(1)} ${unit}`;
}

interface ExtendedEntry extends BodyweightDataPoint {
  id: string;
  hidden?: boolean;
}

interface BodyMeasurement {
  id: string;
  userId: string;
  date: string;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  leftArm: number | null;
  rightArm: number | null;
  leftThigh: number | null;
  rightThigh: number | null;
  neck: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function Progress() {
  const { data: user } = useUser();
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeKey>("ONE_MONTH");
  const [selectedTab, setSelectedTab] = useState("weight");
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExtendedEntry | null>(null);
  const [viewingDeviceEntry, setViewingDeviceEntry] = useState<ExtendedEntry | null>(null);
  const [newWeight, setNewWeight] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showAICommentary, setShowAICommentary] = useState(true);
  const [addMeasurementOpen, setAddMeasurementOpen] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<BodyMeasurement | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const preferredUnit: WeightUnit = ((user as any)?.weightUnit as WeightUnit) || "kg";
  const preferredLengthUnit: LengthUnit = preferredUnit === "lb" ? "in" : "cm";

  const endDate = format(new Date(), "yyyy-MM-dd");
  const startDate = format(subDays(new Date(), TIME_RANGES[selectedTimeRange].days), "yyyy-MM-dd");

  const { data: rawEntries = [], isLoading } = useQuery<ExtendedEntry[]>({
    queryKey: ["/api/bodyweight", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/bodyweight?startDate=${startDate}&endDate=${endDate}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch bodyweight data");
      return res.json();
    },
  });

  const measurementEndDate = format(new Date(), "yyyy-MM-dd");
  const measurementStartDate = format(subYears(new Date(), 1), "yyyy-MM-dd");

  const { data: bodyMeasurements = [] } = useQuery<BodyMeasurement[]>({
    queryKey: ["/api/body-measurements", measurementStartDate, measurementEndDate],
    queryFn: async () => {
      const res = await fetch(`/api/body-measurements?startDate=${measurementStartDate}&endDate=${measurementEndDate}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const entries = useMemo(() => rawEntries, [rawEntries]);

  const { data: strengthData = [] } = useQuery<{ exercise: string; history: { date: string; maxWeight: number; totalVolume: number }[] }[]>({
    queryKey: ["/api/progress/strength"],
    queryFn: async () => {
      const res = await fetch("/api/progress/strength", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: selectedTab === "strength",
  });

  const [selectedExercise, setSelectedExercise] = useState<string>("");

  const { data: activityData = [] } = useQuery<{ date: string; steps: number; hrvScore: number | null; caloriesBurned: number; activeMinutes: number }[]>({
    queryKey: ["/api/progress/activity"],
    queryFn: async () => {
      const res = await fetch("/api/progress/activity", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: selectedTab === "activity",
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { date: string; weight: number }) => {
      const res = await fetch("/api/bodyweight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bodyweight"] });
      setAddEntryOpen(false);
      setEditingEntry(null);
      setNewWeight("");
      setValidationError(null);
      toast({ title: "Entry saved" });
    },
    onError: (error: Error) => {
      setValidationError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bodyweight/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bodyweight"] });
      setEditingEntry(null);
      toast({ title: "Entry removed" });
    },
  });

  const hideMutation = useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const res = await fetch("/api/bodyweight/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, hidden }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bodyweight"] });
      setViewingDeviceEntry(null);
      toast({ title: "Entry visibility updated" });
    },
  });

  const saveMeasurementMutation = useMutation({
    mutationFn: async (data: Partial<BodyMeasurement> & { date: string }) => {
      const url = editingMeasurement 
        ? `/api/body-measurements/${editingMeasurement.id}`
        : '/api/body-measurements';
      const method = editingMeasurement ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-measurements"] });
      setAddMeasurementOpen(false);
      setEditingMeasurement(null);
      toast({ title: "Measurement saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMeasurementMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/body-measurements/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/body-measurements"] });
      setEditingMeasurement(null);
      toast({ title: "Measurement removed" });
    },
  });

  const validateAndSave = () => {
    const weightValue = parseFloat(newWeight);
    
    if (isNaN(weightValue)) {
      setValidationError("Please enter a valid number");
      return;
    }
    
    if (weightValue <= 0) {
      setValidationError("Weight must be greater than zero");
      return;
    }
    
    if (weightValue > 1000) {
      setValidationError("Please check this value");
      return;
    }
    
    if (!newDate) {
      setValidationError("Please select a date");
      return;
    }

    const weightInKg = preferredUnit === "lb" 
      ? convertWeight(weightValue, "lb", "kg") 
      : weightValue;

    saveMutation.mutate({ 
      date: newDate, 
      weight: weightInKg
    });
  };

  const dataPoints: BodyweightDataPoint[] = useMemo(() => {
    return entries.map((e) => ({
      date: e.date,
      weight: preferredUnit === "lb" ? convertWeight(e.weight, "kg", "lb") : e.weight,
      source: e.source || "manual",
    }));
  }, [entries, preferredUnit]);

  const trendData = useMemo(() => 
    calculateTrendLine(dataPoints, selectedTimeRange), 
    [dataPoints, selectedTimeRange]
  );

  const changeSummary = useMemo(() => 
    calculateChangeSummary(dataPoints), 
    [dataPoints]
  );

  const aiInterpretation = useMemo((): AIInterpretation => {
    if (!showAICommentary) {
      return { shouldShow: false, message: null, confidence: 'low' };
    }
    const analysis = analyzeTrend(trendData, changeSummary, selectedTimeRange);
    return generateInterpretation(analysis, selectedTimeRange);
  }, [trendData, changeSummary, selectedTimeRange, showAICommentary]);

  const hasData = dataPoints.length > 0;

  const openEditDialog = (entry: ExtendedEntry) => {
    if (entry.source === "device") {
      setViewingDeviceEntry(entry);
    } else {
      setEditingEntry(entry);
      const displayWeight = preferredUnit === "lb" 
        ? convertWeight(entry.weight, "kg", "lb") 
        : entry.weight;
      setNewWeight(displayWeight.toFixed(1));
      setNewDate(entry.date);
      setValidationError(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="progress-page">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight mb-4" data-testid="progress-title">
            Progress
          </h1>
          
          <div className="flex bg-muted rounded-lg p-1" data-testid="sub-tabs">
            {SUB_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    selectedTab === tab.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </header>

        {selectedTab === "weight" && (
          <>
            <div className="flex justify-end mb-4">
              <div className="flex bg-muted rounded-lg p-1" data-testid="time-range-selector">
                {(Object.keys(TIME_RANGES) as TimeRangeKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelectedTimeRange(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      selectedTimeRange === key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`range-${TIME_RANGE_SHORT_LABELS[key]}`}
                  >
                    {TIME_RANGE_SHORT_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            <SummaryStrip summary={changeSummary} hasData={hasData} unit={preferredUnit} />
            
            <div className="mt-6 mb-4">
              <TrendChart 
                data={trendData} 
                highlightedDate={highlightedDate}
                onPointClick={setHighlightedDate}
                isLoading={isLoading}
                unit={preferredUnit}
              />
            </div>

            <AICommentary 
              interpretation={aiInterpretation}
              showToggle={hasData}
              isEnabled={showAICommentary}
              onToggle={setShowAICommentary}
            />

            <EntriesList 
              entries={entries}
              highlightedDate={highlightedDate}
              onEntryClick={(date) => setHighlightedDate(date === highlightedDate ? null : date)}
              onEdit={openEditDialog}
              onAddNew={() => {
                setAddEntryOpen(true);
                setNewDate(format(new Date(), "yyyy-MM-dd"));
                setNewWeight("");
                setValidationError(null);
              }}
              unit={preferredUnit}
            />
          </>
        )}

        {selectedTab === "measurements" && (
          <BodyMeasurementsTab 
            measurements={bodyMeasurements}
            preferredUnit={preferredLengthUnit}
            onAdd={() => {
              setEditingMeasurement(null);
              setAddMeasurementOpen(true);
            }}
            onEdit={(measurement) => {
              setEditingMeasurement(measurement);
              setAddMeasurementOpen(true);
            }}
            onDelete={(id) => deleteMeasurementMutation.mutate(id)}
          />
        )}

        {selectedTab === "strength" && (
          <div className="space-y-6">
            {strengthData.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No strength data yet. Log workouts with weights to see your progress here.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap">
                  {strengthData.map((d) => (
                    <button
                      key={d.exercise}
                      onClick={() => setSelectedExercise(d.exercise)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        (selectedExercise || strengthData[0]?.exercise) === d.exercise
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {d.exercise}
                    </button>
                  ))}
                </div>
                {(() => {
                  const active = strengthData.find(d => d.exercise === (selectedExercise || strengthData[0]?.exercise));
                  if (!active) return null;
                  const pr = Math.max(...active.history.map(h => h.maxWeight));
                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{active.exercise}</CardTitle>
                        <CardDescription>PR: {pr} kg</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={active.history}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => format(parseISO(d), "MMM d")} />
                            <YAxis tick={{ fontSize: 11 }} unit="kg" />
                            <Tooltip formatter={(v: any) => [`${v} kg`, "Max Weight"]} labelFormatter={(d) => format(parseISO(d), "MMM d, yyyy")} />
                            <Line type="monotone" dataKey="maxWeight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {selectedTab === "activity" && (
          <div className="space-y-6">
            {activityData.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No activity data yet. Connect your Garmin or Fitbit to see trends here.</p>
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Daily Steps</CardTitle>
                    <CardDescription>Last 90 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={activityData.slice(-30)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => format(parseISO(d), "MMM d")} interval={6} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => [v.toLocaleString(), "Steps"]} labelFormatter={(d) => format(parseISO(d), "MMM d, yyyy")} />
                        <Bar dataKey="steps" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {activityData.some(d => d.hrvScore) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">HRV Score</CardTitle>
                      <CardDescription>Heart Rate Variability — higher is better recovery</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={activityData.filter(d => d.hrvScore)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => format(parseISO(d), "MMM d")} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: any) => [v, "HRV"]} labelFormatter={(d) => format(parseISO(d), "MMM d, yyyy")} />
                          <Line type="monotone" dataKey="hrvScore" stroke="#D4AF37" strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={addEntryOpen || !!editingEntry} onOpenChange={(open) => {
        if (!open) {
          setAddEntryOpen(false);
          setEditingEntry(null);
          setValidationError(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Entry" : "Add Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Date</label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                max={format(new Date(), "yyyy-MM-dd")}
                data-testid="input-entry-date"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                Weight ({preferredUnit})
              </label>
              <Input
                type="number"
                step="0.1"
                placeholder={preferredUnit === "kg" ? "70.0" : "154.0"}
                value={newWeight}
                onChange={(e) => {
                  setNewWeight(e.target.value);
                  setValidationError(null);
                }}
                data-testid="input-entry-weight"
              />
              {validationError && (
                <p className="text-sm text-destructive mt-1" data-testid="validation-error">
                  {validationError}
                </p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              {editingEntry && (
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(editingEntry.id)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-entry"
                >
                  Delete
                </Button>
              )}
              <Button
                className="flex-1"
                onClick={validateAndSave}
                disabled={saveMutation.isPending || !newWeight || !newDate}
                data-testid="button-save-entry"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingDeviceEntry} onOpenChange={(open) => {
        if (!open) setViewingDeviceEntry(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Device Entry</DialogTitle>
            <DialogDescription>
              This entry was recorded by your connected device and cannot be edited directly.
            </DialogDescription>
          </DialogHeader>
          {viewingDeviceEntry && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">
                    {formatWeight(
                      preferredUnit === "lb" 
                        ? convertWeight(viewingDeviceEntry.weight, "kg", "lb") 
                        : viewingDeviceEntry.weight,
                      preferredUnit
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(viewingDeviceEntry.date), "MMM d, yyyy")}
                  </p>
                </div>
                <Smartphone className="w-5 h-5 text-muted-foreground" />
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  You can hide this entry from your trend or add a manual entry for this date to override it.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => hideMutation.mutate({ 
                      id: viewingDeviceEntry.id, 
                      hidden: !viewingDeviceEntry.hidden 
                    })}
                    disabled={hideMutation.isPending}
                    data-testid="button-hide-entry"
                  >
                    {viewingDeviceEntry.hidden ? (
                      <><Eye className="w-4 h-4 mr-2" /> Show</>
                    ) : (
                      <><EyeOff className="w-4 h-4 mr-2" /> Hide</>
                    )}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setViewingDeviceEntry(null);
                      setAddEntryOpen(true);
                      setNewDate(viewingDeviceEntry.date);
                      const displayWeight = preferredUnit === "lb" 
                        ? convertWeight(viewingDeviceEntry.weight, "kg", "lb") 
                        : viewingDeviceEntry.weight;
                      setNewWeight(displayWeight.toFixed(1));
                    }}
                    data-testid="button-override-entry"
                  >
                    Add Manual Entry
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MeasurementDialog 
        open={addMeasurementOpen}
        onOpenChange={setAddMeasurementOpen}
        measurement={editingMeasurement}
        preferredUnit={preferredLengthUnit}
        onSave={(data) => saveMeasurementMutation.mutate(data)}
        isPending={saveMeasurementMutation.isPending}
      />
    </div>
  );
}

function BodyMeasurementsTab({ 
  measurements, 
  preferredUnit, 
  onAdd, 
  onEdit,
  onDelete 
}: { 
  measurements: BodyMeasurement[];
  preferredUnit: LengthUnit;
  onAdd: () => void;
  onEdit: (measurement: BodyMeasurement) => void;
  onDelete: (id: string) => void;
}) {
  const latestMeasurement = measurements[0];
  const previousMeasurement = measurements[1];

  const getMeasurementChange = (current: number | null, previous: number | null): { value: string; direction: "up" | "down" | "neutral" } => {
    if (current === null || previous === null) return { value: "--", direction: "neutral" };
    const diff = current - previous;
    const displayDiff = preferredUnit === "in" ? convertLength(diff, "cm", "in") : diff;
    return {
      value: `${diff >= 0 ? "+" : ""}${displayDiff.toFixed(1)} ${preferredUnit}`,
      direction: diff > 0 ? "up" : diff < 0 ? "down" : "neutral"
    };
  };

  const displayValue = (value: number | null): string => {
    if (value === null) return "--";
    const converted = preferredUnit === "in" ? convertLength(value, "cm", "in") : value;
    return `${converted.toFixed(1)} ${preferredUnit}`;
  };

  const measurementFields = [
    { key: "chest", label: "Chest" },
    { key: "waist", label: "Waist" },
    { key: "hips", label: "Hips" },
    { key: "leftArm", label: "Left Arm" },
    { key: "rightArm", label: "Right Arm" },
    { key: "leftThigh", label: "Left Thigh" },
    { key: "rightThigh", label: "Right Thigh" },
    { key: "neck", label: "Neck" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Body Measurements</h2>
          <p className="text-sm text-muted-foreground">Track your body composition weekly</p>
        </div>
        <Button onClick={onAdd} size="sm" data-testid="button-add-measurement">
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {latestMeasurement ? (
        <Card className="bg-card border-white/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Latest Measurement</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {format(parseISO(latestMeasurement.date), "MMM d, yyyy")}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onEdit(latestMeasurement)}
                  data-testid="button-edit-measurement"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {measurementFields.map((field) => {
                const current = latestMeasurement[field.key];
                const previous = previousMeasurement?.[field.key];
                const change = getMeasurementChange(current, previous);
                
                return (
                  <div key={field.key} className="p-3 bg-muted/50 rounded-lg" data-testid={`measurement-${field.key}`}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{field.label}</p>
                    <p className="text-lg font-semibold">{displayValue(current)}</p>
                    {previousMeasurement && current !== null && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {change.direction === "down" && <ArrowDown className="w-3 h-3 text-green-500" />}
                        {change.direction === "up" && <ArrowUp className="w-3 h-3 text-red-400" />}
                        <span className={`text-xs ${change.direction === "down" ? "text-green-500" : change.direction === "up" ? "text-red-400" : "text-muted-foreground"}`}>
                          {change.value}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-white/10">
          <CardContent className="py-12 text-center">
            <Ruler className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No measurements recorded yet</p>
            <Button onClick={onAdd} data-testid="button-add-first-measurement">
              <Plus className="w-4 h-4 mr-1" />
              Add Your First Measurement
            </Button>
          </CardContent>
        </Card>
      )}

      {measurements.length > 1 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">History</h3>
          <div className="space-y-2">
            {measurements.slice(1).map((measurement) => (
              <div 
                key={measurement.id}
                className="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:border-primary/20 transition-colors cursor-pointer"
                onClick={() => onEdit(measurement)}
                data-testid={`measurement-history-${measurement.date}`}
              >
                <span className="font-medium">{format(parseISO(measurement.date), "MMM d, yyyy")}</span>
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MeasurementDialog({ 
  open, 
  onOpenChange, 
  measurement, 
  preferredUnit,
  onSave,
  isPending
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measurement: BodyMeasurement | null;
  preferredUnit: LengthUnit;
  onSave: (data: Partial<BodyMeasurement> & { date: string }) => void;
  isPending: boolean;
}) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [values, setValues] = useState<Record<string, string>>({});

  const measurementFields = [
    { key: "chest", label: "Chest" },
    { key: "waist", label: "Waist" },
    { key: "hips", label: "Hips" },
    { key: "leftArm", label: "Left Arm" },
    { key: "rightArm", label: "Right Arm" },
    { key: "leftThigh", label: "Left Thigh" },
    { key: "rightThigh", label: "Right Thigh" },
    { key: "neck", label: "Neck" },
  ] as const;

  useState(() => {
    if (measurement) {
      setDate(measurement.date);
      const newValues: Record<string, string> = {};
      measurementFields.forEach((field) => {
        const value = measurement[field.key];
        if (value !== null) {
          const converted = preferredUnit === "in" ? convertLength(value, "cm", "in") : value;
          newValues[field.key] = converted.toFixed(1);
        }
      });
      setValues(newValues);
    } else {
      setDate(format(new Date(), "yyyy-MM-dd"));
      setValues({});
    }
  });

  const handleSave = () => {
    const data: Partial<BodyMeasurement> & { date: string } = { date };
    
    measurementFields.forEach((field) => {
      const inputValue = values[field.key];
      if (inputValue) {
        const parsed = parseFloat(inputValue);
        if (!isNaN(parsed) && parsed > 0) {
          const valueInCm = preferredUnit === "in" ? convertLength(parsed, "in", "cm") : parsed;
          (data as any)[field.key] = valueInCm;
        }
      }
    });

    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{measurement ? "Edit Measurement" : "Add Measurement"}</DialogTitle>
          <DialogDescription>
            Record your body measurements. All fields are optional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={format(new Date(), "yyyy-MM-dd")}
              data-testid="input-measurement-date"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {measurementFields.map((field) => (
              <div key={field.key}>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {field.label} ({preferredUnit})
                </label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder={preferredUnit === "cm" ? "30.0" : "12.0"}
                  value={values[field.key] || ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  data-testid={`input-${field.key}`}
                />
              </div>
            ))}
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isPending || !date}
            data-testid="button-save-measurement"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryStrip({ summary, hasData, unit }: { 
  summary: ReturnType<typeof calculateChangeSummary>;
  hasData: boolean;
  unit: WeightUnit;
}) {
  const direction = summary.netChangeKg !== null 
    ? summary.netChangeKg > 0 ? "up" : summary.netChangeKg < 0 ? "down" : "neutral"
    : "neutral";

  return (
    <div 
      className="grid grid-cols-3 gap-4 p-4 bg-card rounded-xl border border-border"
      data-testid="summary-strip"
    >
      <SummaryItem 
        label="Start" 
        value={hasData && summary.startWeight ? formatWeight(summary.startWeight, unit) : "--"}
        sublabel={summary.startDate ? format(parseISO(summary.startDate), "MMM d") : undefined}
      />
      <SummaryItem 
        label="Current" 
        value={hasData && summary.currentWeight ? formatWeight(summary.currentWeight, unit) : "--"}
        sublabel={summary.currentDate ? format(parseISO(summary.currentDate), "MMM d") : undefined}
      />
      <SummaryItem 
        label="Change" 
        value={hasData && summary.netChangeKg !== null 
          ? `${summary.netChangeKg >= 0 ? "+" : ""}${summary.netChangeKg.toFixed(1)} ${unit}`
          : "--"
        }
        sublabel={hasData && summary.netChangePercent !== null 
          ? `${summary.netChangePercent >= 0 ? "+" : ""}${summary.netChangePercent.toFixed(1)}%`
          : undefined
        }
        direction={direction}
      />
    </div>
  );
}

function SummaryItem({ label, value, sublabel, direction }: {
  label: string;
  value: string;
  sublabel?: string;
  direction?: "up" | "down" | "neutral";
}) {
  return (
    <div className="text-center" data-testid={`summary-${label.toLowerCase()}`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-center justify-center gap-1">
        {direction === "up" && <ArrowUp className="w-3 h-3 text-muted-foreground/60" />}
        {direction === "down" && <ArrowDown className="w-3 h-3 text-muted-foreground/60" />}
        <p className="text-lg font-semibold">{value}</p>
      </div>
      {sublabel && (
        <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}

function TrendChart({ 
  data, 
  highlightedDate, 
  onPointClick,
  isLoading,
  unit
}: { 
  data: TrendDataPoint[];
  highlightedDate: string | null;
  onPointClick: (date: string) => void;
  isLoading: boolean;
  unit: WeightUnit;
}) {
  if (isLoading) {
    return (
      <div className="h-48 bg-card rounded-xl border border-border flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div 
        className="h-48 bg-card rounded-xl border border-border flex items-center justify-center"
        data-testid="chart-empty"
      >
        <p className="text-muted-foreground text-sm">No data yet</p>
      </div>
    );
  }

  const weights = data.map(d => d.trendWeight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = maxWeight - minWeight || 1;
  const padding = range * 0.1;
  const yMin = minWeight - padding;
  const yMax = maxWeight + padding;

  const chartWidth = 600;
  const chartHeight = 160;
  const paddingLeft = 50;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  const getX = (index: number) => paddingLeft + (index / (data.length - 1 || 1)) * graphWidth;
  const getY = (weight: number) => paddingTop + ((yMax - weight) / (yMax - yMin)) * graphHeight;

  const pathD = data
    .map((point, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(point.trendWeight)}`)
    .join(" ");

  const midWeight = (yMin + yMax) / 2;
  const yAxisLabels = [
    { value: yMax, y: paddingTop },
    { value: midWeight, y: paddingTop + graphHeight / 2 },
    { value: yMin, y: paddingTop + graphHeight },
  ];

  return (
    <div 
      className="bg-card rounded-xl border border-border p-4 overflow-hidden"
      data-testid="trend-chart"
    >
      <svg 
        viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
        className="w-full h-auto"
        style={{ maxHeight: "180px" }}
      >
        {yAxisLabels.map((label, i) => (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={label.y}
              x2={chartWidth - paddingRight}
              y2={label.y}
              stroke="currentColor"
              strokeOpacity={0.05}
              strokeWidth={1}
            />
            <text
              x={paddingLeft - 8}
              y={label.y + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {label.value.toFixed(1)}
            </text>
          </g>
        ))}

        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        />

        {data.map((point, i) => {
          const isHighlighted = point.date === highlightedDate;
          return (
            <circle
              key={point.date}
              cx={getX(i)}
              cy={getY(point.trendWeight)}
              r={isHighlighted ? 6 : 0}
              className={`fill-primary transition-all cursor-pointer`}
              style={{ opacity: isHighlighted ? 1 : 0 }}
              onClick={() => onPointClick(point.date)}
            />
          );
        })}

        {data.map((point, i) => (
          <rect
            key={`hit-${point.date}`}
            x={getX(i) - 10}
            y={getY(point.trendWeight) - 15}
            width={20}
            height={30}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => onPointClick(point.date)}
          />
        ))}
      </svg>
    </div>
  );
}

function EntriesList({ 
  entries, 
  highlightedDate, 
  onEntryClick,
  onEdit,
  onAddNew,
  unit
}: { 
  entries: ExtendedEntry[];
  highlightedDate: string | null;
  onEntryClick: (date: string) => void;
  onEdit: (entry: ExtendedEntry) => void;
  onAddNew: () => void;
  unit: WeightUnit;
}) {
  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div data-testid="entries-section">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Entries
        </h2>
        <button
          onClick={onAddNew}
          className="text-sm text-primary hover:text-primary/80 transition-colors"
          data-testid="button-add-entry"
        >
          + Add
        </button>
      </div>

      {sortedEntries.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          No entries recorded yet
        </div>
      ) : (
        <div className="space-y-1">
          {sortedEntries.map((entry) => {
            const displayWeight = unit === "lb" 
              ? convertWeight(entry.weight, "kg", "lb") 
              : entry.weight;
            const isDevice = entry.source === "device";
            
            return (
              <div
                key={entry.id || entry.date}
                onClick={() => onEntryClick(entry.date)}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                  highlightedDate === entry.date
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-card border border-transparent hover:border-border"
                }`}
                data-testid={`entry-${entry.date}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatWeight(displayWeight, unit)}</span>
                  <span className="text-sm text-muted-foreground">
                    {format(parseISO(entry.date), "MMM d, yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isDevice && (
                    <Smartphone className="w-4 h-4 text-muted-foreground/50" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(entry);
                    }}
                    className="p-1.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    data-testid={`button-edit-${entry.date}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AICommentary({ 
  interpretation, 
  showToggle,
  isEnabled,
  onToggle
}: { 
  interpretation: AIInterpretation;
  showToggle: boolean;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  if (!showToggle) {
    return null;
  }

  return (
    <div className="mb-6" data-testid="ai-commentary-section">
      {interpretation.shouldShow && interpretation.message && (
        <div 
          className="p-4 bg-card rounded-xl border border-border mb-3"
          data-testid="ai-commentary-message"
        >
          <div className="flex items-start gap-3">
            <MessageSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground leading-relaxed">
              {interpretation.message}
            </p>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">
          AI insights
        </span>
        <Switch
          checked={isEnabled}
          onCheckedChange={onToggle}
          data-testid="toggle-ai-commentary"
        />
      </div>
    </div>
  );
}
