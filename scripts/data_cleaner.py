"""
Data Cleaner Module

This module provides comprehensive data cleaning and preprocessing capabilities for health records,
including missing value imputation, outlier detection, normalization, and data transformation.
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler
from sklearn.impute import SimpleImputer, KNNImputer
from sklearn.experimental import enable_iterative_imputer
from sklearn.impute import IterativeImputer
from scipy import stats
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime, timedelta
import logging
import warnings
warnings.filterwarnings('ignore')


class DataCleaner:
    """
    A comprehensive class for cleaning and preprocessing health data.
    """

    def __init__(self, data: Optional[pd.DataFrame] = None, config: Optional[Dict[str, Any]] = None):
        self.data = data.copy() if data is not None else None
        self.original_data = data.copy() if data is not None else None
        self.config = config or self._get_default_config()
        self.cleaning_log = []
        self.logger = logging.getLogger(__name__)

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default cleaning configuration."""
        return {
            'missing_value_strategy': 'auto',
            'outlier_method': 'iqr',
            'scaling_method': 'standard',
            'encoding_method': 'label',
            'remove_duplicates': True,
            'handle_inconsistencies': True
        }

    def load_data(self, data: pd.DataFrame):
        """
        Load data for cleaning.

        Args:
            data: Pandas DataFrame containing health data
        """
        self.data = data.copy()
        self.original_data = data.copy()
        self.cleaning_log = []
        self._log_action("Data loaded", f"Shape: {data.shape}")

    def clean_data(self) -> pd.DataFrame:
        """
        Perform comprehensive data cleaning pipeline.

        Returns:
            Cleaned DataFrame
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        self.logger.info("Starting data cleaning pipeline")

        # Step 1: Remove duplicates
        if self.config['remove_duplicates']:
            self._remove_duplicates()

        # Step 2: Handle data type inconsistencies
        if self.config['handle_inconsistencies']:
            self._handle_data_type_inconsistencies()

        # Step 3: Clean column names
        self._clean_column_names()

        # Step 4: Handle missing values
        self._handle_missing_values()

        # Step 5: Detect and handle outliers
        self._handle_outliers()

        # Step 6: Normalize/standardize data
        self._scale_numeric_features()

        # Step 7: Encode categorical variables
        self._encode_categorical_features()

        # Step 8: Final validation
        self._validate_cleaned_data()

        self.logger.info("Data cleaning pipeline completed")
        return self.data.copy()

    def _remove_duplicates(self):
        """Remove duplicate rows from the dataset."""
        initial_shape = self.data.shape
        self.data = self.data.drop_duplicates()
        final_shape = self.data.shape
        duplicates_removed = initial_shape[0] - final_shape[0]

        if duplicates_removed > 0:
            self._log_action("Duplicates removed", f"Removed {duplicates_removed} duplicate rows")
        else:
            self._log_action("Duplicates check", "No duplicates found")

    def _handle_data_type_inconsistencies(self):
        """Handle data type inconsistencies and convert to appropriate types."""
        changes_made = 0

        for col in self.data.columns:
            # Try to convert numeric columns
            if self.data[col].dtype == 'object':
                # Check if column should be numeric
                try:
                    # Remove common non-numeric characters and try conversion
                    cleaned_series = self.data[col].astype(str).str.replace(r'[^\d.-]', '', regex=True)
                    cleaned_series = pd.to_numeric(cleaned_series, errors='coerce')
                    if cleaned_series.notna().sum() > len(cleaned_series) * 0.8:  # 80% convertible
                        self.data[col] = cleaned_series
                        changes_made += 1
                        self._log_action("Data type conversion", f"Converted {col} to numeric")
                except:
                    pass

            # Convert date columns
            if 'date' in col.lower() or 'time' in col.lower():
                try:
                    self.data[col] = pd.to_datetime(self.data[col], errors='coerce')
                    changes_made += 1
                    self._log_action("Data type conversion", f"Converted {col} to datetime")
                except:
                    pass

        if changes_made == 0:
            self._log_action("Data type check", "No data type inconsistencies found")

    def _clean_column_names(self):
        """Clean and standardize column names."""
        def clean_name(name):
            # Convert to lowercase, replace spaces and special chars with underscores
            import re
            name = str(name).lower()
            name = re.sub(r'[^\w\s-]', '', name)
            name = re.sub(r'[\s_-]+', '_', name)
            name = name.strip('_')
            return name

        original_columns = self.data.columns.tolist()
        self.data.columns = [clean_name(col) for col in self.data.columns]

        if original_columns != self.data.columns.tolist():
            self._log_action("Column names cleaned", f"Standardized {len(self.data.columns)} column names")
        else:
            self._log_action("Column names check", "Column names already clean")

    def _handle_missing_values(self):
        """Handle missing values using various imputation strategies."""
        missing_summary = self.data.isnull().sum()
        total_missing = missing_summary.sum()

        if total_missing == 0:
            self._log_action("Missing values check", "No missing values found")
            return

        strategy = self.config['missing_value_strategy']

        for col in self.data.columns:
            missing_count = self.data[col].isnull().sum()
            if missing_count == 0:
                continue

            if self.data[col].dtype in ['int64', 'float64']:
                # Numeric column imputation
                if strategy == 'auto':
                    # Use median for skewed data, mean for normal data
                    if self._is_skewed(self.data[col].dropna()):
                        imputer = SimpleImputer(strategy='median')
                    else:
                        imputer = SimpleImputer(strategy='mean')
                elif strategy == 'knn':
                    imputer = KNNImputer(n_neighbors=5)
                elif strategy == 'iterative':
                    imputer = IterativeImputer(random_state=42)
                else:
                    imputer = SimpleImputer(strategy=strategy)

                self.data[col] = imputer.fit_transform(self.data[[col]]).ravel()

            else:
                # Categorical column imputation
                imputer = SimpleImputer(strategy='most_frequent')
                self.data[col] = imputer.fit_transform(self.data[[col]]).ravel()

        self._log_action("Missing values handled", f"Imputed {total_missing} missing values")

    def _is_skewed(self, series: pd.Series, threshold: float = 0.5) -> bool:
        """Check if a numeric series is skewed."""
        try:
            skewness = series.skew()
            return abs(skewness) > threshold
        except:
            return False

    def _handle_outliers(self):
        """Detect and handle outliers in numeric columns."""
        method = self.config['outlier_method']
        numeric_columns = self.data.select_dtypes(include=[np.number]).columns
        outliers_handled = 0

        for col in numeric_columns:
            if method == 'iqr':
                outliers_handled += self._handle_outliers_iqr(col)
            elif method == 'zscore':
                outliers_handled += self._handle_outliers_zscore(col)
            elif method == 'isolation_forest':
                outliers_handled += self._handle_outliers_isolation_forest(col)

        if outliers_handled > 0:
            self._log_action("Outliers handled", f"Processed {outliers_handled} outliers")
        else:
            self._log_action("Outliers check", "No outliers detected")

    def _handle_outliers_iqr(self, column: str) -> int:
        """Handle outliers using IQR method."""
        series = self.data[column].dropna()
        Q1 = series.quantile(0.25)
        Q3 = series.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR

        outliers = ((self.data[column] < lower_bound) | (self.data[column] > upper_bound))
        outlier_count = outliers.sum()

        if outlier_count > 0:
            # Cap outliers at bounds
            self.data[column] = np.where(self.data[column] < lower_bound, lower_bound,
                                       np.where(self.data[column] > upper_bound, upper_bound,
                                              self.data[column]))

        return outlier_count

    def _handle_outliers_zscore(self, column: str) -> int:
        """Handle outliers using Z-score method."""
        series = self.data[column].dropna()
        z_scores = np.abs(stats.zscore(series))
        outliers = z_scores > 3
        outlier_count = outliers.sum()

        if outlier_count > 0:
            # Remove outliers
            self.data = self.data[~outliers]

        return outlier_count

    def _handle_outliers_isolation_forest(self, column: str) -> int:
        """Handle outliers using Isolation Forest."""
        try:
            from sklearn.ensemble import IsolationForest
            iso_forest = IsolationForest(contamination=0.1, random_state=42)
            outliers = iso_forest.fit_predict(self.data[[column]])
            outlier_count = (outliers == -1).sum()

            if outlier_count > 0:
                # Remove outliers
                self.data = self.data[outliers != -1]

            return outlier_count
        except ImportError:
            self.logger.warning("IsolationForest not available, skipping outlier detection")
            return 0

    def _scale_numeric_features(self):
        """Scale/normalize numeric features."""
        numeric_columns = self.data.select_dtypes(include=[np.number]).columns
        if len(numeric_columns) == 0:
            return

        method = self.config['scaling_method']

        if method == 'standard':
            scaler = StandardScaler()
        elif method == 'minmax':
            scaler = MinMaxScaler()
        elif method == 'robust':
            scaler = RobustScaler()
        else:
            return

        # Only scale columns that aren't already scaled (don't scale IDs, etc.)
        columns_to_scale = []
        for col in numeric_columns:
            if not (col.lower().endswith('_id') or col.lower().startswith('id')):
                columns_to_scale.append(col)

        if columns_to_scale:
            self.data[columns_to_scale] = scaler.fit_transform(self.data[columns_to_scale])
            self._log_action("Feature scaling", f"Scaled {len(columns_to_scale)} numeric features using {method} scaling")

    def _encode_categorical_features(self):
        """Encode categorical features."""
        categorical_columns = self.data.select_dtypes(include=['object', 'category']).columns
        method = self.config['encoding_method']
        encoded_count = 0

        for col in categorical_columns:
            unique_values = self.data[col].nunique()

            if method == 'label' and unique_values <= 10:
                # Label encoding for ordinal or low-cardinality categorical
                from sklearn.preprocessing import LabelEncoder
                le = LabelEncoder()
                self.data[col] = le.fit_transform(self.data[col].astype(str))
                encoded_count += 1

            elif method == 'onehot' or unique_values > 10:
                # One-hot encoding for high-cardinality categorical
                dummies = pd.get_dummies(self.data[col], prefix=col, drop_first=True)
                self.data = pd.concat([self.data.drop(col, axis=1), dummies], axis=1)
                encoded_count += 1

        if encoded_count > 0:
            self._log_action("Categorical encoding", f"Encoded {encoded_count} categorical features")

    def _validate_cleaned_data(self):
        """Validate the cleaned dataset."""
        issues = []

        # Check for remaining missing values
        remaining_missing = self.data.isnull().sum().sum()
        if remaining_missing > 0:
            issues.append(f"{remaining_missing} missing values remain")

        # Check for infinite values
        infinite_count = np.isinf(self.data.select_dtypes(include=[np.number])).sum().sum()
        if infinite_count > 0:
            issues.append(f"{infinite_count} infinite values found")

        # Check data types
        if not all(dt in ['int64', 'float64', 'object', 'datetime64[ns]'] for dt in self.data.dtypes):
            issues.append("Unexpected data types found")

        if issues:
            self._log_action("Validation issues", "; ".join(issues))
        else:
            self._log_action("Data validation", "All validation checks passed")

    def _log_action(self, action: str, details: str):
        """Log a cleaning action."""
        timestamp = datetime.now().isoformat()
        log_entry = {
            'timestamp': timestamp,
            'action': action,
            'details': details
        }
        self.cleaning_log.append(log_entry)
        self.logger.info(f"{action}: {details}")

    def get_cleaning_report(self) -> Dict[str, Any]:
        """
        Get a comprehensive report of the cleaning process.

        Returns:
            Dictionary containing cleaning statistics and logs
        """
        if self.data is None:
            return {'error': 'No data loaded'}

        report = {
            'original_shape': self.original_data.shape if self.original_data is not None else None,
            'cleaned_shape': self.data.shape,
            'cleaning_actions': self.cleaning_log,
            'data_types': {col: str(dtype) for col, dtype in self.data.dtypes.items()},
            'missing_values_summary': self.data.isnull().sum().to_dict(),
            'numeric_columns_stats': {}
        }

        # Add statistics for numeric columns
        numeric_cols = self.data.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            report['numeric_columns_stats'][col] = {
                'mean': self.data[col].mean(),
                'std': self.data[col].std(),
                'min': self.data[col].min(),
                'max': self.data[col].max(),
                'missing': self.data[col].isnull().sum()
            }

        return report

    def undo_last_action(self):
        """Undo the last cleaning action (if possible)."""
        if len(self.cleaning_log) > 0:
            last_action = self.cleaning_log.pop()
            self.logger.info(f"Undid action: {last_action['action']}")
            # Note: Actual undo would require more complex state management
            # This is a simplified version

    def save_cleaned_data(self, filepath: str, format: str = 'csv'):
        """
        Save the cleaned data to a file.

        Args:
            filepath: Path to save the file
            format: File format ('csv', 'json', 'pickle')
        """
        if self.data is None:
            raise ValueError("No cleaned data available")

        if format == 'csv':
            self.data.to_csv(filepath, index=False)
        elif format == 'json':
            self.data.to_json(filepath, orient='records', date_format='iso')
        elif format == 'pickle':
            self.data.to_pickle(filepath)
        else:
            raise ValueError(f"Unsupported format: {format}")

        self._log_action("Data saved", f"Saved cleaned data to {filepath} in {format} format")


if __name__ == "__main__":
    # Example usage
    cleaner = DataCleaner()

    # Create sample health data with issues
    np.random.seed(42)
    sample_data = pd.DataFrame({
        'patient_id': range(1, 201),
        'age': [np.nan if i % 20 == 0 else max(18, min(90, x)) for i, x in enumerate(np.random.normal(50, 15, 200))],
        'blood_pressure': [f"{np.random.randint(110, 180)}/{np.random.randint(70, 110)}" for _ in range(200)],
        'cholesterol': [np.nan if i % 15 == 0 else np.random.normal(200, 40) for i in range(200)],
        'glucose': [999 if i % 25 == 0 else np.random.normal(100, 25) for i in range(200)],  # Some extreme values
        'diagnosis': np.random.choice(['Hypertension', 'Diabetes', 'Healthy', 'Asthma', np.nan], 200),
        'admission_date': [f"2023-{np.random.randint(1, 13):02d}-{np.random.randint(1, 28):02d}" for _ in range(200)],
        'medication_count': np.random.poisson(2, 200)
    })

    # Add some duplicates
    sample_data = pd.concat([sample_data, sample_data.iloc[:10]], ignore_index=True)

    cleaner.load_data(sample_data)

    try:
        cleaned_data = cleaner.clean_data()
        print(f"Original shape: {sample_data.shape}")
        print(f"Cleaned shape: {cleaned_data.shape}")

        report = cleaner.get_cleaning_report()
        print(f"Cleaning actions performed: {len(report['cleaning_actions'])}")

        # Save cleaned data
        cleaner.save_cleaned_data('cleaned_health_data.csv')
        print("Cleaned data saved successfully")

    except Exception as e:
        print(f"Cleaning error: {e}")
