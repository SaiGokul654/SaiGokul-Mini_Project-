import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, Plus, Hospital as HospitalIcon, Clock, AlertCircle, Edit, Search, Download, FileText, User, Calendar, CheckCircle2, Activity, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthUser, clearAuthUser } from "@/lib/auth";
import { generatePatientHistoryPDF } from "@/lib/pdf-generator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/risk-badge";
import { LabResults } from "@/components/LabResults";
import { motion } from "framer-motion";
import type { Patient, HealthRecord, Hospital, Doctor } from "@shared/schema";

type UploadFormData = {
  patientId: string;
  doctorId: string;
  dateTime: string;
  diseaseName: string;
  diseaseDescription: string;
  treatment: string;
  prescription: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  emergencyWarnings: string;
  mediaFiles: Array<{ type: string; url: string; name: string }>;
};

type EditFormData = {
  id: string;
  patientId: string;
  doctorId: string;
  dateTime: string;
  diseaseName: string;
  diseaseDescription: string;
  treatment: string;
  prescription: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  emergencyWarnings: string;
  mediaFiles: Array<{ type: string; url: string; name: string }>;
};

// Use the imported types where possible, but for search results we might need a composite type
type PatientWithRecords = Patient & {
  healthRecords: Array<HealthRecord & { hospital: Hospital; doctor: Doctor }>;
};

export default function HospitalDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const user = getAuthUser();
  const [formData, setFormData] = useState<UploadFormData>({
    patientId: "",
    doctorId: "",
    dateTime: new Date().toISOString().slice(0, 16),
    diseaseName: "",
    diseaseDescription: "",
    treatment: "",
    prescription: "",
    riskLevel: "low",
    emergencyWarnings: "",
    mediaFiles: [],
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"id" | "name" | "phone">("name");
  const [selectedPatient, setSelectedPatient] = useState<PatientWithRecords | null>(null);

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["/api/patients/all"],
    enabled: !!user,
  });

  const { data: doctors } = useQuery<Doctor[]>({
    queryKey: [`/api/doctors/hospital?hospitalId=${user?.roleId}`],
    enabled: !!user,
  });

  const { data: recentRecords } = useQuery<any[]>({
    queryKey: [`/api/health-records/recent?hospitalId=${user?.roleId}`],
    enabled: !!user,
  });

  const { data: searchResults, isLoading: isSearching } = useQuery<PatientWithRecords[]>({
    queryKey: [`/api/patients/search?q=${searchQuery}&type=${searchType}`],
    enabled: searchQuery.length > 0,
  });

  const { data: selectedPatientDetails } = useQuery<PatientWithRecords>({
    queryKey: [`/api/patients/${formData.patientId}/details`],
    enabled: !!formData.patientId && formData.patientId.length > 0,
  });

  useEffect(() => {
    if (selectedPatientDetails) {
      setSelectedPatient(selectedPatientDetails);
    }
  }, [selectedPatientDetails]);

  const createRecordMutation = useMutation({
    mutationFn: async (data: UploadFormData) => {
      return await apiRequest("POST", `/api/health-records?hospitalId=${user?.roleId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Record created successfully",
        description: "Patient health record has been uploaded. You have 1 hour to edit it.",
      });
      setFormData({
        patientId: "",
        doctorId: "",
        dateTime: new Date().toISOString().slice(0, 16),
        diseaseName: "",
        diseaseDescription: "",
        treatment: "",
        prescription: "",
        riskLevel: "low",
        emergencyWarnings: "",
        mediaFiles: [],
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key0 = (query as any).queryKey?.[0];
          return typeof key0 === 'string' && key0.startsWith('/api/health-records/recent');
        }
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editRecordMutation = useMutation({
    mutationFn: async (data: EditFormData) => {
      const { id, ...updateData } = data;
      return await apiRequest("PATCH", `/api/health-records/${id}`, updateData);
    },
    onSuccess: () => {
      toast({
        title: "Record updated successfully",
        description: "Patient health record has been updated.",
      });
      setIsEditModalOpen(false);
      setEditFormData(null);
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key0 = (query as any).queryKey?.[0];
          return typeof key0 === 'string' && key0.startsWith('/api/health-records/recent');
        }
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId || !formData.doctorId || !formData.diseaseName || !formData.diseaseDescription) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createRecordMutation.mutate(formData);
  };

  const handleLogout = () => {
    clearAuthUser();
    navigate("/");
  };

  const handleEditRecord = (record: any) => {
    setEditFormData({
      id: record.id,
      patientId: record.patientId,
      doctorId: record.doctorId,
      dateTime: new Date(record.dateTime).toISOString().slice(0, 16),
      diseaseName: record.diseaseName,
      diseaseDescription: record.diseaseDescription,
      treatment: record.treatment || "",
      prescription: record.prescription || "",
      riskLevel: record.riskLevel,
      emergencyWarnings: record.emergencyWarnings || "",
      mediaFiles: record.mediaFiles || [],
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData) return;
    editRecordMutation.mutate(editFormData);
  };

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

  if (!user || user.role !== "hospital") {
    navigate("/");
    return null;
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low": return "bg-emerald-500";
      case "medium": return "bg-yellow-500";
      case "high": return "bg-orange-500";
      case "critical": return "bg-destructive";
      default: return "bg-muted";
    }
  };

  return (
    <div className="min-h-screen bg-background/50">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <HospitalIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Hospital Portal</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-full">
              <div className="text-sm text-right">
                <p className="font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Administration</p>
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
        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Patient Search
              </CardTitle>
              <CardDescription>Search by patient ID, name, or phone number to manage records</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                <Tabs value={searchType} onValueChange={(v) => setSearchType(v as typeof searchType)} className="w-full md:w-auto">
                  <TabsList>
                    <TabsTrigger value="name">Name</TabsTrigger>
                    <TabsTrigger value="id">Patient ID</TabsTrigger>
                    <TabsTrigger value="phone">Phone</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Search by ${searchType}...`}
                    className="pl-10 bg-background"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {isSearching && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                  ))}
                </div>
              )}

              {searchResults && searchResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.map((patient) => (
                    <motion.div
                      key={patient.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.02 }}
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
                            {patient.healthRecords?.length || 0} records
                          </Badge>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}

              {searchQuery && searchResults && searchResults.length === 0 && !isSearching && (
                <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border-2 border-dashed">
                  <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No patients found matching "{searchQuery}"</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {selectedPatient && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="overflow-hidden border-none shadow-lg">
              <div className="h-24 bg-gradient-to-r from-primary/10 to-accent/10" />
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
                      <CardTitle className="text-2xl font-bold">{selectedPatient.name}</CardTitle>
                      <CardDescription className="font-mono">{selectedPatient.patientId}</CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleDownloadPDF} className="mb-2">
                    <Download className="h-4 w-4 mr-2" />
                    Download History PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-muted/20 border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Age</p>
                    <p className="font-semibold">{selectedPatient.age || "N/A"}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/20 border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Gender</p>
                    <p className="font-semibold capitalize">{selectedPatient.gender || "N/A"}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/20 border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Blood Group</p>
                    <p className="font-semibold">{selectedPatient.bloodGroup || "N/A"}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/20 border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Contact</p>
                    <p className="font-semibold">{selectedPatient.phone || "N/A"}</p>
                  </div>
                </div>

                <Tabs defaultValue="history" className="w-full">
                  <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                    <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3">
                      Medical History
                    </TabsTrigger>
                    <TabsTrigger value="labs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3">
                      Lab Results
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="history" className="mt-6">
                    {selectedPatient.healthRecords && selectedPatient.healthRecords.length > 0 ? (
                      <div className="space-y-4">
                        {selectedPatient.healthRecords.map((record) => (
                          <Card key={record.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-full ${getRiskColor(record.riskLevel)} bg-opacity-10`}>
                                    <Activity className={`h-5 w-5 ${record.riskLevel === 'critical' ? 'text-destructive' : 'text-primary'}`} />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-lg">{record.diseaseName}</h4>
                                    <p className="text-sm text-muted-foreground">{new Date(record.dateTime).toLocaleString()}</p>
                                  </div>
                                </div>
                                <RiskBadge level={record.riskLevel as any} />
                              </div>
                              <div className="grid md:grid-cols-2 gap-6 text-sm">
                                <div className="space-y-2">
                                  <p><span className="font-medium">Doctor:</span> Dr. {record.doctor.name}</p>
                                  <p><span className="font-medium">Hospital:</span> {record.hospital.name}</p>
                                  <p className="mt-2 text-muted-foreground">{record.diseaseDescription}</p>
                                </div>
                                {record.emergencyWarnings && (
                                  <div className="bg-destructive/5 p-3 rounded-lg border border-destructive/10">
                                    <p className="font-medium text-destructive flex items-center gap-2">
                                      <AlertCircle className="h-4 w-4" /> Warning
                                    </p>
                                    <p className="text-destructive/80 mt-1">{record.emergencyWarnings}</p>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                        <p>No medical records found</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="labs" className="mt-6">
                    <LabResults patientId={selectedPatient.id} canUpload={true} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  New Health Record
                </CardTitle>
                <CardDescription>
                  Create a new medical record for a patient. Records are editable for 1 hour.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="patientId">Patient *</Label>
                      <Select
                        value={formData.patientId}
                        onValueChange={(value) => setFormData({ ...formData, patientId: value })}
                      >
                        <SelectTrigger id="patientId" className="bg-background">
                          <SelectValue placeholder="Select patient" />
                        </SelectTrigger>
                        <SelectContent>
                          {patients?.map((patient) => (
                            <SelectItem key={patient.id} value={patient.id}>
                              {patient.name} ({patient.patientId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="doctorId">Treating Doctor *</Label>
                      <Select
                        value={formData.doctorId}
                        onValueChange={(value) => setFormData({ ...formData, doctorId: value })}
                      >
                        <SelectTrigger id="doctorId" className="bg-background">
                          <SelectValue placeholder="Select doctor" />
                        </SelectTrigger>
                        <SelectContent>
                          {doctors?.map((doctor) => (
                            <SelectItem key={doctor.id} value={doctor.id}>
                              {doctor.name} ({doctor.specialization || "General"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dateTime">Date & Time *</Label>
                      <Input
                        id="dateTime"
                        type="datetime-local"
                        value={formData.dateTime}
                        onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
                        className="bg-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="riskLevel">Risk Level *</Label>
                      <Select
                        value={formData.riskLevel}
                        onValueChange={(value: any) => setFormData({ ...formData, riskLevel: value })}
                      >
                        <SelectTrigger id="riskLevel" className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low Risk</SelectItem>
                          <SelectItem value="medium">Medium Risk</SelectItem>
                          <SelectItem value="high">High Risk</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="diseaseName">Condition / Diagnosis *</Label>
                    <Input
                      id="diseaseName"
                      placeholder="e.g., Acute Bronchitis"
                      value={formData.diseaseName}
                      onChange={(e) => setFormData({ ...formData, diseaseName: e.target.value })}
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="diseaseDescription">Clinical Description *</Label>
                    <Textarea
                      id="diseaseDescription"
                      placeholder="Detailed description of symptoms and findings..."
                      value={formData.diseaseDescription}
                      onChange={(e) => setFormData({ ...formData, diseaseDescription: e.target.value })}
                      rows={4}
                      className="bg-background resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="treatment">Treatment Plan</Label>
                      <Textarea
                        id="treatment"
                        placeholder="Procedures and care instructions..."
                        value={formData.treatment}
                        onChange={(e) => setFormData({ ...formData, treatment: e.target.value })}
                        rows={3}
                        className="bg-background resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prescription">Prescription</Label>
                      <Textarea
                        id="prescription"
                        placeholder="Medications and dosage..."
                        value={formData.prescription}
                        onChange={(e) => setFormData({ ...formData, prescription: e.target.value })}
                        rows={3}
                        className="bg-background resize-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergencyWarnings" className="text-destructive">Emergency Warnings</Label>
                    <Textarea
                      id="emergencyWarnings"
                      placeholder="Critical alerts or immediate actions required..."
                      value={formData.emergencyWarnings}
                      onChange={(e) => setFormData({ ...formData, emergencyWarnings: e.target.value })}
                      rows={2}
                      className="bg-destructive/5 border-destructive/20 resize-none focus-visible:ring-destructive/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Media Attachments</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            const newMediaFiles = await Promise.all(files.map(async (file) => {
                              return new Promise<{ type: string; url: string; name: string }>((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  resolve({
                                    type: file.type.startsWith('image/') ? 'image' : 'document',
                                    url: reader.result as string,
                                    name: file.name
                                  });
                                };
                                reader.readAsDataURL(file);
                              });
                            }));
                            setFormData(prev => ({ ...prev, mediaFiles: [...prev.mediaFiles, ...newMediaFiles] }));
                          }}
                        />
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">Images or PDF files</p>
                      </div>

                      <div className="space-y-2">
                        {formData.mediaFiles.length > 0 ? (
                          formData.mediaFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-md border bg-background">
                              <div className="flex items-center gap-2 overflow-hidden">
                                {file.type === 'image' ? (
                                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                                    <img src={file.url} alt={file.name} className="h-full w-full object-cover rounded" />
                                  </div>
                                ) : (
                                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                                    <FileText className="h-4 w-4" />
                                  </div>
                                )}
                                <span className="text-sm truncate">{file.name}</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => setFormData(prev => ({
                                  ...prev,
                                  mediaFiles: prev.mediaFiles.filter((_, i) => i !== idx)
                                }))}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex items-center justify-center text-muted-foreground text-sm border rounded-lg bg-muted/10">
                            No files attached
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setFormData({
                        patientId: "",
                        doctorId: "",
                        dateTime: new Date().toISOString().slice(0, 16),
                        diseaseName: "",
                        diseaseDescription: "",
                        treatment: "",
                        prescription: "",
                        riskLevel: "low",
                        emergencyWarnings: "",
                        mediaFiles: [],
                      })}
                    >
                      Reset Form
                    </Button>
                    <Button
                      type="submit"
                      disabled={createRecordMutation.isPending}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {createRecordMutation.isPending ? "Uploading..." : "Upload Record"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-5 w-5 text-primary" />
                  Recent Uploads
                </CardTitle>
                <CardDescription>Records uploaded in the last 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                {recentRecords && recentRecords.length > 0 ? (
                  <div className="space-y-3">
                    {recentRecords.map((record: any) => (
                      <Card key={record.id} className="p-3 bg-muted/20 border-none">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm truncate">{record.diseaseName}</h4>
                              <p className="text-xs text-muted-foreground">
                                {new Date(record.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${getRiskColor(record.riskLevel)} shrink-0 mt-1.5`} />
                          </div>

                          {record.isEditable && record.editableUntil && (
                            <div className="flex items-center justify-between pt-2 border-t border-border/50">
                              <span className="text-xs text-primary font-medium flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {Math.max(0, Math.floor((new Date(record.editableUntil).getTime() - Date.now()) / 60000))}m left
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditRecord(record)}
                                className="h-6 px-2 text-xs hover:bg-primary/10 hover:text-primary"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No recent uploads
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <p className="text-muted-foreground">Records are editable for <span className="font-medium text-foreground">1 hour</span> after upload.</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <p className="text-muted-foreground">Ensure all mandatory fields marked with <span className="text-destructive">*</span> are filled.</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <p className="text-muted-foreground">Verify patient identity before uploading sensitive data.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Health Record</DialogTitle>
            <DialogDescription>
              Update the patient health record details.
            </DialogDescription>
          </DialogHeader>
          {editFormData && (
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-patientId">Patient *</Label>
                  <Select
                    value={editFormData.patientId}
                    onValueChange={(value) => setEditFormData({ ...editFormData, patientId: value })}
                    disabled
                  >
                    <SelectTrigger id="edit-patientId">
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients?.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.name} ({patient.patientId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-doctorId">Treating Doctor *</Label>
                  <Select
                    value={editFormData.doctorId}
                    onValueChange={(value) => setEditFormData({ ...editFormData, doctorId: value })}
                  >
                    <SelectTrigger id="edit-doctorId">
                      <SelectValue placeholder="Select doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors?.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          {doctor.name} ({doctor.specialization || "General"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-dateTime">Date & Time *</Label>
                  <Input
                    id="edit-dateTime"
                    type="datetime-local"
                    value={editFormData.dateTime}
                    onChange={(e) => setEditFormData({ ...editFormData, dateTime: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-riskLevel">Risk Level *</Label>
                  <Select
                    value={editFormData.riskLevel}
                    onValueChange={(value: any) => setEditFormData({ ...editFormData, riskLevel: value })}
                  >
                    <SelectTrigger id="edit-riskLevel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-diseaseName">Disease/Condition Name *</Label>
                <Input
                  id="edit-diseaseName"
                  value={editFormData.diseaseName}
                  onChange={(e) => setEditFormData({ ...editFormData, diseaseName: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-diseaseDescription">Description *</Label>
                <Textarea
                  id="edit-diseaseDescription"
                  value={editFormData.diseaseDescription}
                  onChange={(e) => setEditFormData({ ...editFormData, diseaseDescription: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-treatment">Treatment</Label>
                  <Textarea
                    id="edit-treatment"
                    value={editFormData.treatment}
                    onChange={(e) => setEditFormData({ ...editFormData, treatment: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-prescription">Prescription</Label>
                  <Textarea
                    id="edit-prescription"
                    value={editFormData.prescription}
                    onChange={(e) => setEditFormData({ ...editFormData, prescription: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-emergencyWarnings">Emergency Warnings</Label>
                <Textarea
                  id="edit-emergencyWarnings"
                  value={editFormData.emergencyWarnings}
                  onChange={(e) => setEditFormData({ ...editFormData, emergencyWarnings: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editRecordMutation.isPending}>
                  {editRecordMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
