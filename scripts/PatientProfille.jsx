import React, { useState, useEffect } from 'react';

const PatientProfile = ({ patientId, onClose }) => {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (patientId) {
      fetchPatientData();
    }
  }, [patientId]);

  const fetchPatientData = async () => {
    setLoading(true);
    try {
      // Simulate API call - replace with actual API endpoint
      const response = await fetch(`/api/patients/${patientId}`);
      if (response.ok) {
        const data = await response.json();
        setPatient(data);
      } else {
        // Mock data for demonstration
        setPatient({
          id: patientId,
          name: `Patient ${patientId}`,
          age: Math.floor(Math.random() * 60) + 20,
          gender: Math.random() > 0.5 ? 'Male' : 'Female',
          diagnosis: ['Hypertension', 'Diabetes', 'Asthma', 'Healthy'][Math.floor(Math.random() * 4)],
          bloodPressure: `${Math.floor(Math.random() * 40) + 110}/${Math.floor(Math.random() * 20) + 70}`,
          cholesterol: Math.floor(Math.random() * 100) + 150,
          glucose: Math.floor(Math.random() * 80) + 70,
          admissionDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          medications: [
            { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily' },
            { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' }
          ],
          labResults: [
            { test: 'Hemoglobin A1c', value: '6.2%', normalRange: '4.0-5.6%', date: '2023-12-01' },
            { test: 'Total Cholesterol', value: '185 mg/dL', normalRange: '<200 mg/dL', date: '2023-12-01' },
            { test: 'HDL Cholesterol', value: '45 mg/dL', normalRange: '>40 mg/dL', date: '2023-12-01' }
          ],
          vitals: {
            heartRate: Math.floor(Math.random() * 40) + 60,
            temperature: (Math.random() * 4 + 96).toFixed(1),
            oxygenSaturation: Math.floor(Math.random() * 5) + 95
          }
        });
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      setPatient(null);
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevel = (diagnosis) => {
    const riskLevels = {
      'Hypertension': 'high',
      'Diabetes': 'high',
      'Asthma': 'medium',
      'Healthy': 'low'
    };
    return riskLevels[diagnosis] || 'unknown';
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-center mt-4 text-gray-600">Loading patient data...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <p className="text-red-600 mb-4">Failed to load patient data</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const riskLevel = getRiskLevel(patient.diagnosis);
  const riskColor = getRiskColor(riskLevel);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{patient.name}</h2>
            <p className="text-gray-600">Patient ID: {patient.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Quick Stats */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Age</p>
                <p className="text-xl font-semibold text-gray-900">{patient.age}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Gender</p>
                <p className="text-xl font-semibold text-gray-900">{patient.gender}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Blood Pressure</p>
                <p className="text-xl font-semibold text-gray-900">{patient.bloodPressure}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Risk Level</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${riskColor}`}>
                  {riskLevel.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 py-4">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {[
                  { id: 'overview', label: 'Overview', icon: '📋' },
                  { id: 'vitals', label: 'Vitals', icon: '❤️' },
                  { id: 'labs', label: 'Lab Results', icon: '🔬' },
                  { id: 'medications', label: 'Medications', icon: '💊' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="py-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-lg font-medium text-gray-900 mb-3">Patient Information</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Diagnosis:</span>
                          <span className="font-medium">{patient.diagnosis}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Admission Date:</span>
                          <span className="font-medium">
                            {new Date(patient.admissionDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cholesterol:</span>
                          <span className="font-medium">{patient.cholesterol} mg/dL</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Glucose:</span>
                          <span className="font-medium">{patient.glucose} mg/dL</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-lg font-medium text-gray-900 mb-3">Health Status</h3>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Blood Pressure</span>
                            <span>{patient.bloodPressure}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{width: '70%'}}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Cholesterol</span>
                            <span>{patient.cholesterol} mg/dL</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-green-600 h-2 rounded-full" style={{width: '60%'}}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Glucose</span>
                            <span>{patient.glucose} mg/dL</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-yellow-600 h-2 rounded-full" style={{width: '80%'}}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'vitals' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900">Vital Signs</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                      <div className="text-4xl mb-2">❤️</div>
                      <h4 className="text-lg font-medium text-gray-900">Heart Rate</h4>
                      <p className="text-3xl font-bold text-red-600">{patient.vitals.heartRate}</p>
                      <p className="text-sm text-gray-600">bpm</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                      <div className="text-4xl mb-2">🌡️</div>
                      <h4 className="text-lg font-medium text-gray-900">Temperature</h4>
                      <p className="text-3xl font-bold text-blue-600">{patient.vitals.temperature}°F</p>
                      <p className="text-sm text-gray-600">Normal: 97-99°F</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                      <div className="text-4xl mb-2">🫁</div>
                      <h4 className="text-lg font-medium text-gray-900">Oxygen Saturation</h4>
                      <p className="text-3xl font-bold text-green-600">{patient.vitals.oxygenSaturation}%</p>
                      <p className="text-sm text-gray-600">Normal: {'>'}95%</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'labs' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900">Laboratory Results</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Test
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Value
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Normal Range
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {patient.labResults.map((result, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {result.test}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {result.value}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {result.normalRange}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(result.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                Normal
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'medications' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900">Current Medications</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {patient.medications.map((medication, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <div className="text-2xl mr-3">💊</div>
                          <div className="flex-1">
                            <h4 className="text-lg font-medium text-gray-900">{medication.name}</h4>
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Dosage:</span> {medication.dosage}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Frequency:</span> {medication.frequency}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientProfile;
