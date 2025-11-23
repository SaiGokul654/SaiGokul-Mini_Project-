import type { Express } from "express";
import { storage } from "./storage";
import { spawn } from "child_process";
import { insertHealthPredictionSchema, insertLabResultSchema, LAB_TEST_RANGES } from "@shared/lab-prediction-schema";

export function registerPredictionRoutes(app: Express) {
    // Generate health predictions for a patient
    app.post("/api/predictions/generate", async (req, res) => {
        try {
            const { patientId } = req.body;

            if (!patientId) {
                return res.status(400).json({ message: "Patient ID required" });
            }

            // Get patient with full medical history
            const patient = await storage.getPatientWithRecords(patientId);
            if (!patient) {
                return res.status(404).json({ message: "Patient not found" });
            }

            // Prepare data for prediction engine
            const patientData = {
                age: patient.age || 30,
                records: patient.healthRecords.map((record: any) => ({
                    date: new Date(record.dateTime).toISOString(),
                    disease: record.diseaseName,
                    description: record.diseaseDescription,
                    risk: record.riskLevel,
                    treatment: record.treatment
                }))
            };

            // Call Python prediction engine
            const pythonProcess = spawn('python', ['server/prediction-engine.py'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            const inputData = JSON.stringify({ patientData });
            let output = '';
            let errorOutput = '';

            pythonProcess.stdin.write(inputData);
            pythonProcess.stdin.end();

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on('close', async (code) => {
                try {
                    if (code !== 0) {
                        console.error('Prediction engine error:', errorOutput);
                        return res.status(500).json({ message: "Failed to generate predictions" });
                    }

                    const result = JSON.parse(output.trim());
                    if (result.error) {
                        console.error('Prediction error:', result.error);
                        return res.status(500).json({ message: result.error });
                    }

                    // Save prediction to database
                    const predictionData = {
                        patientId,
                        predictionDate: new Date(),
                        predictions: result.prediction.predictions,
                        overallHealthScore: result.prediction.overallHealthScore,
                        trendDirection: result.prediction.trendDirection
                    };

                    const savedPrediction = await storage.createHealthPrediction(predictionData);

                    res.json({
                        success: true,
                        prediction: savedPrediction
                    });
                } catch (parseError) {
                    console.error('Parse error:', parseError);
                    res.status(500).json({ message: "Failed to process predictions" });
                }
            });

        } catch (error: any) {
            console.error('Prediction generation error:', error);
            res.status(500).json({ message: error.message || "Failed to generate predictions" });
        }
    });

    // Get all predictions for a patient
    app.get("/api/predictions/:patientId", async (req, res) => {
        try {
            const { patientId } = req.params;
            const predictions = await storage.getPatientPredictions(patientId);
            res.json({ predictions });
        } catch (error: any) {
            res.status(500).json({ message: error.message || "Failed to fetch predictions" });
        }
    });

    // Get risk dashboard for a patient
    app.get("/api/predictions/dashboard/:patientId", async (req, res) => {
        try {
            const { patientId } = req.params;
            const latestPrediction = await storage.getLatestPrediction(patientId);

            if (!latestPrediction) {
                return res.json({
                    currentRisks: [],
                    healthScore: 85,
                    trend: 'stable',
                    recommendations: ['No recent predictions available. Generate predictions to see risk assessment.']
                });
            }

            // Extract current risks (high and critical only)
            const currentRisks = latestPrediction.predictions
                .filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical')
                .map(p => ({
                    condition: p.condition,
                    riskScore: p.riskScore,
                    riskLevel: p.riskLevel
                }));

            // Collect all recommendations
            const allRecommendations = latestPrediction.predictions
                .flatMap(p => p.recommendations)
                .slice(0, 5); // Top 5 recommendations

            res.json({
                currentRisks,
                healthScore: latestPrediction.overallHealthScore,
                trend: latestPrediction.trendDirection,
                recommendations: allRecommendations
            });
        } catch (error: any) {
            res.status(500).json({ message: error.message || "Failed to fetch dashboard" });
        }
    });
}

export function registerLabRoutes(app: Express) {
    // Add new lab result
    app.post("/api/lab-results", async (req, res) => {
        try {
            const labData = req.body;

            // Validate and create lab result
            const validatedData = insertLabResultSchema.parse(labData);
            const labResult = await storage.createLabResult(validatedData);

            res.json({ labResult });
        } catch (error: any) {
            res.status(400).json({ message: error.message || "Failed to create lab result" });
        }
    });

    // Get patient lab results with optional filters
    app.get("/api/lab-results/patient/:patientId", async (req, res) => {
        try {
            const { patientId } = req.params;
            const { testType, startDate, endDate } = req.query;

            const filters: any = {};
            if (testType) filters.testType = testType as string;
            if (startDate) filters.startDate = new Date(startDate as string);
            if (endDate) filters.endDate = new Date(endDate as string);

            const labResults = await storage.getPatientLabResults(patientId, filters);
            res.json({ labResults });
        } catch (error: any) {
            res.status(500).json({ message: error.message || "Failed to fetch lab results" });
        }
    });

    // Get lab trends for a specific test
    app.get("/api/lab-results/trends/:patientId/:testName", async (req, res) => {
        try {
            const { patientId, testName } = req.params;
            const trends = await storage.getLabTrends(patientId, decodeURIComponent(testName));
            res.json(trends);
        } catch (error: any) {
            res.status(500).json({ message: error.message || "Failed to fetch trends" });
        }
    });

    // Get lab test reference ranges
    app.get("/api/lab-results/reference-ranges", async (req, res) => {
        try {
            res.json({ ranges: LAB_TEST_RANGES });
        } catch (error: any) {
            res.status(500).json({ message: error.message || "Failed to fetch reference ranges" });
        }
    });

    // Get single lab result by ID
    app.get("/api/lab-results/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const labResult = await storage.getLabResultById(id);

            if (!labResult) {
                return res.status(404).json({ message: "Lab result not found" });
            }

            res.json({ labResult });
        } catch (error: any) {
            res.status(500).json({ message: error.message || "Failed to fetch lab result" });
        }
    });

    // Update lab result
    app.patch("/api/lab-results/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Basic validation - ensure ID matches if provided in body
            if (updateData.id && updateData.id !== id) {
                return res.status(400).json({ message: "ID mismatch" });
            }

            const updatedResult = await storage.updateLabResult(id, updateData);
            res.json({ labResult: updatedResult });
        } catch (error: any) {
            res.status(500).json({ message: error.message || "Failed to update lab result" });
        }
    });
}
