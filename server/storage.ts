import {
  Users, Patients, Doctors, Hospitals, HealthRecords, DoctorNotes,
  type User, type InsertUser,
  type Patient, type InsertPatient,
  type Doctor, type InsertDoctor,
  type Hospital, type InsertHospital,
  type HealthRecord, type InsertHealthRecord,
  type DoctorNote, type InsertDoctorNote,
  insertHealthRecordSchema,
} from "@shared/schema";
import {
  HealthPredictions, LabResults,
  type HealthPrediction, type InsertHealthPrediction,
  type LabResult, type InsertLabResult,
  insertHealthPredictionSchema, insertLabResultSchema,
} from "@shared/lab-prediction-schema";
import { db } from "./db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export interface IStorage {
  // Auth
  createUser(user: InsertUser): Promise<User>;
  getUserByRoleId(roleId: string, role: string): Promise<User | undefined>;

  // Patients
  getPatientById(id: string): Promise<Patient | undefined>;
  getPatientByUserId(userId: string): Promise<Patient | undefined>;
  getPatientWithRecords(patientId: string): Promise<any>;
  searchPatients(query: string, searchType: "id" | "name" | "phone"): Promise<any[]>;
  updatePatient(id: string, data: Partial<Patient>): Promise<Patient>;
  getAllPatients(): Promise<Patient[]>;
  getAllPatientsByHospital(hospitalId: string): Promise<Patient[]>;

  // Doctors
  getDoctorsByHospital(hospitalId: string): Promise<Doctor[]>;
  getDoctorStats(doctorId?: string): Promise<any>;
  getDoctorById(id: string): Promise<Doctor | undefined>;

  // Hospitals
  getHospitalByHospitalId(hospitalId: string): Promise<Hospital | undefined>;

  // Health Records
  createHealthRecord(record: InsertHealthRecord): Promise<HealthRecord>;
  getHealthRecordsByPatient(patientId: string): Promise<any[]>;
  getRecentRecordsByHospital(hospitalId: string): Promise<any[]>;
  getHealthRecordById(id: string): Promise<HealthRecord | undefined>;
  updateHealthRecord(id: string, data: Partial<HealthRecord>): Promise<HealthRecord>;

  // Doctor Notes
  createDoctorNote(note: InsertDoctorNote): Promise<DoctorNote>;

  // Health Predictions
  createHealthPrediction(prediction: InsertHealthPrediction): Promise<HealthPrediction>;
  getPatientPredictions(patientId: string): Promise<HealthPrediction[]>;
  getLatestPrediction(patientId: string): Promise<HealthPrediction | undefined>;

  // Lab Results
  createLabResult(labResult: InsertLabResult): Promise<LabResult>;
  getPatientLabResults(patientId: string, filters?: { testType?: string; startDate?: Date; endDate?: Date }): Promise<LabResult[]>;
  getLabResultById(id: string): Promise<LabResult | undefined>;
  updateLabResult(id: string, data: Partial<LabResult>): Promise<LabResult>;
  getLabTrends(patientId: string, testName: string): Promise<any>;

  // Password Reset
  saveResetOtp(roleId: string, role: string, otp: string): Promise<void>;
  verifyResetOtp(roleId: string, role: string, otp: string): Promise<boolean>;
  updateUserPassword(roleId: string, role: string, password: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const created = await Users.create({
      ...insertUser,
      id: insertUser.id || randomUUID(),
      password: hashedPassword
    });
    return created as unknown as User;
  }

  async getUserByRoleId(roleId: string, role: string): Promise<User | undefined> {
    // Case-insensitive search for roleId
    const user = await Users.findOne({
      roleId: { $regex: new RegExp(`^${roleId}$`, 'i') },
      role
    }).maxTimeMS(30000).lean();
    return user as unknown as User | undefined;
  }

  async getPatientById(id: string): Promise<Patient | undefined> {
    const patient = await Patients.findOne({ id }).lean();
    return patient as unknown as Patient | undefined;
  }

  async getPatientByUserId(userId: string): Promise<Patient | undefined> {
    const user = await Users.findOne({ id: userId }).lean();
    if (!user) return undefined;
    const patient = await Patients.findOne({ patientId: (user as any).roleId }).lean();
    return patient as unknown as Patient | undefined;
  }

  async getPatientWithRecords(patientId: string): Promise<any> {
    const patient = await this.getPatientById(patientId);
    if (!patient) return null;
    const records = await HealthRecords.find({ patientId }).sort({ dateTime: -1 }).lean();
    // populate doctor and hospital info manually
    const withRelations = await Promise.all(records.map(async (rec: any) => {
      const hospital = await Hospitals.findOne({ id: rec.hospitalId }).lean();
      const doctor = await Doctors.findOne({ id: rec.doctorId }).lean();
      return { ...rec, hospital, doctor };
    }));

    return {
      ...patient,
      healthRecords: withRelations,
    };
  }

  async searchPatients(query: string, searchType: "id" | "name" | "phone"): Promise<any[]> {
    const q: any = {};
    if (searchType === "id") q.patientId = { $regex: query, $options: "i" };
    else if (searchType === "name") q.name = { $regex: query, $options: "i" };
    else q.phone = { $regex: query, $options: "i" };

    const results = await Patients.find(q).limit(10).lean();

    const withRecords = await Promise.all(
      results.map(async (patient) => {
        const records = await HealthRecords.find({ patientId: patient.id }).sort({ dateTime: -1 }).lean();
        const relations = await Promise.all(records.map(async (rec: any) => {
          const hospital = await Hospitals.findOne({ id: rec.hospitalId }).lean();
          const doctor = await Doctors.findOne({ id: rec.doctorId }).lean();
          return { ...rec, hospital, doctor };
        }));

        return { ...patient, healthRecords: relations };
      })
    );

    return withRecords;
  }

  async updatePatient(id: string, data: Partial<Patient>): Promise<Patient> {
    const updated = await Patients.findOneAndUpdate({ id }, data, { new: true }).lean();
    return updated as unknown as Patient;
  }

  async getAllPatients(): Promise<Patient[]> {
    return await Patients.find().sort({ name: 1 }).lean() as unknown as Patient[];
  }

  async getAllPatientsByHospital(hospitalId: string): Promise<Patient[]> {
    // Get all patients who have records from this hospital
    const records = await HealthRecords.find({ hospitalId }).distinct("patientId");
    if (!records || records.length === 0) return [];
    return await Patients.find({ id: { $in: records } }).sort({ name: 1 }).lean() as unknown as Patient[];
  }

  async getDoctorsByHospital(hospitalId: string): Promise<Doctor[]> {
    return await Doctors.find({ hospitalId }).sort({ name: 1 }).lean() as unknown as Doctor[];
  }

  async getDoctorById(id: string): Promise<Doctor | undefined> {
    const doctor = await Doctors.findOne({ id }).lean();
    return doctor as unknown as Doctor | undefined;
  }

  async getDoctorStats(doctorId?: string): Promise<any> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (doctorId) {
      console.log(`[getDoctorStats] Looking up stats for doctorId (roleId): ${doctorId}`);

      // doctorId passed here is the roleId (e.g. DOC001)
      // Case-insensitive search for the doctor
      const doctor = await Doctors.findOne({
        doctorId: { $regex: new RegExp(`^${doctorId}$`, 'i') }
      }).lean() as Doctor | null;

      if (doctor) {
        console.log(`[getDoctorStats] Found doctor: ${doctor.name} (Internal ID: ${doctor.id})`);
        const internalId = doctor.id;

        // Stats for specific doctor using internal ID
        const totalPatients = await HealthRecords.find({ doctorId: internalId }).distinct("patientId");
        const recentCases = await HealthRecords.countDocuments({
          doctorId: internalId,
          dateTime: { $gt: thirtyDaysAgo }
        });
        const totalConsultations = await HealthRecords.countDocuments({ doctorId: internalId });

        const criticalCases = await HealthRecords.countDocuments({
          doctorId: internalId,
          riskLevel: { $in: ["high", "critical"] },
          dateTime: { $gt: thirtyDaysAgo }
        });

        console.log(`[getDoctorStats] Stats: Patients=${totalPatients.length}, Consultations=${totalConsultations}`);

        return {
          totalPatients: totalPatients.length || 0,
          recentCases: recentCases || 0,
          totalConsultations: totalConsultations || 0,
          criticalCases: criticalCases || 0
        };
      } else {
        console.log(`[getDoctorStats] Doctor not found for roleId: ${doctorId}`);
        return {
          totalPatients: 0,
          recentCases: 0,
          totalConsultations: 0,
          criticalCases: 0
        };
      }
    }

    // Global stats (fallback)
    const totalPatients = await Patients.countDocuments();
    const recentCases = await HealthRecords.countDocuments({ dateTime: { $gt: thirtyDaysAgo } });

    return {
      totalPatients: totalPatients || 0,
      recentCases: recentCases || 0,
      pendingReviews: 0,
    };
  }

  async getHospitalByHospitalId(hospitalId: string): Promise<Hospital | undefined> {
    const hospital = await Hospitals.findOne({ hospitalId }).lean();
    return hospital as unknown as Hospital | undefined;
  }

  async createHealthRecord(insertRecord: InsertHealthRecord): Promise<HealthRecord> {
    const editableUntil = new Date();
    editableUntil.setHours(editableUntil.getHours() + 1);
    const parsed = insertHealthRecordSchema.parse(insertRecord);
    const record = await HealthRecords.create({
      ...parsed,
      isEditable: true,
      editableUntil,
      id: parsed.id || `${Date.now()}-${Math.random()}`,
    });
    return record as unknown as HealthRecord;
  }

  async getHealthRecordsByPatient(patientId: string): Promise<any[]> {
    const records = await HealthRecords.find({ patientId }).sort({ dateTime: -1 }).lean();
    const withRelations = await Promise.all(records.map(async (rec: any) => {
      const hospital = await Hospitals.findOne({ id: rec.hospitalId }).lean();
      const doctor = await Doctors.findOne({ id: rec.doctorId }).lean();
      return { ...rec, hospital, doctor };
    }));
    return withRelations;
  }

  async getRecentRecordsByHospital(hospitalId: string): Promise<any[]> {
    return await HealthRecords.find({ hospitalId }).sort({ createdAt: -1 }).limit(10).lean();
  }

  async getHealthRecordById(id: string): Promise<HealthRecord | undefined> {
    const record = await HealthRecords.findOne({ id }).lean();
    return record as unknown as HealthRecord | undefined;
  }

  async updateHealthRecord(id: string, data: Partial<HealthRecord>): Promise<HealthRecord> {
    const updated = await HealthRecords.findOneAndUpdate({ id }, { ...data, updatedAt: new Date() }, { new: true }).lean();
    return updated as unknown as HealthRecord;
  }

  async createDoctorNote(insertNote: any): Promise<DoctorNote> {
    // insertNote already has the correct structure from the routes
    const note = await DoctorNotes.create({
      id: insertNote.id || `${Date.now()}-${Math.random()}`,
      healthRecordId: insertNote.healthRecordId,
      doctorUserId: insertNote.doctorUserId,
      note: insertNote.note,
    });
    return note as unknown as DoctorNote;
  }

  // Health Predictions
  async createHealthPrediction(insertPrediction: InsertHealthPrediction): Promise<HealthPrediction> {
    const parsed = insertHealthPredictionSchema.parse(insertPrediction);
    const prediction = await HealthPredictions.create({
      ...parsed,
      id: parsed.id || `pred-${Date.now()}-${Math.random()}`,
    });
    return prediction as unknown as HealthPrediction;
  }

  async getPatientPredictions(patientId: string): Promise<HealthPrediction[]> {
    const predictions = await HealthPredictions.find({ patientId })
      .sort({ predictionDate: -1 })
      .lean();
    return predictions as unknown as HealthPrediction[];
  }

  async getLatestPrediction(patientId: string): Promise<HealthPrediction | undefined> {
    const prediction = await HealthPredictions.findOne({ patientId })
      .sort({ predictionDate: -1 })
      .lean();
    return prediction as unknown as HealthPrediction | undefined;
  }

  // Lab Results
  async createLabResult(insertLabResult: InsertLabResult): Promise<LabResult> {
    const parsed = insertLabResultSchema.parse(insertLabResult);
    const labResult = await LabResults.create({
      ...parsed,
      id: parsed.id || `lab-${Date.now()}-${Math.random()}`,
    });
    return labResult as unknown as LabResult;
  }

  async getPatientLabResults(
    patientId: string,
    filters?: { testType?: string; startDate?: Date; endDate?: Date }
  ): Promise<LabResult[]> {
    const query: any = { patientId };

    if (filters?.testType) {
      query.testType = filters.testType;
    }

    if (filters?.startDate || filters?.endDate) {
      query.testDate = {};
      if (filters.startDate) query.testDate.$gte = filters.startDate;
      if (filters.endDate) query.testDate.$lte = filters.endDate;
    }

    const labResults = await LabResults.find(query)
      .sort({ testDate: -1 })
      .lean();
    return labResults as unknown as LabResult[];
  }

  async getLabResultById(id: string): Promise<LabResult | undefined> {
    const labResult = await LabResults.findOne({ id }).lean();
    return labResult as unknown as LabResult | undefined;
  }

  async updateLabResult(id: string, data: Partial<LabResult>): Promise<LabResult> {
    const updated = await LabResults.findOneAndUpdate(
      { id },
      { ...data, updatedAt: new Date() },
      { new: true }
    ).lean();

    if (!updated) {
      throw new Error("Lab result not found");
    }

    return updated as unknown as LabResult;
  }

  async getLabTrends(patientId: string, testName: string): Promise<any> {
    const labResults = await LabResults.find({ patientId })
      .sort({ testDate: 1 })
      .lean();

    // Extract data points for the specific test
    const dataPoints: Array<{ date: Date; value: number }> = [];
    let normalRange: { min: number; max: number } | null = null;

    for (const result of labResults) {
      const testResult = (result as any).results.find((r: any) => r.testName === testName);
      if (testResult) {
        dataPoints.push({
          date: (result as any).testDate,
          value: testResult.value
        });
        if (!normalRange) {
          normalRange = testResult.normalRange;
        }
      }
    }

    // Determine trend
    let trend = 'stable';
    if (dataPoints.length >= 2) {
      const recent = dataPoints.slice(-3);
      const older = dataPoints.slice(0, -3);

      if (recent.length > 0 && older.length > 0) {
        const recentAvg = recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
        const olderAvg = older.reduce((sum, p) => sum + p.value, 0) / older.length;

        const change = ((recentAvg - olderAvg) / olderAvg) * 100;

        if (Math.abs(change) < 5) {
          trend = 'stable';
        } else if (normalRange) {
          // Determine if moving towards or away from normal
          const targetMid = (normalRange.min + normalRange.max) / 2;
          const recentDist = Math.abs(recentAvg - targetMid);
          const olderDist = Math.abs(olderAvg - targetMid);

          trend = recentDist < olderDist ? 'improving' : 'worsening';
        } else {
          trend = change > 0 ? 'increasing' : 'decreasing';
        }
      }
    }

    return {
      testName,
      data: dataPoints,
      trend,
      normalRange
    };
  }

  // Password Reset (In-memory for demo)
  private otps = new Map<string, { otp: string; expires: number }>();

  async saveResetOtp(roleId: string, role: string, otp: string): Promise<void> {
    const key = `${role}:${roleId}`;
    this.otps.set(key, {
      otp,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });
  }

  async verifyResetOtp(roleId: string, role: string, otp: string): Promise<boolean> {
    const key = `${role}:${roleId}`;
    const data = this.otps.get(key);

    if (!data) return false;
    if (Date.now() > data.expires) {
      this.otps.delete(key);
      return false;
    }

    return data.otp === otp;
  }

  async updateUserPassword(roleId: string, role: string, password: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(password, 10);
    await Users.findOneAndUpdate(
      { roleId, role },
      { password: hashedPassword }
    );
    // Clear OTP after successful reset
    const key = `${role}:${roleId}`;
    this.otps.delete(key);
  }
}

export const storage = new DatabaseStorage();
