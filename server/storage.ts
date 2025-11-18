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
import { db } from "./db";
import bcrypt from "bcryptjs";

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
  getDoctorStats(): Promise<any>;
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
}

export class DatabaseStorage implements IStorage {
  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const created = await Users.create({ ...insertUser, password: hashedPassword });
    return created as unknown as User;
  }

  async getUserByRoleId(roleId: string, role: string): Promise<User | undefined> {
    const user = await Users.findOne({ roleId, role }).maxTimeMS(30000).lean();
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

  async getDoctorStats(): Promise<any> {
    const totalPatients = await Patients.countDocuments();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
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
}

export const storage = new DatabaseStorage();
