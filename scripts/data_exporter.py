"""
Data Exporter Module

This module provides comprehensive data export capabilities for health records,
supporting multiple formats including CSV, JSON, XML, and database exports.
"""

import csv
import json
import xml.etree.ElementTree as ET
from xml.dom import minidom
import pandas as pd
import sqlite3
from typing import Dict, List, Any, Optional, Union
from pathlib import Path
from datetime import datetime
import logging
import zipfile
import io


class DataExporter:
    """
    A versatile class for exporting health data in various formats.
    """

    def __init__(self, data: Optional[pd.DataFrame] = None, export_dir: str = "exports"):
        self.data = data.copy() if data is not None else None
        self.export_dir = Path(export_dir)
        self.export_dir.mkdir(exist_ok=True)
        self.logger = logging.getLogger(__name__)
        self.export_history = []

    def load_data(self, data: pd.DataFrame):
        """
        Load data for export.

        Args:
            data: Pandas DataFrame containing health data
        """
        self.data = data.copy()

    def export_to_csv(self, filename: str, columns: Optional[List[str]] = None,
                     include_index: bool = False, delimiter: str = ',',
                     encoding: str = 'utf-8') -> str:
        """
        Export data to CSV format.

        Args:
            filename: Name of the output file (without extension)
            columns: List of columns to export. If None, exports all columns.
            include_index: Whether to include DataFrame index
            delimiter: CSV delimiter character
            encoding: File encoding

        Returns:
            Path to the exported file
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        export_data = self.data[columns] if columns else self.data
        filepath = self.export_dir / f"{filename}.csv"

        export_data.to_csv(filepath, index=include_index, sep=delimiter,
                          encoding=encoding, date_format='%Y-%m-%d %H:%M:%S')

        self._log_export('csv', str(filepath))
        return str(filepath)

    def export_to_json(self, filename: str, orient: str = 'records',
                      columns: Optional[List[str]] = None,
                      pretty_print: bool = True) -> str:
        """
        Export data to JSON format.

        Args:
            filename: Name of the output file (without extension)
            orient: JSON orientation ('records', 'index', 'values', etc.)
            columns: List of columns to export. If None, exports all columns.
            pretty_print: Whether to format JSON with indentation

        Returns:
            Path to the exported file
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        export_data = self.data[columns] if columns else self.data
        filepath = self.export_dir / f"{filename}.json"

        indent = 2 if pretty_print else None
        export_data.to_json(filepath, orient=orient, indent=indent, date_format='iso')

        self._log_export('json', str(filepath))
        return str(filepath)

    def export_to_xml(self, filename: str, root_element: str = 'records',
                     record_element: str = 'record',
                     columns: Optional[List[str]] = None) -> str:
        """
        Export data to XML format.

        Args:
            filename: Name of the output file (without extension)
            root_element: Name of the root XML element
            record_element: Name of individual record elements
            columns: List of columns to export. If None, exports all columns.

        Returns:
            Path to the exported file
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        export_data = self.data[columns] if columns else self.data
        filepath = self.export_dir / f"{filename}.xml"

        root = ET.Element(root_element)

        for _, row in export_data.iterrows():
            record = ET.SubElement(root, record_element)
            for col, value in row.items():
                # Handle different data types
                if pd.isna(value):
                    str_value = ""
                elif isinstance(value, (int, float)):
                    str_value = str(value)
                elif isinstance(value, datetime):
                    str_value = value.isoformat()
                else:
                    str_value = str(value)

                ET.SubElement(record, self._sanitize_xml_tag(col)).text = str_value

        # Pretty print XML
        rough_string = ET.tostring(root, encoding='unicode')
        reparsed = minidom.parseString(rough_string)
        pretty_xml = reparsed.toprettyxml(indent="  ")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(pretty_xml)

        self._log_export('xml', str(filepath))
        return str(filepath)

    def export_to_database(self, db_path: str, table_name: str,
                          if_exists: str = 'replace',
                          columns: Optional[List[str]] = None) -> str:
        """
        Export data to SQLite database.

        Args:
            db_path: Path to the SQLite database file
            table_name: Name of the table to create/update
            if_exists: What to do if table exists ('fail', 'replace', 'append')
            columns: List of columns to export. If None, exports all columns.

        Returns:
            Path to the database file
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        export_data = self.data[columns] if columns else self.data

        db_filepath = Path(db_path)
        if not db_filepath.is_absolute():
            db_filepath = self.export_dir / db_path

        # Convert datetime columns to string for SQLite
        export_data_copy = export_data.copy()
        for col in export_data_copy.select_dtypes(include=['datetime64']):
            export_data_copy[col] = export_data_copy[col].dt.strftime('%Y-%m-%d %H:%M:%S')

        export_data_copy.to_sql(table_name, f'sqlite:///{db_filepath}',
                               if_exists=if_exists, index=False)

        self._log_export('database', str(db_filepath))
        return str(db_filepath)

    def export_multiple_formats(self, base_filename: str,
                               formats: List[str] = ['csv', 'json', 'xml'],
                               columns: Optional[List[str]] = None) -> Dict[str, str]:
        """
        Export data in multiple formats simultaneously.

        Args:
            base_filename: Base name for all export files
            formats: List of formats to export ('csv', 'json', 'xml', 'db')
            columns: List of columns to export. If None, exports all columns.

        Returns:
            Dictionary mapping format names to file paths
        """
        results = {}

        for fmt in formats:
            try:
                if fmt == 'csv':
                    results['csv'] = self.export_to_csv(base_filename, columns=columns)
                elif fmt == 'json':
                    results['json'] = self.export_to_json(base_filename, columns=columns)
                elif fmt == 'xml':
                    results['xml'] = self.export_to_xml(base_filename, columns=columns)
                elif fmt == 'db':
                    results['db'] = self.export_to_database(f"{base_filename}.db", base_filename, columns=columns)
            except Exception as e:
                self.logger.error(f"Failed to export to {fmt}: {e}")

        return results

    def create_zip_archive(self, files: List[str], archive_name: str) -> str:
        """
        Create a ZIP archive containing multiple exported files.

        Args:
            files: List of file paths to include in the archive
            archive_name: Name of the ZIP archive (without extension)

        Returns:
            Path to the created ZIP archive
        """
        archive_path = self.export_dir / f"{archive_name}.zip"

        with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in files:
                file_path = Path(file_path)
                if file_path.exists():
                    zipf.write(file_path, file_path.name)

        self._log_export('zip', str(archive_path))
        return str(archive_path)

    def export_with_metadata(self, base_filename: str,
                           metadata: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
        """
        Export data with accompanying metadata file.

        Args:
            base_filename: Base name for export files
            metadata: Additional metadata to include

        Returns:
            Dictionary with paths to data and metadata files
        """
        # Export main data
        data_path = self.export_to_json(base_filename)

        # Create metadata
        if metadata is None:
            metadata = {}

        metadata.update({
            'export_timestamp': datetime.now().isoformat(),
            'total_records': len(self.data) if self.data is not None else 0,
            'columns': list(self.data.columns) if self.data is not None else [],
            'data_types': {col: str(dtype) for col, dtype in self.data.dtypes.items()} if self.data is not None else {}
        })

        # Export metadata
        metadata_path = self.export_dir / f"{base_filename}_metadata.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, default=str)

        self._log_export('metadata', str(metadata_path))

        return {
            'data': data_path,
            'metadata': str(metadata_path)
        }

    def _sanitize_xml_tag(self, tag: str) -> str:
        """Sanitize column names for use as XML tags."""
        # Replace invalid characters with underscores
        import re
        sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', tag)
        # Ensure it starts with a letter or underscore
        if sanitized and not (sanitized[0].isalpha() or sanitized[0] == '_'):
            sanitized = f"_{sanitized}"
        return sanitized

    def _log_export(self, format_type: str, filepath: str):
        """Log export operation."""
        self.export_history.append({
            'timestamp': datetime.now().isoformat(),
            'format': format_type,
            'filepath': filepath
        })
        self.logger.info(f"Exported data to {format_type}: {filepath}")

    def get_export_history(self) -> List[Dict[str, Any]]:
        """
        Get history of all export operations.

        Returns:
            List of export records
        """
        return self.export_history.copy()

    def validate_export_data(self) -> Dict[str, Any]:
        """
        Validate data before export.

        Returns:
            Dictionary with validation results
        """
        if self.data is None:
            return {'valid': False, 'errors': ['No data loaded']}

        validation = {
            'valid': True,
            'total_rows': len(self.data),
            'total_columns': len(self.data.columns),
            'missing_values': {},
            'data_types': {},
            'errors': []
        }

        # Check for missing values
        for col in self.data.columns:
            missing_count = self.data[col].isnull().sum()
            if missing_count > 0:
                validation['missing_values'][col] = missing_count

        # Record data types
        for col in self.data.columns:
            validation['data_types'][col] = str(self.data[col].dtype)

        # Check for potential issues
        if len(self.data) == 0:
            validation['errors'].append('DataFrame is empty')
            validation['valid'] = False

        if len(self.data.columns) == 0:
            validation['errors'].append('DataFrame has no columns')
            validation['valid'] = False

        return validation


if __name__ == "__main__":
    # Example usage
    exporter = DataExporter()

    # Create sample health data
    sample_data = pd.DataFrame({
        'patient_id': range(1, 11),
        'name': [f'Patient_{i}' for i in range(1, 11)],
        'age': [25, 30, 45, 50, 35, 60, 28, 42, 55, 33],
        'diagnosis': ['Hypertension', 'Diabetes', 'Asthma', 'Arthritis', 'Migraine',
                     'Depression', 'Allergies', 'Back Pain', 'Anemia', 'Thyroid'],
        'admission_date': pd.date_range('2023-01-01', periods=10, freq='D'),
        'blood_pressure': ['120/80', '130/85', '125/82', '140/90', '118/78',
                          '135/88', '122/80', '128/84', '132/86', '126/82'],
        'temperature': [98.6, 99.1, 98.4, 100.2, 98.8, 99.5, 98.3, 98.9, 99.8, 98.7]
    })

    exporter.load_data(sample_data)

    # Validate data
    validation = exporter.validate_export_data()
    print(f"Data validation: {'Passed' if validation['valid'] else 'Failed'}")

    # Export in multiple formats
    try:
        exports = exporter.export_multiple_formats('health_records_sample', ['csv', 'json', 'xml'])
        print(f"Exported to: {list(exports.keys())}")

        # Create ZIP archive
        zip_path = exporter.create_zip_archive(list(exports.values()), 'health_records_archive')
        print(f"Created ZIP archive: {zip_path}")

        # Export with metadata
        meta_exports = exporter.export_with_metadata('health_records_with_meta')
        print(f"Exported with metadata: {list(meta_exports.keys())}")

        # Show export history
        history = exporter.get_export_history()
        print(f"Total exports performed: {len(history)}")

    except Exception as e:
        print(f"Export error: {e}")
