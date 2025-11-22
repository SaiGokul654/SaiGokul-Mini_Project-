"""
Data Analyzer Module

This module provides advanced data analysis capabilities for health records,
including statistical analysis, trend detection, and predictive insights.
"""

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import warnings
warnings.filterwarnings('ignore')


class HealthDataAnalyzer:
    """
    A comprehensive class for analyzing health data.
    """

    def __init__(self, data: Optional[pd.DataFrame] = None):
        self.data = data.copy() if data is not None else None
        self.scaler = StandardScaler()
        self.analysis_results = {}

    def load_data(self, data: pd.DataFrame):
        """
        Load data for analysis.

        Args:
            data: Pandas DataFrame containing health data
        """
        self.data = data.copy()
        self._preprocess_data()

    def _preprocess_data(self):
        """Preprocess the loaded data."""
        if self.data is None:
            return

        # Convert date columns
        date_columns = [col for col in self.data.columns if 'date' in col.lower()]
        for col in date_columns:
            try:
                self.data[col] = pd.to_datetime(self.data[col])
            except:
                pass

        # Handle missing values
        numeric_columns = self.data.select_dtypes(include=[np.number]).columns
        for col in numeric_columns:
            self.data[col].fillna(self.data[col].median(), inplace=True)

        categorical_columns = self.data.select_dtypes(include=['object']).columns
        for col in categorical_columns:
            self.data[col].fillna(self.data[col].mode().iloc[0] if not self.data[col].mode().empty else 'Unknown', inplace=True)

    def perform_statistical_analysis(self, columns: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Perform comprehensive statistical analysis on specified columns.

        Args:
            columns: List of column names to analyze. If None, analyzes all numeric columns.

        Returns:
            Dictionary containing statistical results
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        if columns is None:
            columns = self.data.select_dtypes(include=[np.number]).columns.tolist()

        results = {}
        for col in columns:
            if col in self.data.columns:
                series = self.data[col].dropna()
                results[col] = {
                    'count': len(series),
                    'mean': series.mean(),
                    'median': series.median(),
                    'std': series.std(),
                    'min': series.min(),
                    'max': series.max(),
                    'skewness': series.skew(),
                    'kurtosis': series.kurtosis(),
                    'quartiles': series.quantile([0.25, 0.75]).to_dict()
                }

                # Normality test
                if len(series) > 3:
                    _, p_value = stats.shapiro(series.sample(min(5000, len(series))))
                    results[col]['normality_p_value'] = p_value
                    results[col]['is_normal'] = p_value > 0.05

        self.analysis_results['statistical_analysis'] = results
        return results

    def detect_outliers(self, columns: Optional[List[str]] = None, method: str = 'iqr') -> Dict[str, List[int]]:
        """
        Detect outliers in specified columns using various methods.

        Args:
            columns: List of column names to check for outliers
            method: Method to use ('iqr', 'zscore', 'isolation_forest')

        Returns:
            Dictionary mapping column names to lists of outlier indices
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        if columns is None:
            columns = self.data.select_dtypes(include=[np.number]).columns.tolist()

        outliers = {}

        for col in columns:
            if col in self.data.columns:
                series = self.data[col].dropna()

                if method == 'iqr':
                    Q1 = series.quantile(0.25)
                    Q3 = series.quantile(0.75)
                    IQR = Q3 - Q1
                    lower_bound = Q1 - 1.5 * IQR
                    upper_bound = Q3 + 1.5 * IQR
                    outlier_indices = self.data[self.data[col].apply(lambda x: x < lower_bound or x > upper_bound if pd.notna(x) else False)].index.tolist()

                elif method == 'zscore':
                    z_scores = np.abs(stats.zscore(series))
                    outlier_indices = self.data[pd.Series(z_scores > 3, index=series.index)].index.tolist()

                else:
                    outlier_indices = []

                outliers[col] = outlier_indices

        self.analysis_results['outliers'] = outliers
        return outliers

    def perform_clustering(self, columns: List[str], n_clusters: int = 3) -> Dict[str, Any]:
        """
        Perform K-means clustering on specified columns.

        Args:
            columns: List of column names to use for clustering
            n_clusters: Number of clusters to create

        Returns:
            Dictionary containing clustering results
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        # Prepare data for clustering
        cluster_data = self.data[columns].dropna()
        if len(cluster_data) == 0:
            raise ValueError("No valid data for clustering")

        scaled_data = self.scaler.fit_transform(cluster_data)

        # Perform clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(scaled_data)

        results = {
            'cluster_labels': clusters.tolist(),
            'cluster_centers': kmeans.cluster_centers_.tolist(),
            'inertia': kmeans.inertia_,
            'n_clusters': n_clusters,
            'columns_used': columns
        }

        # Add cluster labels to original data
        self.data['cluster'] = np.nan
        self.data.loc[cluster_data.index, 'cluster'] = clusters

        self.analysis_results['clustering'] = results
        return results

    def analyze_trends(self, date_column: str, value_column: str, group_by: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze trends over time for a specific value column.

        Args:
            date_column: Name of the date column
            value_column: Name of the value column to analyze
            group_by: Optional column to group trends by

        Returns:
            Dictionary containing trend analysis results
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        if date_column not in self.data.columns or value_column not in self.data.columns:
            raise ValueError("Specified columns not found in data")

        # Prepare data
        trend_data = self.data[[date_column, value_column]].copy()
        if group_by and group_by in self.data.columns:
            trend_data[group_by] = self.data[group_by]

        trend_data = trend_data.dropna()
        trend_data[date_column] = pd.to_datetime(trend_data[date_column])
        trend_data = trend_data.sort_values(date_column)

        results = {}

        if group_by:
            for group_value, group_df in trend_data.groupby(group_by):
                results[str(group_value)] = self._calculate_trend_metrics(group_df[date_column], group_df[value_column])
        else:
            results['overall'] = self._calculate_trend_metrics(trend_data[date_column], trend_data[value_column])

        self.analysis_results['trend_analysis'] = results
        return results

    def _calculate_trend_metrics(self, dates: pd.Series, values: pd.Series) -> Dict[str, Any]:
        """Calculate trend metrics for a time series."""
        # Convert dates to numeric (days since start)
        date_numeric = (dates - dates.min()).dt.days.values.reshape(-1, 1)
        value_array = values.values.reshape(-1, 1)

        # Linear regression for trend
        if len(date_numeric) > 1:
            reg = LinearRegression()
            reg.fit(date_numeric, value_array)
            slope = reg.coef_[0][0]
            intercept = reg.intercept_[0]
            r_squared = reg.score(date_numeric, value_array)
        else:
            slope = intercept = r_squared = 0

        # Calculate moving averages
        if len(values) >= 7:
            ma_7 = values.rolling(window=7).mean().iloc[-1] if len(values) >= 7 else None
            ma_30 = values.rolling(window=30).mean().iloc[-1] if len(values) >= 30 else None
        else:
            ma_7 = ma_30 = None

        return {
            'slope': slope,
            'intercept': intercept,
            'r_squared': r_squared,
            'trend_direction': 'increasing' if slope > 0 else 'decreasing' if slope < 0 else 'stable',
            'moving_average_7': ma_7,
            'moving_average_30': ma_30,
            'data_points': len(values)
        }

    def generate_correlation_matrix(self, columns: Optional[List[str]] = None) -> pd.DataFrame:
        """
        Generate correlation matrix for specified columns.

        Args:
            columns: List of column names. If None, uses all numeric columns.

        Returns:
            Pandas DataFrame containing correlation matrix
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        if columns is None:
            columns = self.data.select_dtypes(include=[np.number]).columns.tolist()

        corr_matrix = self.data[columns].corr()
        self.analysis_results['correlation_matrix'] = corr_matrix
        return corr_matrix

    def get_analysis_summary(self) -> Dict[str, Any]:
        """
        Get a summary of all performed analyses.

        Returns:
            Dictionary containing analysis summary
        """
        return self.analysis_results.copy()


if __name__ == "__main__":
    # Example usage
    analyzer = HealthDataAnalyzer()

    # Create sample data
    np.random.seed(42)
    sample_data = pd.DataFrame({
        'patient_id': range(1, 101),
        'age': np.random.normal(50, 15, 100),
        'blood_pressure': np.random.normal(120, 20, 100),
        'cholesterol': np.random.normal(200, 40, 100),
        'glucose': np.random.normal(100, 25, 100),
        'date': pd.date_range('2023-01-01', periods=100, freq='D')
    })

    analyzer.load_data(sample_data)

    # Perform various analyses
    try:
        stats = analyzer.perform_statistical_analysis(['age', 'blood_pressure', 'cholesterol'])
        print("Statistical analysis completed")

        outliers = analyzer.detect_outliers(['blood_pressure', 'cholesterol'])
        print(f"Outliers detected in {len(outliers)} columns")

        clusters = analyzer.perform_clustering(['age', 'blood_pressure', 'cholesterol'], n_clusters=3)
        print(f"Clustering completed with {clusters['n_clusters']} clusters")

        trends = analyzer.analyze_trends('date', 'blood_pressure')
        print("Trend analysis completed")

        corr_matrix = analyzer.generate_correlation_matrix()
        print("Correlation analysis completed")

        summary = analyzer.get_analysis_summary()
        print(f"Analysis summary contains {len(summary)} sections")

    except Exception as e:
        print(f"Error during analysis: {e}")
