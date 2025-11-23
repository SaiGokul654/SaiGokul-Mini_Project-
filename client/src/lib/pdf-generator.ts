import { jsPDF } from "jspdf";
import { HealthRecord, Patient, Hospital, Doctor } from "@shared/schema";

export function generatePatientHistoryPDF(
  patient: Patient,
  records: Array<HealthRecord & { hospital: Hospital; doctor: Doctor }>,
  fileName: string = "patient-history.pdf"
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Patient Health History", pageWidth / 2, yPos, { align: "center" });

  yPos += 15;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  doc.text(`Patient ID: ${patient.patientId}`, 20, yPos);
  yPos += 6;
  doc.text(`Name: ${patient.name}`, 20, yPos);
  yPos += 6;
  doc.text(`Age: ${patient.age || "N/A"} | Gender: ${patient.gender || "N/A"}`, 20, yPos);
  yPos += 6;
  doc.text(`Phone: ${patient.phone || "N/A"}`, 20, yPos);
  yPos += 6;
  doc.text(`Blood Group: ${patient.bloodGroup || "N/A"}`, 20, yPos);

  yPos += 12;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Medical Records", 20, yPos);
  yPos += 10;

  records.forEach((record, index) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Record ${index + 1}`, 20, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${new Date(record.dateTime).toLocaleString()}`, 25, yPos);
    yPos += 5;
    doc.text(`Hospital: ${record.hospital.name} (${record.hospital.location})`, 25, yPos);
    yPos += 5;
    doc.text(`Doctor: ${record.doctor.name} (${record.doctor.specialization || "General"})`, 25, yPos);
    yPos += 5;
    doc.text(`Disease: ${record.diseaseName}`, 25, yPos);
    yPos += 5;

    const descLines = doc.splitTextToSize(`Description: ${record.diseaseDescription}`, pageWidth - 50);
    doc.text(descLines, 25, yPos);
    yPos += descLines.length * 5;

    if (record.treatment) {
      const treatmentLines = doc.splitTextToSize(`Treatment: ${record.treatment}`, pageWidth - 50);
      doc.text(treatmentLines, 25, yPos);
      yPos += treatmentLines.length * 5;
    }

    if (record.prescription) {
      const prescriptionLines = doc.splitTextToSize(`Prescription: ${record.prescription}`, pageWidth - 50);
      doc.text(prescriptionLines, 25, yPos);
      yPos += prescriptionLines.length * 5;
    }

    doc.setFont("helvetica", "bold");
    const riskColor = getRiskColor(record.riskLevel);
    doc.setTextColor(riskColor.r, riskColor.g, riskColor.b);
    doc.text(`Risk Level: ${record.riskLevel.toUpperCase()}`, 25, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    yPos += 5;

    if (record.emergencyWarnings) {
      doc.setTextColor(220, 38, 38);
      const warningLines = doc.splitTextToSize(`⚠ Warning: ${record.emergencyWarnings}`, pageWidth - 50);
      doc.text(warningLines, 25, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += warningLines.length * 5;
    }

    yPos += 8;
    doc.setDrawColor(230, 230, 230);
    doc.line(25, yPos, pageWidth - 20, yPos);
    yPos += 8;
  });

  doc.save(fileName);
}

export function generateAISummaryPDF(
  patientName: string,
  summary: string,
  fileName: string = "ai-summary.pdf"
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("AI-Generated Patient Summary", pageWidth / 2, yPos, { align: "center" });

  yPos += 15;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Patient: ${patientName}`, 20, yPos);
  yPos += 6;
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPos);

  yPos += 12;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;

  doc.setFontSize(10);
  const summaryLines = doc.splitTextToSize(summary, pageWidth - 40);
  doc.text(summaryLines, 20, yPos);

  doc.save(fileName);
}

function getRiskColor(riskLevel: string): { r: number; g: number; b: number } {
  switch (riskLevel.toLowerCase()) {
    case "low":
      return { r: 34, g: 197, b: 94 };
    case "medium":
      return { r: 251, g: 191, b: 36 };
    case "high":
      return { r: 249, g: 115, b: 22 };
    case "critical":
      return { r: 239, g: 68, b: 68 };
    default:
      return { r: 156, g: 163, b: 175 };
  }
}
