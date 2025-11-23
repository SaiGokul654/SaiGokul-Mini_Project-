import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Download, User, Edit, Save, X, Activity, Calendar, Clock, MapPin, Phone, Mail, AlertCircle, FileText, HeartPulse, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthUser, clearAuthUser } from "@/lib/auth";
import { generatePatientHistoryPDF } from "@/lib/pdf-generator";
import { RiskBadge } from "@/components/risk-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLocation } from "wouter";
import type { Patient, HealthRecord, Hospital, Doctor } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LabResults } from "@/components/LabResults";
import { PredictionDashboard } from "@/components/PredictionDashboard";
import { motion } from "framer-motion";

type PatientWithRecords = Patient & {
  healthRecords: Array<HealthRecord & { hospital: Hospital; doctor: Doctor }>;
};

export default function PatientDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const user = getAuthUser();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    age: 0,
    email: "",
    phone: "",
    address: "",
    emergencyContact: "",
  });

  const { data: patientData, isLoading } = useQuery<PatientWithRecords>({
    queryKey: [`/api/patients/me?userId=${user?.id}`],
    enabled: !!user,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<Patient>) => {
      return await apiRequest("PATCH", `/api/patients/me?userId=${user?.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your information has been saved successfully",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key0 = (query as any).queryKey?.[0];
          return typeof key0 === 'string' && key0.startsWith('/api/patients/me');
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

  const handleEditProfile = () => {
    if (patientData) {
      setEditForm({
        name: patientData.name,
        age: patientData.age || 0,
        email: patientData.email || "",
        phone: patientData.phone || "",
        address: patientData.address || "",
        emergencyContact: patientData.emergencyContact || "",
      });
      setIsEditing(true);
    }
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(editForm);
  };

  const handleDownloadPDF = () => {
    if (patientData) {
      generatePatientHistoryPDF(
        patientData,
        patientData.healthRecords,
        `my-health-history.pdf`
      );
      toast({
        title: "PDF Downloaded",
        description: "Your health history has been saved",
      });
    }
  };

  const handleLogout = () => {
    clearAuthUser();
    navigate("/");
  };

  if (!user || user.role !== "patient") {
    navigate("/");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-6 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-6 py-8 space-y-8">
          <Skeleton className="h-64 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Skeleton className="h-96 w-full rounded-xl md:col-span-2" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/50">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <HeartPulse className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">HealthChain</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-full">
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <p className="font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Patient Portal</p>
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
        {patientData && (
          <>
            {/* Profile Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-primary/20 via-accent/20 to-background/50" />
                <CardHeader className="relative pt-0">
                  <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 -mt-12 px-2">
                    <div className="flex items-end gap-6">
                      <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                        <AvatarImage src={patientData.profileImage || undefined} />
                        <AvatarFallback className="text-4xl bg-primary/10 text-primary">
                          {patientData.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="mb-2 space-y-1">
                        <CardTitle className="text-3xl font-bold">{patientData.name}</CardTitle>
                        <CardDescription className="font-mono text-base flex items-center gap-2">
                          <Badge variant="outline" className="font-normal">ID: {patientData.patientId}</Badge>
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none">
                            Patient
                          </Badge>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-3 mb-2 w-full md:w-auto">
                      {!isEditing ? (
                        <Button variant="outline" onClick={handleEditProfile} className="flex-1 md:flex-none">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Profile
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => setIsEditing(false)}
                            className="flex-1 md:flex-none"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSaveProfile}
                            disabled={updateProfileMutation.isPending}
                            className="flex-1 md:flex-none"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-8">
                  {!isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2 text-primary">
                          <User className="h-4 w-4" /> Personal Info
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground mb-1">Age</p>
                            <p className="font-medium">{patientData.age || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">Gender</p>
                            <p className="font-medium capitalize">{patientData.gender || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">Blood Group</p>
                            <p className="font-medium">{patientData.bloodGroup || "N/A"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2 text-primary">
                          <Phone className="h-4 w-4" /> Contact Details
                        </h3>
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-muted-foreground mb-1">Email</p>
                            <p className="font-medium flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {patientData.email || "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">Phone</p>
                            <p className="font-medium flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {patientData.phone || "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2 text-primary">
                          <ShieldCheck className="h-4 w-4" /> Emergency
                        </h3>
                        <div className="space-y-3 text-sm">
                          <div>
                            <p className="text-muted-foreground mb-1">Emergency Contact</p>
                            <p className="font-medium text-destructive flex items-center gap-2">
                              <AlertCircle className="h-3 w-3" />
                              {patientData.emergencyContact || "Not set"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">Address</p>
                            <p className="font-medium flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {patientData.address || "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-xl border"
                    >
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Age</Label>
                        <Input
                          type="number"
                          value={editForm.age}
                          onChange={(e) => setEditForm({ ...editForm, age: parseInt(e.target.value) })}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Emergency Contact</Label>
                        <Input
                          value={editForm.emergencyContact}
                          onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                          className="bg-background border-destructive/20 focus-visible:ring-destructive/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Address</Label>
                        <Input
                          value={editForm.address}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Health Records Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        Health Overview
                      </CardTitle>
                      <CardDescription>
                        Your complete medical history, lab results, and health insights
                      </CardDescription>
                    </div>
                    <Button onClick={handleDownloadPDF} variant="outline" className="border-primary/20 hover:bg-primary/5">
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="history" className="w-full">
                    <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6 mb-6">
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

                    <TabsContent value="history" className="space-y-6">
                      {patientData.healthRecords && patientData.healthRecords.length > 0 ? (
                        <div className="grid gap-6">
                          {patientData.healthRecords.map((record, index) => (
                            <motion.div
                              key={record.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <Card className="overflow-hidden hover:shadow-md transition-all duration-300 border-l-4" style={{
                                borderLeftColor: record.riskLevel === 'critical' ? 'hsl(var(--destructive))' :
                                  record.riskLevel === 'high' ? 'orange' :
                                    'hsl(var(--primary))'
                              }}>
                                <CardContent className="p-6">
                                  <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1 space-y-4">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <div className="flex items-center gap-3 mb-1">
                                            <h4 className="font-bold text-xl text-foreground">{record.diseaseName}</h4>
                                            <RiskBadge level={record.riskLevel as any} />
                                          </div>
                                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                              <Calendar className="h-3 w-3" />
                                              {new Date(record.dateTime).toLocaleDateString()}
                                            </span>
                                            <span className="text-border">|</span>
                                            <span className="flex items-center gap-1">
                                              <Clock className="h-3 w-3" />
                                              {new Date(record.dateTime).toLocaleTimeString()}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="grid md:grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                                        <div>
                                          <span className="font-medium text-muted-foreground block mb-1">Diagnosis</span>
                                          <p className="leading-relaxed">{record.diseaseDescription}</p>
                                        </div>
                                        {record.treatment && (
                                          <div>
                                            <span className="font-medium text-muted-foreground block mb-1">Treatment</span>
                                            <p className="leading-relaxed">{record.treatment}</p>
                                          </div>
                                        )}
                                      </div>

                                      {(record.prescription || record.emergencyWarnings) && (
                                        <div className="flex flex-col gap-3">
                                          {record.prescription && (
                                            <div className="flex gap-3 items-start p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20">
                                              <FileText className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                                              <div>
                                                <span className="font-medium text-blue-700 dark:text-blue-300 block mb-1">Prescription</span>
                                                <p className="text-sm text-blue-600 dark:text-blue-400">{record.prescription}</p>
                                              </div>
                                            </div>
                                          )}
                                          {record.emergencyWarnings && (
                                            <div className="flex gap-3 items-start p-3 bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
                                              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                                              <div>
                                                <span className="font-medium text-destructive block mb-1">Warning</span>
                                                <p className="text-sm text-destructive/80">{record.emergencyWarnings}</p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <Separator orientation="vertical" className="hidden md:block h-auto" />

                                    <div className="md:w-64 space-y-4 text-sm">
                                      <div>
                                        <h5 className="font-medium text-muted-foreground mb-2">Care Provider</h5>
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-3">
                                            <div className="bg-primary/10 p-2 rounded-full">
                                              <User className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                              <p className="font-medium">Dr. {record.doctor.name}</p>
                                              <p className="text-xs text-muted-foreground">{record.doctor.specialization || "General Physician"}</p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <div className="bg-primary/10 p-2 rounded-full">
                                              <MapPin className="h-4 w-4 text-primary" />
                                            </div>
                                            <div>
                                              <p className="font-medium">{record.hospital.name}</p>
                                              <p className="text-xs text-muted-foreground">{record.hospital.location}</p>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {record.mediaFiles && record.mediaFiles.length > 0 && (
                                        <div>
                                          <h5 className="font-medium text-muted-foreground mb-2">Attachments</h5>
                                          <div className="flex flex-wrap gap-2">
                                            {record.mediaFiles.map((file, idx) => (
                                              <Badge key={idx} variant="secondary" className="pl-1 pr-3 py-1 h-auto cursor-pointer hover:bg-secondary/80">
                                                <FileText className="h-3 w-3 mr-1" />
                                                {file.name}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/5">
                          <div className="bg-muted/20 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                            <Activity className="h-10 w-10 text-muted-foreground/50" />
                          </div>
                          <h3 className="text-xl font-semibold">No Medical Records</h3>
                          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                            Your health records will appear here once your doctor creates them.
                          </p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="labs">
                      <LabResults patientId={patientData.id} canUpload={false} />
                    </TabsContent>

                    <TabsContent value="predictions">
                      <PredictionDashboard patientId={patientData.id} canGenerate={false} />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}
