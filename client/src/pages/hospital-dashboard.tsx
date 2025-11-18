import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, Plus, Hospital as HospitalIcon, Clock, AlertCircle, Edit, Search, Download } from "lucide-react";
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
};

type PatientWithRecords = {
  id: string;
  patientId: string;
  name: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  profileImage?: string;
  healthRecords: Array<{
    id: string;
    dateTime: string;
    diseaseName: string;
    diseaseDescription: string;
    treatment?: string;
    prescription?: string;
    riskLevel: string;
    emergencyWarnings?: string;
    hospital: { name: string; location: string };
    doctor: { name: string; specialization?: string };
  }>;
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
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"id" | "name" | "phone">("name");
  const [selectedPatient, setSelectedPatient] = useState<PatientWithRecords | null>(null);

  const { data: patients } = useQuery<any[]>({
    queryKey: ["/api/patients/all"],
    enabled: !!user,
  });

  const { data: doctors } = useQuery<any[]>({
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
      case "low": return "bg-green-500";
      case "medium": return "bg-yellow-500";
      case "high": return "bg-orange-500";
      case "critical": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HospitalIcon className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Hospital Portal</h1>
              <p className="text-sm text-muted-foreground">Welcome, {user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Patient Search</CardTitle>
            <CardDescription>Search by patient ID, name, or phone number</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as typeof searchType)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="name">Name</TabsTrigger>
                <TabsTrigger value="id">Patient ID</TabsTrigger>
                <TabsTrigger value="phone">Phone</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search by ${searchType}...`}
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {isSearching && (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {searchResults && searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((patient: PatientWithRecords) => (
                  <Card
                    key={patient.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={patient.profileImage || undefined} />
                          <AvatarFallback>{patient.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{patient.name}</h3>
                          <p className="text-sm text-muted-foreground font-mono">{patient.patientId}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{patient.healthRecords?.length || 0} records</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {searchQuery && searchResults && searchResults.length === 0 && !isSearching && (
              <div className="text-center py-8 text-muted-foreground">
                No patients found matching "{searchQuery}"
              </div>
            )}
          </CardContent>
        </Card>

        {selectedPatient && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedPatient.profileImage || undefined} />
                    <AvatarFallback className="text-xl">{selectedPatient.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-2xl">{selectedPatient.name}</CardTitle>
                    <CardDescription className="font-mono">{selectedPatient.patientId}</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleDownloadPDF}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Age</p>
                  <p className="font-medium">{selectedPatient.age || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gender</p>
                  <p className="font-medium">{selectedPatient.gender || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Blood Group</p>
                  <p className="font-medium">{selectedPatient.bloodGroup || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedPatient.phone || "N/A"}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Medical History</h3>
                {selectedPatient.healthRecords && selectedPatient.healthRecords.length > 0 ? (
                  <div className="space-y-4">
                    {selectedPatient.healthRecords.map((record) => (
                      <Card key={record.id}>
                        <CardContent className="p-6 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-lg">{record.diseaseName}</h4>
                                <RiskBadge level={record.riskLevel as any} />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {new Date(record.dateTime).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Hospital: </span>
                              {record.hospital.name} ({record.hospital.location})
                            </div>
                            <div>
                              <span className="font-medium">Doctor: </span>
                              {record.doctor.name} - {record.doctor.specialization || "General"}
                            </div>
                            <div>
                              <span className="font-medium">Description: </span>
                              {record.diseaseDescription}
                            </div>
                            {record.treatment && (
                              <div>
                                <span className="font-medium">Treatment: </span>
                                {record.treatment}
                              </div>
                            )}
                            {record.emergencyWarnings && (
                              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mt-2">
                                <span className="font-medium text-destructive">⚠ Warning: </span>
                                {record.emergencyWarnings}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No medical records found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Upload Patient Health Record
                </CardTitle>
                <CardDescription>
                  Add new patient medical records. Records can be edited for 1 hour after upload.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="patientId">Patient *</Label>
                      <Select
                        value={formData.patientId}
                        onValueChange={(value) => setFormData({ ...formData, patientId: value })}
                      >
                        <SelectTrigger id="patientId" data-testid="select-patient">
                          <SelectValue placeholder="Select patient" />
                        </SelectTrigger>
                        <SelectContent>
                          {patients?.map((patient: any) => (
                            <SelectItem key={patient.id} value={patient.id}>
                              {patient.name} ({patient.patientId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="doctorId">Treating Doctor *</Label>
                      <Select
                        value={formData.doctorId}
                        onValueChange={(value) => setFormData({ ...formData, doctorId: value })}
                      >
                        <SelectTrigger id="doctorId" data-testid="select-doctor">
                          <SelectValue placeholder="Select doctor" />
                        </SelectTrigger>
                        <SelectContent>
                          {doctors?.map((doctor: any) => (
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
                      <Label htmlFor="dateTime">Date & Time *</Label>
                      <Input
                        id="dateTime"
                        type="datetime-local"
                        value={formData.dateTime}
                        onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
                        data-testid="input-datetime"
                      />
                    </div>

                    <div>
                      <Label htmlFor="riskLevel">Risk Level *</Label>
                      <Select
                        value={formData.riskLevel}
                        onValueChange={(value: any) => setFormData({ ...formData, riskLevel: value })}
                      >
                        <SelectTrigger id="riskLevel" data-testid="select-risk-level">
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
                    <Label htmlFor="diseaseName">Disease/Condition Name *</Label>
                    <Input
                      id="diseaseName"
                      placeholder="e.g., Acute Bronchitis"
                      value={formData.diseaseName}
                      onChange={(e) => setFormData({ ...formData, diseaseName: e.target.value })}
                      data-testid="input-disease-name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="diseaseDescription">Description *</Label>
                    <Textarea
                      id="diseaseDescription"
                      placeholder="Detailed description of the condition, symptoms, and findings..."
                      value={formData.diseaseDescription}
                      onChange={(e) => setFormData({ ...formData, diseaseDescription: e.target.value })}
                      rows={4}
                      data-testid="textarea-disease-description"
                    />
                  </div>

                  <div>
                    <Label htmlFor="treatment">Treatment</Label>
                    <Textarea
                      id="treatment"
                      placeholder="Treatment plan and procedures..."
                      value={formData.treatment}
                      onChange={(e) => setFormData({ ...formData, treatment: e.target.value })}
                      rows={3}
                      data-testid="textarea-treatment"
                    />
                  </div>

                  <div>
                    <Label htmlFor="prescription">Prescription</Label>
                    <Textarea
                      id="prescription"
                      placeholder="Medications prescribed..."
                      value={formData.prescription}
                      onChange={(e) => setFormData({ ...formData, prescription: e.target.value })}
                      rows={3}
                      data-testid="textarea-prescription"
                    />
                  </div>

                  <div>
                    <Label htmlFor="emergencyWarnings">Emergency Warnings</Label>
                    <Textarea
                      id="emergencyWarnings"
                      placeholder="Any critical warnings or alerts..."
                      value={formData.emergencyWarnings}
                      onChange={(e) => setFormData({ ...formData, emergencyWarnings: e.target.value })}
                      rows={2}
                      data-testid="textarea-emergency-warnings"
                    />
                  </div>

                  <div className="bg-muted/50 border rounded-md p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium mb-1">Media Upload (Coming Soon)</p>
                        <p className="text-muted-foreground">
                          File upload functionality for medical documents and scans will be available in the next update.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
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
                      })}
                      data-testid="button-reset-form"
                    >
                      Reset
                    </Button>
                    <Button
                      type="submit"
                      disabled={createRecordMutation.isPending}
                      data-testid="button-upload-record"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {createRecordMutation.isPending ? "Uploading..." : "Upload Record"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Uploads
                </CardTitle>
                <CardDescription>Recently uploaded records with edit status</CardDescription>
              </CardHeader>
              <CardContent>
                {recentRecords && recentRecords.length > 0 ? (
                  <div className="space-y-3">
                    {recentRecords.map((record: any) => (
                      <Card key={record.id} className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm">{record.diseaseName}</h4>
                              <p className="text-xs text-muted-foreground">
                                {new Date(record.dateTime).toLocaleDateString()}
                              </p>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${getRiskColor(record.riskLevel)}`} />
                          </div>
                          {record.isEditable && record.editableUntil && (
                            <div className="bg-primary/10 border border-primary/20 rounded-md p-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs">
                                  <Clock className="h-3 w-3 text-primary" />
                                  <span className="text-primary font-medium">
                                    Editable for: {Math.max(0, Math.floor((new Date(record.editableUntil).getTime() - Date.now()) / 60000))} min
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditRecord(record)}
                                  className="h-6 px-2 text-xs"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            </div>
                          )}
                          {!record.isEditable && (
                            <Badge variant="secondary" className="text-xs">Locked</Badge>
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

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Upload Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2 text-muted-foreground">
                <div className="flex gap-2">
                  <span className="text-primary">•</span>
                  <p>Records are editable for 1 hour after upload</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary">•</span>
                  <p>All required fields must be filled</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary">•</span>
                  <p>Choose appropriate risk level</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary">•</span>
                  <p>Add emergency warnings when necessary</p>
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
                  >
                    <SelectTrigger id="edit-patientId">
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients?.map((patient: any) => (
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
                      {doctors?.map((doctor: any) => (
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
                  placeholder="e.g., Acute Bronchitis"
                  value={editFormData.diseaseName}
                  onChange={(e) => setEditFormData({ ...editFormData, diseaseName: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-diseaseDescription">Description *</Label>
                <Textarea
                  id="edit-diseaseDescription"
                  placeholder="Detailed description of the condition, symptoms, and findings..."
                  value={editFormData.diseaseDescription}
                  onChange={(e) => setEditFormData({ ...editFormData, diseaseDescription: e.target.value })}
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="edit-treatment">Treatment</Label>
                <Textarea
                  id="edit-treatment"
                  placeholder="Treatment plan and procedures..."
                  value={editFormData.treatment}
                  onChange={(e) => setEditFormData({ ...editFormData, treatment: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="edit-prescription">Prescription</Label>
                <Textarea
                  id="edit-prescription"
                  placeholder="Medications prescribed..."
                  value={editFormData.prescription}
                  onChange={(e) => setEditFormData({ ...editFormData, prescription: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="edit-emergencyWarnings">Emergency Warnings</Label>
                <Textarea
                  id="edit-emergencyWarnings"
                  placeholder="Any critical warnings or alerts..."
                  value={editFormData.emergencyWarnings}
                  onChange={(e) => setEditFormData({ ...editFormData, emergencyWarnings: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editRecordMutation.isPending}
                >
                  {editRecordMutation.isPending ? "Updating..." : "Update Record"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
