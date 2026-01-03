/**
 * Cooperative Handler Module
 *
 * Handles queries from cooperative administrators.
 * Provides aggregated data, reports, and export functionality.
 */

import { CooperativeService, ExportService } from '@minori/core';
import { t, formatDate } from '@minori/shared';
import type { ParsedEntities, ExportFormat, ReportType } from '@minori/shared';
import { QuickReplyPresets, type QuickReplyButton } from '../client';

/**
 * Response with optional quick reply buttons.
 */
interface HandlerResponse {
  text: string;
  quickReply?: QuickReplyButton[];
}

/**
 * Quick reply presets for cooperative actions.
 */
export const CooperativeQuickReplyPresets = {
  /** Main menu for cooperative users */
  mainMenu: (): QuickReplyButton[] => [
    { label: '會員作物', text: '查詢會員作物' },
    { label: '本週出貨', text: '本週有什麼可以出' },
    { label: '下週出貨', text: '下週有什麼可以出' },
    { label: '匯出報表', text: '匯出報表' },
  ],

  /** Report type selection */
  reportTypes: (): QuickReplyButton[] => [
    { label: '會員作物報表', text: '匯出會員作物報表' },
    { label: '出貨報表', text: '匯出出貨報表' },
    { label: '取消', text: '取消' },
  ],

  /** Export format selection */
  exportFormats: (): QuickReplyButton[] => [
    { label: 'Excel (CSV)', text: 'CSV格式' },
    { label: 'JSON', text: 'JSON格式' },
    { label: '取消', text: '取消' },
  ],

  /** After query actions */
  afterQuery: (): QuickReplyButton[] => [
    { label: '匯出報表', text: '匯出報表' },
    { label: '其他查詢', text: '主選單' },
  ],
};

/**
 * Handles member crop summary query.
 * Shows aggregated crop data from all cooperative members.
 *
 * @param cooperativeId - Cooperative ID
 * @returns Response with crop summary
 */
export async function handleMemberCropsQuery(cooperativeId: string): Promise<HandlerResponse> {
  try {
    const service = new CooperativeService(cooperativeId);
    const report = await service.getMemberCropReport();

    if (report.crops.length === 0) {
      return {
        text: t('cooperative.memberCrops.empty'),
        quickReply: CooperativeQuickReplyPresets.mainMenu(),
      };
    }

    const lines: string[] = [
      t('cooperative.memberCrops.title'),
      t('cooperative.memberCrops.summary', {
        farmers: report.totalFarmers,
        area: report.totalArea.toFixed(1),
      }),
      '',
    ];

    for (const crop of report.crops) {
      lines.push(
        t('cooperative.memberCrops.item', {
          crop: crop.cropName,
          yield: crop.estimatedYield.toFixed(0),
          farmers: crop.farmerCount,
          date: formatDate(crop.estimatedHarvestDate),
        })
      );
    }

    return {
      text: lines.join('\n'),
      quickReply: CooperativeQuickReplyPresets.afterQuery(),
    };
  } catch (error) {
    console.error('Error fetching member crops:', error);
    return {
      text: t('cooperative.error'),
      quickReply: CooperativeQuickReplyPresets.mainMenu(),
    };
  }
}

/**
 * Handles supply availability query.
 * Shows what can be shipped in a given period.
 *
 * @param cooperativeId - Cooperative ID
 * @param period - 'thisWeek' or 'nextWeek'
 * @returns Response with supply availability
 */
export async function handleSupplyQuery(
  cooperativeId: string,
  period: 'thisWeek' | 'nextWeek' = 'nextWeek'
): Promise<HandlerResponse> {
  try {
    const service = new CooperativeService(cooperativeId);
    const report =
      period === 'thisWeek' ? await service.getThisWeekSupply() : await service.getNextWeekSupply();

    if (report.items.length === 0) {
      return {
        text: t('cooperative.supply.empty', {
          period: period === 'thisWeek' ? '本週' : '下週',
        }),
        quickReply: CooperativeQuickReplyPresets.mainMenu(),
      };
    }

    const periodLabel = period === 'thisWeek' ? '本週' : '下週';
    const lines: string[] = [t('cooperative.supply.title', { period: periodLabel }), ''];

    for (const item of report.items) {
      const farmerNames = item.farmers.map((f) => f.farmerName).join('、');
      lines.push(
        t('cooperative.supply.item', {
          crop: item.cropName,
          quantity: item.estimatedQuantity.toFixed(0),
          farmers: item.farmerCount,
          farmerNames,
        })
      );
    }

    return {
      text: lines.join('\n'),
      quickReply: CooperativeQuickReplyPresets.afterQuery(),
    };
  } catch (error) {
    console.error('Error fetching supply:', error);
    return {
      text: t('cooperative.error'),
      quickReply: CooperativeQuickReplyPresets.mainMenu(),
    };
  }
}

/**
 * Handles export report request.
 * Generates a file and returns it for download.
 *
 * @param cooperativeId - Cooperative ID
 * @param reportType - Type of report to export
 * @param format - Export format
 * @returns Response with export status
 */
export async function handleExportReport(
  cooperativeId: string,
  reportType: ReportType = 'member_crops',
  format: ExportFormat = 'csv'
): Promise<HandlerResponse> {
  try {
    const coopService = new CooperativeService(cooperativeId);
    const exportService = new ExportService();

    let result;

    if (reportType === 'member_crops') {
      const report = await coopService.getMemberCropReport();
      result = await exportService.exportMemberCropReport(report, format);
    } else if (reportType === 'supply') {
      const report = await coopService.getNextWeekSupply();
      result = await exportService.exportSupplyReport(report, format);
    } else {
      return {
        text: t('cooperative.export.unknownType'),
        quickReply: CooperativeQuickReplyPresets.reportTypes(),
      };
    }

    // In a real implementation, we would upload the file and return a download link
    // For now, return a message that the export was generated
    return {
      text: t('cooperative.export.success', {
        filename: result.filename,
      }),
      quickReply: CooperativeQuickReplyPresets.mainMenu(),
    };
  } catch (error) {
    console.error('Error exporting report:', error);
    return {
      text: t('cooperative.export.error'),
      quickReply: CooperativeQuickReplyPresets.mainMenu(),
    };
  }
}

/**
 * Handles cooperative intent actions.
 *
 * @param action - Intent action
 * @param entities - Parsed entities
 * @param cooperativeId - Cooperative ID
 * @returns Response with text and quick replies
 */
export async function handleCooperativeAction(
  action: string,
  entities: Partial<ParsedEntities>,
  cooperativeId: string
): Promise<HandlerResponse> {
  switch (action) {
    case 'query_member_crops':
      return handleMemberCropsQuery(cooperativeId);

    case 'query_supply': {
      // Determine period from date expression
      const period = entities.dateExpression?.includes('本週') ? 'thisWeek' : 'nextWeek';
      return handleSupplyQuery(cooperativeId, period);
    }

    case 'export_report':
      // For now, show report type selection
      return {
        text: t('cooperative.export.askType'),
        quickReply: CooperativeQuickReplyPresets.reportTypes(),
      };

    default:
      return {
        text: t('intent.unknown'),
        quickReply: QuickReplyPresets.helpCancel(),
      };
  }
}
