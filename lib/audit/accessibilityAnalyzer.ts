import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import type { AuditIssue, AuditResult } from '../types';

export async function runAudit(html: string): Promise<AuditResult> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.setContent(html);
    
    const results = await new AxeBuilder({ page })
      .withRules(['link-name', 'button-name', 'scrollable-region-focusable'])
      .analyze();
      
    const issues: AuditIssue[] = results.violations.map(v => ({
      ruleId: v.id,
      impact: v.impact as AuditIssue['impact'],
      selector: v.nodes.map(n => n.target.join(' ')).join(', '),
      nodeCount: v.nodes.length,
      description: v.description,
    }));
    
    const totalCount = issues.reduce((sum, issue) => sum + issue.nodeCount, 0);
    
    return {
      totalCount,
      issues,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error running accessibility audit:', error);
    return {
      totalCount: 0,
      issues: [],
      timestamp: new Date().toISOString(),
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export function compareAudits(before: AuditResult, after: AuditResult): {
  beforeTotal: number;
  afterTotal: number;
  improvement: number;
  details: Array<{ ruleId: string; before: number; after: number }>;
} {
  const beforeTotal = before.totalCount;
  const afterTotal = after.totalCount;
  const improvement = beforeTotal - afterTotal;
  
  const rules = new Set([
    ...before.issues.map(i => i.ruleId),
    ...after.issues.map(i => i.ruleId),
  ]);
  
  const details = Array.from(rules).map(ruleId => {
    const beforeCount = before.issues
      .filter(i => i.ruleId === ruleId)
      .reduce((sum, issue) => sum + issue.nodeCount, 0);
    const afterCount = after.issues
      .filter(i => i.ruleId === ruleId)
      .reduce((sum, issue) => sum + issue.nodeCount, 0);
    
    return {
      ruleId,
      before: beforeCount,
      after: afterCount,
    };
  });
  
  return {
    beforeTotal,
    afterTotal,
    improvement,
    details,
  };
}
