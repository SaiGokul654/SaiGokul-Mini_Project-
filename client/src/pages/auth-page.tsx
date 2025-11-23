import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { setAuthUser } from "@/lib/auth";
import { Activity, UserCircle, Hospital, Stethoscope, ShieldCheck, HeartPulse } from "lucide-react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const loginSchema = z.object({
  roleId: z.string().min(1, "ID is required"),
  password: z.string().min(1, "Password is required"),
  role: z.enum(["doctor", "patient", "hospital"]),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  age: z.number().min(1).optional(),
  role: z.enum(["doctor", "patient", "hospital"]),
  roleId: z.string().min(1, "Role-specific ID is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

function ResetPasswordDialog() {
  const [step, setStep] = useState<"identify" | "verify" | "reset">("identify");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    role: "doctor",
    roleId: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });

  const resetMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/auth/reset-password", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Password updated successfully" });
      setOpen(false);
      setStep("identify");
      setFormData({ ...formData, otp: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const otpMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/auth/forgot-password", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "OTP Sent",
        description: `Your OTP is: ${data.otp}`, // In real app, this would be "Check your email"
      });
      setStep("verify");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleIdentify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.roleId) {
      toast({ title: "Error", description: "Please enter your ID", variant: "destructive" });
      return;
    }
    otpMutation.mutate({ role: formData.role, roleId: formData.roleId });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.otp) {
      toast({ title: "Error", description: "Please enter OTP", variant: "destructive" });
      return;
    }
    setStep("reset");
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (formData.newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    resetMutation.mutate({
      role: formData.role,
      roleId: formData.roleId,
      otp: formData.otp,
      newPassword: formData.newPassword
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="p-0 h-auto font-normal text-primary/80 hover:text-primary">
          Forgot your password? Reset Password
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            {step === "identify" && "Enter your role and ID to receive an OTP."}
            {step === "verify" && "Enter the OTP sent to your registered contact."}
            {step === "reset" && "Enter your new password."}
          </DialogDescription>
        </DialogHeader>

        {step === "identify" && (
          <form onSubmit={handleIdentify} className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="patient">Patient</SelectItem>
                  <SelectItem value="hospital">Hospital Authority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ID</Label>
              <Input
                placeholder="Enter your ID"
                value={formData.roleId}
                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={otpMutation.isPending}>
              {otpMutation.isPending ? "Sending OTP..." : "Send OTP"}
            </Button>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label>OTP</Label>
              <Input
                placeholder="Enter 6-digit OTP"
                value={formData.otp}
                onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full">Verify OTP</Button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="New password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                placeholder="Confirm new password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={resetMutation.isPending}>
              {resetMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      roleId: "",
      password: "",
      role: "doctor",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      age: undefined,
      role: "doctor",
      roleId: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      return await apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: (user) => {
      setAuthUser(user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.name}!`,
      });

      if (user.role === "doctor") {
        navigate("/doctor/dashboard");
      } else if (user.role === "patient") {
        navigate("/patient/dashboard");
      } else {
        navigate("/hospital/dashboard");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      return await apiRequest("POST", "/api/auth/register", data);
    },
    onSuccess: (user) => {
      setAuthUser(user);
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.name}!`,
      });

      if (user.role === "doctor") {
        navigate("/doctor/dashboard");
      } else if (user.role === "patient") {
        navigate("/patient/dashboard");
      } else {
        navigate("/hospital/dashboard");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onLogin = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  const getRoleIdLabel = (role: string) => {
    switch (role) {
      case "doctor":
        return "Doctor ID / Government ID";
      case "patient":
        return "Patient ID / Phone Number";
      case "hospital":
        return "Hospital ID";
      default:
        return "ID";
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Activity className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome to MediScan AI</h1>
            <p className="text-muted-foreground">
              Secure, instant access to patient medical history.
            </p>
          </div>

          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")}>
                <TabsList className="grid w-full grid-cols-2 mb-8">
                  <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
                  <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-6">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>I am a</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Select your role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="doctor">
                                  <div className="flex items-center gap-2">
                                    <Stethoscope className="h-4 w-4 text-primary" />
                                    <span>Doctor</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="patient">
                                  <div className="flex items-center gap-2">
                                    <UserCircle className="h-4 w-4 text-primary" />
                                    <span>Patient</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="hospital">
                                  <div className="flex items-center gap-2">
                                    <Hospital className="h-4 w-4 text-primary" />
                                    <span>Hospital Authority</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={loginForm.control}
                        name="roleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{getRoleIdLabel(loginForm.watch("role"))}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter your ID"
                                {...field}
                                className="h-11"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Enter your password"
                                {...field}
                                className="h-11"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full h-11 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? "Logging in..." : "Sign In"}
                      </Button>
                    </form>
                  </Form>

                  <div className="text-center">
                    <ResetPasswordDialog />
                  </div>
                </TabsContent>

                <TabsContent value="register" className="space-y-6">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>I am a</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Select your role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="doctor">Doctor</SelectItem>
                                <SelectItem value="patient">Patient</SelectItem>
                                <SelectItem value="hospital">Hospital Authority</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="John Doe" {...field} className="h-11" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="age"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Age</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="25"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                  className="h-11"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={registerForm.control}
                        name="roleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{getRoleIdLabel(registerForm.watch("role"))}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter your ID"
                                {...field}
                                className="h-11"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="john@example.com"
                                {...field}
                                className="h-11"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="+91 9876543210"
                                {...field}
                                className="h-11"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="Min. 6 chars"
                                  {...field}
                                  className="h-11"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="Re-enter"
                                  {...field}
                                  className="h-11"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-11 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex flex-1 bg-muted/30 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/20 to-background/50" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative z-10 max-w-lg text-center space-y-6"
        >
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-background/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 transform -rotate-3">
              <HeartPulse className="h-10 w-10 text-rose-500 mb-3" />
              <h3 className="font-semibold text-lg">Real-time Vitals</h3>
              <p className="text-sm text-muted-foreground">Monitor patient health instantly</p>
            </div>
            <div className="bg-background/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/20 transform translate-y-8 rotate-3">
              <ShieldCheck className="h-10 w-10 text-primary mb-3" />
              <h3 className="font-semibold text-lg">Secure Data</h3>
              <p className="text-sm text-muted-foreground">Encrypted patient records</p>
            </div>
          </div>

          <div className="bg-background/60 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-2xl">
            <h2 className="text-2xl font-bold text-foreground mb-4">Transforming Healthcare</h2>
            <p className="text-muted-foreground leading-relaxed">
              "MediScan AI bridges the gap between doctors, patients, and hospitals with seamless data integration and intelligent insights."
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
