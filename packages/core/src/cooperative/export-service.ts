/**
 * Export Service Module
 *
 * Generates reports in various formats (Excel, CSV, JSON).
 * Used by cooperative administrators to export data for analysis.
 */

import type { MemberCropReport, SupplyReport, ExportFormat } from '@minori/shared';
import { formatDate } from '@minori/shared';

/**
 * Export result containing the file data.
 */
export interface ExportResult {
  filename: string;
  mimeType: string;
  data: Buffer | string;
}

/**
 * Formats a date for display in reports.
 */
function formatReportDate(date: Date): string {
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Generates CSV content from data rows.
 */
function generateCsv(headers: string[], rows: string[][]): string {
  const escapeCsvValue = (val: string): string => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(','));

  return [headerLine, ...dataLines].join('\n');
}

/**
 * Export service for generating report files.
 */
export class ExportService {
  /**
   * Exports a member crop report to the specified format.
   *
   * @param report - Member crop report data
   * @param format - Export format
   * @returns Export result with file data
   */
  async exportMemberCropReport(
    report: MemberCropReport,
    format: ExportFormat = 'csv'
  ): Promise<ExportResult> {
    const timestamp = formatReportDate(report.generatedAt);

    switch (format) {
      case 'csv':
        return this.exportMemberCropReportCsv(report, timestamp);
      case 'json':
        return this.exportMemberCropReportJson(report, timestamp);
      case 'xlsx':
        // For now, return CSV with xlsx extension
        // TODO: Add ExcelJS for proper XLSX support
        return this.exportMemberCropReportCsv(report, timestamp, true);
      default:
        return this.exportMemberCropReportCsv(report, timestamp);
    }
  }

  /**
   * Exports member crop report to CSV format.
   */
  private exportMemberCropReportCsv(
    report: MemberCropReport,
    timestamp: string,
    asXlsx = false
  ): ExportResult {
    const headers = [
      '作物名稱',
      '總面積(分地)',
      '農友數',
      '預估產量(公斤)',
      '預計採收日期',
      '信心度(%)',
    ];

    const rows = report.crops.map((crop) => [
      crop.cropName,
      crop.totalArea.toFixed(1),
      crop.farmerCount.toString(),
      crop.estimatedYield.toFixed(0),
      formatDate(crop.estimatedHarvestDate),
      (crop.confidence * 100).toFixed(0),
    ]);

    // Add summary row
    rows.push([`總計: ${report.totalFarmers} 位農友`, report.totalArea.toFixed(1), '', '', '', '']);

    const csv = generateCsv(headers, rows);

    return {
      filename: `會員作物報表_${timestamp}.${asXlsx ? 'csv' : 'csv'}`,
      mimeType: 'text/csv; charset=utf-8',
      data: '\uFEFF' + csv, // Add BOM for Excel compatibility
    };
  }

  /**
   * Exports member crop report to JSON format.
   */
  private exportMemberCropReportJson(report: MemberCropReport, timestamp: string): ExportResult {
    const json = JSON.stringify(report, null, 2);

    return {
      filename: `會員作物報表_${timestamp}.json`,
      mimeType: 'application/json',
      data: json,
    };
  }

  /**
   * Exports a supply report to the specified format.
   *
   * @param report - Supply report data
   * @param format - Export format
   * @returns Export result with file data
   */
  async exportSupplyReport(
    report: SupplyReport,
    format: ExportFormat = 'csv'
  ): Promise<ExportResult> {
    const timestamp = formatReportDate(report.generatedAt);
    const periodStr = `${formatDate(report.periodStart)}-${formatDate(report.periodEnd)}`;

    switch (format) {
      case 'csv':
        return this.exportSupplyReportCsv(report, timestamp, periodStr);
      case 'json':
        return this.exportSupplyReportJson(report, timestamp, periodStr);
      case 'xlsx':
        // For now, return CSV with xlsx extension
        // TODO: Add ExcelJS for proper XLSX support
        return this.exportSupplyReportCsv(report, timestamp, periodStr, true);
      default:
        return this.exportSupplyReportCsv(report, timestamp, periodStr);
    }
  }

  /**
   * Exports supply report to CSV format.
   */
  private exportSupplyReportCsv(
    report: SupplyReport,
    timestamp: string,
    periodStr: string,
    asXlsx = false
  ): ExportResult {
    const headers = [
      '作物名稱',
      '預估數量(公斤)',
      '農友數',
      '最早採收日',
      '最晚採收日',
      '農友明細',
    ];

    const rows = report.items.map((item) => {
      const farmerDetails = item.farmers
        .map((f) => `${f.farmerName}:${f.quantity.toFixed(0)}kg`)
        .join('; ');

      return [
        item.cropName,
        item.estimatedQuantity.toFixed(0),
        item.farmerCount.toString(),
        formatDate(item.earliestDate),
        formatDate(item.latestDate),
        farmerDetails,
      ];
    });

    const csv = generateCsv(headers, rows);

    return {
      filename: `出貨報表_${periodStr}_${timestamp}.${asXlsx ? 'csv' : 'csv'}`,
      mimeType: 'text/csv; charset=utf-8',
      data: '\uFEFF' + csv, // Add BOM for Excel compatibility
    };
  }

  /**
   * Exports supply report to JSON format.
   */
  private exportSupplyReportJson(
    report: SupplyReport,
    timestamp: string,
    periodStr: string
  ): ExportResult {
    const json = JSON.stringify(report, null, 2);

    return {
      filename: `出貨報表_${periodStr}_${timestamp}.json`,
      mimeType: 'application/json',
      data: json,
    };
  }
}
