import { useState } from "react";
import { Activity, AlertTriangle, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePredictionDashboard, useGeneratePrediction } from "@/hooks/usePredictionsAndLabs";

interface PredictionDashboardProps {
    patientId: string;
    canGenerate?: boolean;
}

export function PredictionDashboard({ patientId, canGenerate = false }: PredictionDashboardProps) {
    const { toast } = useToast();
    const { data: dashboard, isLoading } = usePredictionDashboard(patientId);
    const generatePrediction = useGeneratePrediction();

    const handleGenerate = async () => {
        try {
            await generatePrediction.mutateAsync(patientId);
            toast({
                title: "Predictions generated",
                description: "Health risk predictions have been updated"
            });
        } catch (error: any) {
            toast({
                title: "Failed to generate predictions",
                description: error.message,
                variant: "destructive"
            });
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (!dashboard || !(dashboard as any).healthScore) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Predictions Available</h3>
                    <p className="text-muted-foreground mb-4">
                        Generate health predictions to see risk assessment
                    </p>
                    {canGenerate && (
                        <Button onClick={handleGenerate} disabled={generatePrediction.isPending}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            {generatePrediction.isPending ? "Generating..." : "Generate Predictions"}
                        </Button>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Health Predictions</h2>
                    <p className="text-muted-foreground">AI-powered risk assessment and recommendations</p>
                </div>
                {canGenerate && (
                    <Button onClick={handleGenerate} disabled={generatePrediction.isPending}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        {generatePrediction.isPending ? "Generating..." : "Refresh Predictions"}
                    </Button>
                )}
            </div>

            <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Overall Health Score
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-6">
                        <div className="flex-1">
                            <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-5xl font-bold">{(dashboard as any).healthScore}</span>
                                <span className="text-2xl text-muted-foreground">/100</span>
                            </div>
                            <Progress value={(dashboard as any).healthScore} className="h-3" />
                        </div>
                        <div className="flex items-center gap-2">
                            {(dashboard as any).trend === 'improving' && (
                                <>
                                    <TrendingUp className="h-6 w-6 text-green-500" />
                                    <span className="text-green-500 font-medium">Improving</span>
                                </>
                            )}
                            {(dashboard as any).trend === 'declining' && (
                                <>
                                    <TrendingDown className="h-6 w-6 text-red-500" />
                                    <span className="text-red-500 font-medium">Declining</span>
                                </>
                            )}
                            {(dashboard as any).trend === 'stable' && (
                                <span className="text-muted-foreground font-medium">Stable</span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {(dashboard as any).currentRisks && (dashboard as any).currentRisks.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        High-Risk Conditions
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(dashboard as any).currentRisks.map((risk: any, idx: number) => (
                            <RiskCard key={idx} risk={risk} />
                        ))}
                    </div>
                </div>
            )}

            {(dashboard as any).recommendations && (dashboard as any).recommendations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Personalized Recommendations</CardTitle>
                        <CardDescription>Based on your health profile and risk factors</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            {(dashboard as any).recommendations.map((rec: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-2">
                                    <span className="text-primary mt-1">•</span>
                                    <span className="text-sm">{rec}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function RiskCard({ risk }: { risk: any }) {
    const getRiskColor = (level: string) => {
        switch (level) {
            case 'critical': return 'destructive';
            case 'high': return 'default';
            case 'medium': return 'secondary';
            default: return 'outline';
        }
    };

    const getRiskBgColor = (level: string) => {
        switch (level) {
            case 'critical': return 'bg-destructive/10 border-destructive';
            case 'high': return 'bg-orange-500/10 border-orange-500';
            case 'medium': return 'bg-yellow-500/10 border-yellow-500';
            default: return 'bg-muted border-border';
        }
    };

    return (
        <Card className={`${getRiskBgColor(risk.riskLevel)} border-2`}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{risk.condition}</CardTitle>
                    <Badge variant={getRiskColor(risk.riskLevel) as any}>
                        {risk.riskLevel}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">{risk.riskScore}</span>
                        <span className="text-muted-foreground">/100</span>
                    </div>
                    <Progress value={risk.riskScore} className="h-2" />
                </div>
            </CardContent>
        </Card>
    );
}
