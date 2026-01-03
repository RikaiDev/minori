/**
 * Export Service Module
 *
 * Generates reports in various formats (Excel, CSV, JSON).
 * Used by cooperative administrators to export data for analysis.
 */

import type { MemberCropReport, SupplyReport, ExportFormat } from '@minori/shared';
import { formatDate } from '@minori/shared';
import ExcelJS from 'exceljs';

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
        return this.exportMemberCropReportXlsx(report, timestamp);
      default:
        return this.exportMemberCropReportCsv(report, timestamp);
    }
  }

  /**
   * Exports member crop report to CSV format.
   */
  private exportMemberCropReportCsv(report: MemberCropReport, timestamp: string): ExportResult {
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
      filename: `會員作物報表_${timestamp}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      data: '\uFEFF' + csv, // Add BOM for Excel compatibility
    };
  }

  /**
   * Exports member crop report to XLSX format.
   */
  private async exportMemberCropReportXlsx(
    report: MemberCropReport,
    timestamp: string
  ): Promise<ExportResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'minori';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('會員作物報表');

    // Define columns with headers
    worksheet.columns = [
      { header: '作物名稱', key: 'cropName', width: 15 },
      { header: '總面積(分地)', key: 'totalArea', width: 15 },
      { header: '農友數', key: 'farmerCount', width: 10 },
      { header: '預估產量(公斤)', key: 'estimatedYield', width: 18 },
      { header: '預計採收日期', key: 'estimatedHarvestDate', width: 15 },
      { header: '信心度(%)', key: 'confidence', width: 12 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' },
    };
    headerRow.alignment = { horizontal: 'center' };

    // Add data rows
    for (const crop of report.crops) {
      worksheet.addRow({
        cropName: crop.cropName,
        totalArea: crop.totalArea,
        farmerCount: crop.farmerCount,
        estimatedYield: crop.estimatedYield,
        estimatedHarvestDate: formatDate(crop.estimatedHarvestDate),
        confidence: Math.round(crop.confidence * 100),
      });
    }

    // Add summary row
    const summaryRow = worksheet.addRow({
      cropName: `總計: ${report.totalFarmers} 位農友`,
      totalArea: report.totalArea,
      farmerCount: '',
      estimatedYield: '',
      estimatedHarvestDate: '',
      confidence: '',
    });
    summaryRow.font = { bold: true };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return {
      filename: `會員作物報表_${timestamp}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: Buffer.from(buffer),
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
        return this.exportSupplyReportXlsx(report, timestamp, periodStr);
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
    periodStr: string
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
      filename: `出貨報表_${periodStr}_${timestamp}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      data: '\uFEFF' + csv, // Add BOM for Excel compatibility
    };
  }

  /**
   * Exports supply report to XLSX format.
   */
  private async exportSupplyReportXlsx(
    report: SupplyReport,
    timestamp: string,
    periodStr: string
  ): Promise<ExportResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'minori';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('出貨報表');

    // Define columns with headers
    worksheet.columns = [
      { header: '作物名稱', key: 'cropName', width: 15 },
      { header: '預估數量(公斤)', key: 'estimatedQuantity', width: 18 },
      { header: '農友數', key: 'farmerCount', width: 10 },
      { header: '最早採收日', key: 'earliestDate', width: 15 },
      { header: '最晚採收日', key: 'latestDate', width: 15 },
      { header: '農友明細', key: 'farmerDetails', width: 40 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2196F3' },
    };
    headerRow.alignment = { horizontal: 'center' };

    // Add data rows
    for (const item of report.items) {
      const farmerDetails = item.farmers
        .map((f) => `${f.farmerName}: ${f.quantity.toFixed(0)}kg`)
        .join('; ');

      worksheet.addRow({
        cropName: item.cropName,
        estimatedQuantity: item.estimatedQuantity,
        farmerCount: item.farmerCount,
        earliestDate: formatDate(item.earliestDate),
        latestDate: formatDate(item.latestDate),
        farmerDetails,
      });
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return {
      filename: `出貨報表_${periodStr}_${timestamp}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: Buffer.from(buffer),
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
