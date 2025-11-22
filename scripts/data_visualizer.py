"""
Data Visualizer Module

This module provides comprehensive data visualization capabilities for health records,
including charts, graphs, and interactive dashboards using matplotlib and seaborn.
"""

import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

# Set style for better looking plots
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")


class HealthDataVisualizer:
    """
    A comprehensive class for visualizing health data.
    """

    def __init__(self, data: Optional[pd.DataFrame] = None, output_dir: str = "visualizations"):
        self.data = data.copy() if data is not None else None
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.figure_count = 0

    def load_data(self, data: pd.DataFrame):
        """
        Load data for visualization.

        Args:
            data: Pandas DataFrame containing health data
        """
        self.data = data.copy()

    def create_histogram(self, column: str, bins: int = 30,
                        title: Optional[str] = None, save_path: Optional[str] = None) -> plt.Figure:
        """
        Create a histogram for a numeric column.

        Args:
            column: Name of the column to plot
            bins: Number of bins for the histogram
            title: Custom title for the plot
            save_path: Path to save the figure

        Returns:
            Matplotlib Figure object
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        if column not in self.data.columns:
            raise ValueError(f"Column '{column}' not found in data.")

        fig, ax = plt.subplots(figsize=(10, 6))

        # Filter out NaN values
        data_clean = self.data[column].dropna()

        ax.hist(data_clean, bins=bins, edgecolor='black', alpha=0.7)
        ax.set_xlabel(column.replace('_', ' ').title())
        ax.set_ylabel('Frequency')
        ax.set_title(title or f'Distribution of {column.replace("_", " ").title()}')
        ax.grid(True, alpha=0.3)

        plt.tight_layout()

        if save_path:
            fig.savefig(self.output_dir / save_path, dpi=300, bbox_inches='tight')

        self.figure_count += 1
        return fig

    def create_boxplot(self, column: str, group_by: Optional[str] = None,
                      title: Optional[str] = None, save_path: Optional[str] = None) -> plt.Figure:
        """
        Create a boxplot for a numeric column, optionally grouped by another column.

        Args:
            column: Name of the numeric column to plot
            group_by: Name of the categorical column to group by
            title: Custom title for the plot
            save_path: Path to save the figure

        Returns:
            Matplotlib Figure object
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        fig, ax = plt.subplots(figsize=(12, 6))

        if group_by:
            if group_by not in self.data.columns:
                raise ValueError(f"Group column '{group_by}' not found in data.")

            # Limit to top categories to avoid overcrowding
            top_categories = self.data[group_by].value_counts().head(10).index
            plot_data = self.data[self.data[group_by].isin(top_categories)]

            sns.boxplot(data=plot_data, x=group_by, y=column, ax=ax)
            ax.set_xticklabels(ax.get_xticklabels(), rotation=45, ha='right')
        else:
            sns.boxplot(data=self.data, y=column, ax=ax)

        ax.set_xlabel(group_by.replace('_', ' ').title() if group_by else '')
        ax.set_ylabel(column.replace('_', ' ').title())
        ax.set_title(title or f'Boxplot of {column.replace("_", " ").title()}' +
                    (f' by {group_by.replace("_", " ").title()}' if group_by else ''))
        ax.grid(True, alpha=0.3)

        plt.tight_layout()

        if save_path:
            fig.savefig(self.output_dir / save_path, dpi=300, bbox_inches='tight')

        self.figure_count += 1
        return fig

    def create_scatter_plot(self, x_column: str, y_column: str,
                           hue_column: Optional[str] = None,
                           title: Optional[str] = None, save_path: Optional[str] = None) -> plt.Figure:
        """
        Create a scatter plot for two numeric columns.

        Args:
            x_column: Name of the x-axis column
            y_column: Name of the y-axis column
            hue_column: Name of the column to color points by
            title: Custom title for the plot
            save_path: Path to save the figure

        Returns:
            Matplotlib Figure object
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        for col in [x_column, y_column]:
            if col not in self.data.columns:
                raise ValueError(f"Column '{col}' not found in data.")

        fig, ax = plt.subplots(figsize=(10, 6))

        plot_data = self.data[[x_column, y_column]].dropna()
        if hue_column and hue_column in self.data.columns:
            plot_data[hue_column] = self.data[hue_column]
            sns.scatterplot(data=plot_data, x=x_column, y=y_column, hue=hue_column, ax=ax, alpha=0.6)
        else:
            sns.scatterplot(data=plot_data, x=x_column, y=y_column, ax=ax, alpha=0.6)

        ax.set_xlabel(x_column.replace('_', ' ').title())
        ax.set_ylabel(y_column.replace('_', ' ').title())
        ax.set_title(title or f'{y_column.replace("_", " ").title()} vs {x_column.replace("_", " ").title()}')
        ax.grid(True, alpha=0.3)

        plt.tight_layout()

        if save_path:
            fig.savefig(self.output_dir / save_path, dpi=300, bbox_inches='tight')

        self.figure_count += 1
        return fig

    def create_correlation_heatmap(self, columns: Optional[List[str]] = None,
                                  title: Optional[str] = None, save_path: Optional[str] = None) -> plt.Figure:
        """
        Create a correlation heatmap for numeric columns.

        Args:
            columns: List of columns to include. If None, uses all numeric columns.
            title: Custom title for the plot
            save_path: Path to save the figure

        Returns:
            Matplotlib Figure object
        """
        if self.data is None:
            raise ValueError("No data loaded. Use load_data() first.")

        if columns is None:
            columns = self.data.select_dtypes(include=[np.number]).columns.tolist()

        if len(columns) < 2:
            raise ValueError("Need at least 2 numeric columns for correlation heatmap.")

        corr_matrix = self.data[columns].corr()

        fig, ax = plt.subplots(figsize=(12, 10))

        mask = np.triu(np.ones_like(corr_matrix, dtype=bool))
        sns.heatmap(corr_matrix, mask=mask, annot=True, cmap='coolwarm',
                   center=0, square=True, linewidths=.5, ax=ax, fmt='.2f')

        ax.set_title(title or 'Correlation Heatmap')
        plt.tight_layout()

        if save_path:
            fig.savefig(self.output_dir / save_path, dpi=300, bbox_inches='tight')

        self.figure_count += 1
        return fig

    def create_time_series_plot(self, date_column: str, value_column: str,
                               group_by: Optional[str] = None,
                               title: Optional[str] = None, save_path: Optional[str] = None) -> plt.Figure:
        """
