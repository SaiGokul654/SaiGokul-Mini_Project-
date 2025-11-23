import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function usePredictions(patientId: string | undefined) {
    return useQuery({
        queryKey: [`/api/predictions/${patientId}`],
        enabled: !!patientId,
    });
}

export function useGeneratePrediction() {
    return useMutation({
        mutationFn: async (patientId: string) => {
            return await apiRequest("POST", "/api/predictions/generate", { patientId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey[0];
                    return typeof key === 'string' && key.includes('/api/predictions');
                }
            });
        },
    });
}

export function usePredictionDashboard(patientId: string | undefined) {
    return useQuery({
        queryKey: [`/api/predictions/dashboard/${patientId}`],
        enabled: !!patientId,
    });
}

export function useLabResults(patientId: string | undefined, filters?: { testType?: string; startDate?: string; endDate?: string }) {
    const queryString = new URLSearchParams(filters as any).toString();
    return useQuery({
        queryKey: [`/api/lab-results/patient/${patientId}?${queryString}`],
        enabled: !!patientId,
    });
}

export function useLabTrends(patientId: string | undefined, testName: string | undefined) {
    return useQuery({
        queryKey: [`/api/lab-results/trends/${patientId}/${encodeURIComponent(testName || '')}`],
        enabled: !!patientId && !!testName,
    });
}

export function useAddLabResult() {
    return useMutation({
        mutationFn: async (labResult: any) => {
            return await apiRequest("POST", "/api/lab-results", labResult);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey[0];
                    return typeof key === 'string' && key.includes('/api/lab-results');
                }
            });
        },
    });
}

export function useUpdateLabResult() {
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            return await apiRequest("PATCH", `/api/lab-results/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey[0];
                    return typeof key === 'string' && key.includes('/api/lab-results');
                }
            });
        },
    });
}

export function useReferenceRanges() {
    return useQuery({
        queryKey: ["/api/lab-results/reference-ranges"],
    });
}
