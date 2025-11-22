"""
Data Validator Module

This module provides utilities for validating health data records,
ensuring data integrity and compliance with medical standards.
"""

import re
from typing import Dict, List, Any, Optional
from datetime import datetime, date


class DataValidator:
    """
    A class for validating various types of health data.
    """

    def __init__(self, strict_mode: bool = False):
        self.strict_mode = strict_mode
        self.validation_errors: List[str] = []

    def validate_patient_record(self, record: Dict[str, Any]) -> bool:
        """
        Validate a patient record dictionary.

        Args:
            record: Dictionary containing patient information

        Returns:
            bool: True if valid, False otherwise
        """
        self.validation_errors = []

        # Validate required fields
        required_fields = ['patient_id', 'name', 'date_of_birth', 'gender']
        for field in required_fields:
            if field not in record:
                self.validation_errors.append(f"Missing required field: {field}")
                if self.strict_mode:
                    return False

        # Validate patient ID format
        if 'patient_id' in record:
            if not self._is_valid_patient_id(record['patient_id']):
                self.validation_errors.append("Invalid patient ID format")

        # Validate date of birth
        if 'date_of_birth' in record:
            if not self._is_valid_date(record['date_of_birth']):
                self.validation_errors.append("Invalid date of birth")

        # Validate gender
        if 'gender' in record:
            if record['gender'] not in ['M', 'F', 'Other']:
                self.validation_errors.append("Invalid gender value")

        return len(self.validation_errors) == 0

    def validate_lab_result(self, result: Dict[str, Any]) -> bool:
        """
        Validate a lab result dictionary.

        Args:
            result: Dictionary containing lab result information

        Returns:
            bool: True if valid, False otherwise
        """
        self.validation_errors = []

        # Validate required fields
        required_fields = ['test_name', 'value', 'unit', 'reference_range']
        for field in required_fields:
            if field not in result:
                self.validation_errors.append(f"Missing required field: {field}")
                if self.strict_mode:
                    return False

        # Validate numeric value
        if 'value' in result:
            try:
                float(result['value'])
            except (ValueError, TypeError):
                self.validation_errors.append("Invalid numeric value")

        # Validate reference range format
        if 'reference_range' in result:
            if not self._is_valid_reference_range(result['reference_range']):
                self.validation_errors.append("Invalid reference range format")

        return len(self.validation_errors) == 0

    def _is_valid_patient_id(self, patient_id: str) -> bool:
        """
        Check if patient ID follows the expected format.
        Expected format: alphanumeric, 8-12 characters
        """
        pattern = r'^[A-Za-z0-9]{8,12}$'
        return bool(re.match(pattern, str(patient_id)))

    def _is_valid_date(self, date_str: str) -> bool:
        """
        Check if date string is valid.
        """
        try:
            datetime.strptime(date_str, '%Y-%m-%d')
            return True
        except ValueError:
            return False

    def _is_valid_reference_range(self, range_str: str) -> bool:
        """
        Check if reference range string is valid.
        Expected format: "min-max" or "< max" or "> min"
        """
        patterns = [
            r'^\d+(\.\d+)?-\d+(\.\d+)?$',  # min-max
            r'^<\s*\d+(\.\d+)?$',          # < max
            r'^>\s*\d+(\.\d+)?$'           # > min
        ]
        return any(re.match(pattern, str(range_str)) for pattern in patterns)

    def get_validation_errors(self) -> List[str]:
        """
        Get list of validation errors from the last validation.

        Returns:
            List of error messages
        """
        return self.validation_errors.copy()


def validate_batch_records(records: List[Dict[str, Any]], validator: Optional[DataValidator] = None) -> Dict[str, Any]:
    """
    Validate a batch of records.

    Args:
        records: List of record dictionaries
        validator: Optional DataValidator instance

    Returns:
        Dictionary with validation results
    """
    if validator is None:
        validator = DataValidator()

    results = {
        'total_records': len(records),
        'valid_records': 0,
        'invalid_records': 0,
        'errors': []
    }

    for i, record in enumerate(records):
        is_valid = validator.validate_patient_record(record)
        if is_valid:
            results['valid_records'] += 1
        else:
            results['invalid_records'] += 1
            results['errors'].append({
                'record_index': i,
                'errors': validator.get_validation_errors()
            })

    return results


if __name__ == "__main__":
    # Example usage
    validator = DataValidator(strict_mode=True)

    sample_record = {
        'patient_id': 'PAT123456',
        'name': 'John Doe',
        'date_of_birth': '1985-03-15',
        'gender': 'M'
    }

    is_valid = validator.validate_patient_record(sample_record)
    print(f"Record valid: {is_valid}")
    if not is_valid:
        print("Errors:", validator.get_validation_errors())
