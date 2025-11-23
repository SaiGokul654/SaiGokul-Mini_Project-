import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Download, FileText, Sparkles, UserCircle, Camera, ClipboardList, Activity, Calendar, Clock, AlertCircle, Hospital as HospitalIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthUser, clearAuthUser } from "@/lib/auth";
import { generatePatientHistoryPDF, generateAISummaryPDF } from "@/lib/pdf-generator";
import { RiskBadge } from "@/components/risk-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLocation } from "wouter";
import type { Patient, HealthRecord, Hospital, Doctor } from "@shared/schema";
import { LabResults } from "@/components/LabResults";
import { PredictionDashboard } from "@/components/PredictionDashboard";
import { motion } from "framer-motion";

type PatientWithRecords = Patient & {
  healthRecords: Array<HealthRecord & { hospital: Hospital; doctor: Doctor }>;
};

export default function DoctorDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const user = getAuthUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"id" | "name" | "phone">("name");
  const [selectedPatient, setSelectedPatient] = useState<PatientWithRecords | null>(null);
  const [noteText, setNoteText] = useState("");
  const [summaryData, setSummaryData] = useState<{ summary: string } | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [showFaceRecognition, setShowFaceRecognition] = useState(false);

  const { data: searchResults, isLoading: isSearching } = useQuery<PatientWithRecords[]>({
    queryKey: [`/api/patients/search?q=${searchQuery}&type=${searchType}`],
    enabled: searchQuery.length > 0,
  });

  const { data: stats } = useQuery<{
    totalPatients: number;
    recentCases: number;
    totalConsultations: number;
    criticalCases: number;
  }>({
    queryKey: [`/api/doctors/stats?doctorId=${user?.roleId}`],
    enabled: !!user?.roleId
  });

  const aiSummaryMutation = useMutation({
    mutationFn: async (patientId: string) => {
      return await apiRequest("POST", "/api/ai/summarize", { patientId });
    },
    onSuccess: (data) => {
      toast({
        title: "AI Summary Generated",
        description: "Review the summary before downloading",
      });
      setSummaryData(data);
      setIsSummaryModalOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate summary",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ recordId, note }: { recordId: string; note: string }) => {
      return await apiRequest("POST", "/api/notes", {
        healthRecordId: recordId,
        doctorUserId: user?.id,
        note,
      });
    },
    onSuccess: () => {
      toast({
        title: "Note added",
        description: "Your note has been saved successfully",
      });
      setNoteText("");
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key0 = (query as any).queryKey?.[0];
          return typeof key0 === "string" && key0.startsWith('/api/patients/search');
        }
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add note",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const faceRecognitionMutation = useMutation({
    mutationFn: async (imageData: string) => {
      return await apiRequest("POST", "/api/face-recognition", { imageData });
    },
    onSuccess: (patient: PatientWithRecords) => {
      setSelectedPatient(patient);
      setShowFaceRecognition(false);
      toast({
        title: "Patient Identified",
        description: `Found: ${patient.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Recognition failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownloadPDF = () => {
    if (selectedPatient) {
      generatePatientHistoryPDF(
        selectedPatient,
        selectedPatient.healthRecords,
        `${selectedPatient.name}-health-history.pdf`
      );
      toast({
        title: "PDF Downloaded",
        description: "Patient history has been saved",
      });
    }
  };

  const handleAISummary = () => {
    if (selectedPatient) {
      aiSummaryMutation.mutate(selectedPatient.id);
    }
  };

  const handleLogout = () => {
    clearAuthUser();
    navigate("/");
  };

  if (!user || user.role !== "doctor") {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background/50">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Doctor Portal</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-full">
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <p className="font-medium leading-none">Dr. {user.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Cardiology</p>
              </div>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <AlertCircle className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between"
        >
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard Overview</h2>
            <p className="text-muted-foreground mt-1">Track your patients and consultations in real-time.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border px-4 py-2 rounded-full shadow-sm">
            <Calendar className="h-4 w-4" />
            <span>{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </motion.div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="hover-elevate transition-all duration-300 border-l-4 border-l-primary">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Patients</CardTitle>
                  <UserCircle className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-patients">{stats.totalPatients || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">+2 from last week</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="hover-elevate transition-all duration-300 border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Consultations</CardTitle>
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-consultations">{stats.totalConsultations || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total records created</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="hover-elevate transition-all duration-300 border-l-4 border-l-green-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Recent Cases</CardTitle>
                  <Clock className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-recent-cases">{stats.recentCases || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">In the last 30 days</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="hover-elevate transition-all duration-300 border-l-4 border-l-destructive">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Critical Cases</CardTitle>
                  <Activity className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive" data-testid="text-critical-cases">{stats.criticalCases || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Requires immediate attention</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Search & List */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="h-full border-none shadow-lg bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Find Patient
                </CardTitle>
                <CardDescription>Search by ID, name, or phone</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs value={searchType} onValueChange={(v) => setSearchType(v as typeof searchType)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="name">Name</TabsTrigger>
                    <TabsTrigger value="id">ID</TabsTrigger>
                    <TabsTrigger value="phone">Phone</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={`Search by ${searchType}...`}
                      className="pl-10 h-11 bg-background"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <Dialog open={showFaceRecognition} onOpenChange={setShowFaceRecognition}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full h-11 border-dashed">
                        <Camera className="h-4 w-4 mr-2" />
                        Scan Face ID
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Face Recognition Demo</DialogTitle>
                        <DialogDescription>
                          This is a demo feature. In production, this would use live camera feed.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="bg-muted rounded-lg h-64 flex items-center justify-center border-2 border-dashed">
                          <Camera className="h-16 w-16 text-muted-foreground/50" />
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => faceRecognitionMutation.mutate("demo-image")}
                          disabled={faceRecognitionMutation.isPending}
                        >
                          {faceRecognitionMutation.isPending ? "Scanning..." : "Simulate Scan"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {isSearching && (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-xl" />
                      ))}
                    </div>
                  )}

                  {searchResults?.map((patient) => (
                    <motion.div
                      key={patient.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card
                        className={`cursor-pointer transition-all duration-200 border-l-4 ${selectedPatient?.id === patient.id
                          ? "border-l-primary bg-primary/5 shadow-md"
                          : "border-l-transparent hover:border-l-primary/50"
                          }`}
                        onClick={() => setSelectedPatient(patient)}
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                            <AvatarImage src={patient.profileImage || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                              {patient.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{patient.name}</h3>
                            <p className="text-xs text-muted-foreground font-mono truncate">{patient.patientId}</p>
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            {patient.healthRecords?.length || 0}
                          </Badge>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}

                  {searchQuery && searchResults?.length === 0 && !isSearching && (
                    <div className="text-center py-12 text-muted-foreground">
                      <UserCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>No patients found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Patient Details */}
          <div className="lg:col-span-2">
            {selectedPatient ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden">
                  <div className="h-32 bg-gradient-to-r from-primary/20 to-accent/20" />
                  <CardHeader className="relative pt-0">
                    <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 -mt-12 px-2">
                      <div className="flex items-end gap-6">
                        <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
                          <AvatarImage src={selectedPatient.profileImage || undefined} />
                          <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                            {selectedPatient.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="mb-2">
                          <CardTitle className="text-3xl font-bold">{selectedPatient.name}</CardTitle>
                          <CardDescription className="font-mono text-base flex items-center gap-2">
                            <Badge variant="outline" className="font-normal">ID: {selectedPatient.patientId}</Badge>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2 mb-2 w-full md:w-auto">
                        <Button variant="outline" onClick={handleDownloadPDF} className="flex-1 md:flex-none">
                          <Download className="h-4 w-4 mr-2" />
                          History PDF
                        </Button>
                        <Button
                          onClick={handleAISummary}
                          disabled={aiSummaryMutation.isPending}
                          className="flex-1 md:flex-none bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          {aiSummaryMutation.isPending ? "Analyzing..." : "AI Summary"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-background/50 border shadow-sm">
                        <p className="text-sm text-muted-foreground mb-1">Age</p>
                        <p className="text-lg font-semibold">{selectedPatient.age || "N/A"}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-background/50 border shadow-sm">
                        <p className="text-sm text-muted-foreground mb-1">Gender</p>
                        <p className="text-lg font-semibold capitalize">{selectedPatient.gender || "N/A"}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-background/50 border shadow-sm">
                        <p className="text-sm text-muted-foreground mb-1">Blood Group</p>
                        <p className="text-lg font-semibold">{selectedPatient.bloodGroup || "N/A"}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-background/50 border shadow-sm">
                        <p className="text-sm text-muted-foreground mb-1">Contact</p>
                        <p className="text-lg font-semibold">{selectedPatient.phone || "N/A"}</p>
                      </div>
                    </div>

                    <Tabs defaultValue="history" className="w-full">
                      <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                        <TabsTrigger
                          value="history"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3"
                        >
                          Medical History
                        </TabsTrigger>
                        <TabsTrigger
                          value="labs"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3"
                        >
                          Lab Results
                        </TabsTrigger>
                        <TabsTrigger
                          value="predictions"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3"
                        >
                          AI Predictions
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="history" className="mt-6 space-y-6">
                        {selectedPatient.healthRecords && selectedPatient.healthRecords.length > 0 ? (
                          <div className="space-y-4">
                            {selectedPatient.healthRecords.map((record) => (
                              <Card key={record.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                <div className={`h-1 w-full ${record.riskLevel === 'critical' ? 'bg-destructive' :
                                  record.riskLevel === 'high' ? 'bg-orange-500' :
                                    'bg-emerald-500'
                                  }`} />
                                <CardContent className="p-6 space-y-4">
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-3">
                                        <h4 className="font-bold text-lg">{record.diseaseName}</h4>
                                        <RiskBadge level={record.riskLevel as any} />
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(record.dateTime).toLocaleDateString()}
                                        <span className="text-border">|</span>
                                        <Clock className="h-3 w-3" />
                                        {new Date(record.dateTime).toLocaleTimeString()}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid md:grid-cols-2 gap-6 text-sm bg-muted/30 p-4 rounded-lg">
                                    <div className="space-y-3">
                                      <div>
                                        <span className="font-medium text-muted-foreground block mb-1">Hospital Details</span>
                                        <div className="flex items-center gap-2">
                                          <HospitalIcon className="h-4 w-4 text-primary" />
                                          <span>{record.hospital.name}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground ml-6">{record.hospital.location}</p>
                                      </div>
                                      <div>
                                        <span className="font-medium text-muted-foreground block mb-1">Attending Doctor</span>
                                        <div className="flex items-center gap-2">
                                          <UserCircle className="h-4 w-4 text-primary" />
                                          <span>Dr. {record.doctor.name}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground ml-6">{record.doctor.specialization || "General Physician"}</p>
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <div>
                                        <span className="font-medium text-muted-foreground block mb-1">Diagnosis</span>
                                        <p className="leading-relaxed">{record.diseaseDescription}</p>
                                      </div>
                                      {record.treatment && (
                                        <div>
                                          <span className="font-medium text-muted-foreground block mb-1">Treatment Plan</span>
                                          <p className="leading-relaxed">{record.treatment}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {record.emergencyWarnings && (
                                    <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex gap-3">
                                      <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                                      <div>
                                        <h5 className="font-semibold text-destructive mb-1">Emergency Warning</h5>
                                        <p className="text-sm text-destructive/80">{record.emergencyWarnings}</p>
                                      </div>
                                    </div>
                                  )}

                                  {record.mediaFiles && record.mediaFiles.length > 0 && (
                                    <div>
                                      <p className="text-sm font-medium mb-2">Attached Documents</p>
                                      <div className="flex flex-wrap gap-2">
                                        {record.mediaFiles.map((file, idx) => (
                                          <Badge key={idx} variant="secondary" className="pl-1 pr-3 py-1 h-auto">
                                            <FileText className="h-3 w-3 mr-1" />
                                            {file.name}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="pt-4 border-t">
                                    <label className="text-sm font-medium mb-2 block">Doctor's Notes</label>
                                    <div className="flex gap-2">
                                      <Textarea
                                        placeholder="Add clinical observations..."
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        className="min-h-[80px] bg-background"
                                      />
                                      <Button
                                        className="self-end"
                                        onClick={() => addNoteMutation.mutate({ recordId: record.id, note: noteText })}
                                        disabled={!noteText || addNoteMutation.isPending}
                                      >
                                        Save Note
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 border-2 border-dashed rounded-xl">
                            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                            <h3 className="text-lg font-medium">No Medical Records</h3>
                            <p className="text-muted-foreground">This patient has no history records yet.</p>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="labs" className="mt-6">
                        <LabResults patientId={selectedPatient.id} canUpload={false} />
                      </TabsContent>

                      <TabsContent value="predictions" className="mt-6">
                        <PredictionDashboard patientId={selectedPatient.id} canGenerate={true} />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center p-12 text-center border-2 border-dashed rounded-xl bg-muted/10">
                <div className="max-w-md space-y-4">
                  <div className="bg-primary/10 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto">
                    <Search className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold">Select a Patient</h3>
                  <p className="text-muted-foreground">
                    Search for a patient using the panel on the left to view their complete medical history, lab results, and AI predictions.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog open={isSummaryModalOpen} onOpenChange={setIsSummaryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Health Summary Preview</DialogTitle>
            <DialogDescription>
              Review the AI-generated summary for {selectedPatient?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/30 p-4 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap">
            {summaryData?.summary}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setIsSummaryModalOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (selectedPatient && summaryData) {
                  generateAISummaryPDF(selectedPatient.name, summaryData.summary);
                  setIsSummaryModalOpen(false);
                  toast({
                    title: "PDF Downloaded",
                    description: "Summary PDF has been saved",
                  });
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

