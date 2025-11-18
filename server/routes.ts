import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generatePatientSummary } from "./openai";
import bcrypt from "bcryptjs";
import { insertUserSchema, insertHealthRecordSchema, insertDoctorNoteSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      const existing = await storage.getUserByRoleId(validatedData.roleId, validatedData.role);
      if (existing) {
        return res.status(400).json({ message: "User with this ID already exists" });
      }

      const user = await storage.createUser(validatedData);
      const { password, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { roleId, password, role } = req.body;
      
      const user = await storage.getUserByRoleId(roleId, role);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Login failed" });
    }
  });

  // Patient routes
  app.get("/api/patients/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const searchType = req.query.type as "id" | "name" | "phone" || "name";
      
      if (!query) {
        return res.json([]);
      }

      const results = await storage.searchPatients(query, searchType);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Search failed" });
    }
  });

  app.get("/api/patients/me", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const patient = await storage.getPatientByUserId(userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const patientWithRecords = await storage.getPatientWithRecords(patient.id);
      res.json(patientWithRecords);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch patient data" });
    }
  });

  app.patch("/api/patients/me", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const patient = await storage.getPatientByUserId(userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const updated = await storage.updatePatient(patient.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Update failed" });
    }
  });

  app.get("/api/patients/all", async (req, res) => {
    try {
      const patients = await storage.getAllPatients();
      res.json(patients);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch patients" });
    }
  });

  // Doctor routes
  app.get("/api/doctors/stats", async (req, res) => {
    try {
      const stats = await storage.getDoctorStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch stats" });
    }
  });

  app.get("/api/doctors/hospital", async (req, res) => {
    try {
      const hospitalRoleId = req.query.hospitalId as string;
      if (!hospitalRoleId) {
        return res.status(400).json({ message: "Hospital ID required" });
      }

      const hospital = await storage.getHospitalByHospitalId(hospitalRoleId);
      if (!hospital) {
        return res.status(404).json({ message: "Hospital not found" });
      }

      const doctors = await storage.getDoctorsByHospital(hospital.id);
      res.json(doctors);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch doctors" });
    }
  });

  // Health Records routes
  app.post("/api/health-records", async (req, res) => {
    try {
      const data = req.body;
      const hospitalRoleId = req.query.hospitalId as string || req.body.hospitalRoleId;
      
      if (!hospitalRoleId) {
        return res.status(400).json({ message: "Hospital ID required" });
      }

      // Get the hospital from the roleId
      const hospital = await storage.getHospitalByHospitalId(hospitalRoleId);
      if (!hospital) {
        return res.status(404).json({ message: "Hospital not found" });
      }

      // Verify patient exists
      const patient = await storage.getPatientById(data.patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Verify doctor exists and belongs to this hospital
      const doctor = await storage.getDoctorById(data.doctorId);
      if (!doctor) {
        return res.status(404).json({ message: "Doctor not found" });
      }

      if ((doctor as any).hospitalId !== hospital.id) {
        return res.status(403).json({ message: "Doctor does not belong to this hospital" });
      }

      const recordData = {
        patientId: data.patientId,
        hospitalId: hospital.id,
        doctorId: data.doctorId,
        dateTime: new Date(data.dateTime),
        diseaseName: data.diseaseName,
        diseaseDescription: data.diseaseDescription,
        treatment: data.treatment || null,
        prescription: data.prescription || null,
        riskLevel: data.riskLevel,
        emergencyWarnings: data.emergencyWarnings || null,
      };

      const validatedData = insertHealthRecordSchema.parse(recordData);
      const record = await storage.createHealthRecord(validatedData);
      res.json(record);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create record" });
    }
  });

  app.get("/api/health-records/recent", async (req, res) => {
    try {
      const hospitalRoleId = req.query.hospitalId as string;
      if (!hospitalRoleId) {
        return res.status(400).json({ message: "Hospital ID required" });
      }

      const hospital = await storage.getHospitalByHospitalId(hospitalRoleId);
      if (!hospital) {
        return res.status(404).json({ message: "Hospital not found" });
      }

      const records = await storage.getRecentRecordsByHospital(hospital.id);
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch records" });
    }
  });

  app.patch("/api/health-records/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const record = await storage.getHealthRecordById(id);
      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }

      // Check if record is still editable
      if (!record.isEditable || (record.editableUntil && new Date() > record.editableUntil)) {
        return res.status(403).json({ message: "Record is no longer editable (1 hour limit exceeded)" });
      }

      const updated = await storage.updateHealthRecord(id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Update failed" });
    }
  });

  // Doctor Notes routes
  app.post("/api/notes", async (req, res) => {
    try {
      const { healthRecordId, doctorUserId, note } = req.body;
      
      if (!healthRecordId || !doctorUserId || !note) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // The doctorUserId is the user's ID, we just pass it through as the schema expects
      const noteData = {
        healthRecordId,
        doctorUserId, // This is already the correct user ID
        note,
      };

      const createdNote = await storage.createDoctorNote(noteData);
      res.json(createdNote);
    } catch (error: any) {
      console.error("Note creation error:", error);
      res.status(400).json({ message: error.message || "Failed to add note" });
    }
  });

  // AI Summarization route
  app.post("/api/ai/summarize", async (req, res) => {
    try {
      const { patientId } = req.body;
      if (!patientId) {
        return res.status(400).json({ message: "Patient ID required" });
      }

      const patient = await storage.getPatientWithRecords(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Format patient history for AI
      const historyText = patient.healthRecords.map((record: any) => {
        return `Date: ${new Date(record.dateTime).toLocaleDateString()}
Hospital: ${record.hospital.name}
Doctor: ${record.doctor.name}
Disease: ${record.diseaseName}
Description: ${record.diseaseDescription}
Treatment: ${record.treatment || "N/A"}
Risk Level: ${record.riskLevel}
${record.emergencyWarnings ? `Warnings: ${record.emergencyWarnings}` : ""}
---`;
      }).join("\n\n");

      const summary = await generatePatientSummary(historyText);
      res.json({ summary });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to generate summary" });
    }
  });

  // Face Recognition route (demo - returns mock patient)
  app.post("/api/face-recognition", async (req, res) => {
    try {
      const patients = await storage.getAllPatients();
      if (patients.length === 0) {
        return res.status(404).json({ message: "No patients found" });
      }

      const demoPatient = patients[0];
      const patientWithRecords = await storage.getPatientWithRecords(demoPatient.id);
      res.json(patientWithRecords);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Recognition failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
