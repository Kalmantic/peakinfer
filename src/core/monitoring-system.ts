/**
 * Monitoring System - Track template execution and trigger rollbacks
 * Simplified version without Claude Code SDK integration
 */

import { OptimizationTemplate, TemplateExecutionResult, MonitoringMetric, RollbackTrigger } from '../types/template.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class MonitoringSystem {
  private activeMonitors: Map<string, MonitoringSession> = new Map();
  private metricsHistory: Map<string, MetricSnapshot[]> = new Map();

  /**
   * Start monitoring a template execution
   */
  async startMonitoring(template: OptimizationTemplate, executionId: string): Promise<void> {
    console.log(`📊 Starting monitoring for ${template.name} (${executionId})`);

    const session: MonitoringSession = {
      template,
      executionId,
      startTime: new Date(),
      metrics: template.monitoring.key_metrics,
      triggers: template.monitoring.rollback_triggers,
      isActive: true
    };

    this.activeMonitors.set(executionId, session);

    // Start monitoring loop
    this.monitoringLoop(session);
  }

  /**
   * Stop monitoring a template execution
   */
  stopMonitoring(executionId: string): void {
    const session = this.activeMonitors.get(executionId);
    if (session) {
      session.isActive = false;
      this.activeMonitors.delete(executionId);
      console.log(`📊 Stopped monitoring for ${session.template.name}`);
    }
  }

  /**
   * Main monitoring loop
   */
  private async monitoringLoop(session: MonitoringSession): Promise<void> {
    while (session.isActive) {
      try {
        await this.collectMetrics(session);
        await this.checkRollbackTriggers(session);

        // Wait before next check (default 30 seconds)
        await new Promise(resolve => setTimeout(resolve, 30000));

      } catch (error) {
        console.error(`❌ Monitoring error for ${session.executionId}:`, error instanceof Error ? error.message : String(error));

        // Continue monitoring despite errors
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
  }

  /**
   * Collect metrics using simplified commands
   */
  private async collectMetrics(session: MonitoringSession): Promise<void> {
    const metrics: Record<string, number> = {};

    // Collect basic system metrics
    try {
      // CPU usage
      const { stdout: cpuUsage } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//'");
      metrics.cpu_usage = parseFloat(cpuUsage.trim()) || 0;

      // Memory usage
      const { stdout: memUsage } = await execAsync("free | grep Mem | awk '{printf \"%.1f\", $3/$2 * 100.0}'");
      metrics.memory_usage = parseFloat(memUsage.trim()) || 0;

      // Add timestamp
      metrics.timestamp = Date.now();

    } catch (error) {
      console.warn('Failed to collect some metrics:', error instanceof Error ? error.message : String(error));
    }

    // Record metrics
    this.recordMetrics(session.executionId, metrics);
  }

  /**
   * Check if any rollback triggers are activated
   */
  private async checkRollbackTriggers(session: MonitoringSession): Promise<void> {
    const currentMetrics = this.getCurrentMetrics(session.executionId);
    const triggersActivated: RollbackTrigger[] = [];

    for (const trigger of session.triggers) {
      const isTriggered = await this.evaluateTriggerCondition(trigger, currentMetrics, session);

      if (isTriggered) {
        triggersActivated.push(trigger);
      }
    }

    if (triggersActivated.length > 0) {
      await this.handleRollbackTriggers(session, triggersActivated);
    }
  }

  /**
   * Evaluate if a trigger condition is met
   */
  private async evaluateTriggerCondition(
    trigger: RollbackTrigger,
    currentMetrics: Record<string, number>,
    session: MonitoringSession
  ): Promise<boolean> {

    // Simple trigger evaluation based on common patterns
    const condition = trigger.condition.toLowerCase();

    if (condition.includes('cpu') && condition.includes('>')) {
      const threshold = this.extractThreshold(condition);
      return currentMetrics.cpu_usage > threshold;
    }

    if (condition.includes('memory') && condition.includes('>')) {
      const threshold = this.extractThreshold(condition);
      return currentMetrics.memory_usage > threshold;
    }

    if (condition.includes('error') && condition.includes('rate')) {
      // For error rate triggers, we'll simulate based on system health
      return currentMetrics.cpu_usage > 90 || currentMetrics.memory_usage > 95;
    }

    return false;
  }

  /**
   * Extract threshold value from condition string
   */
  private extractThreshold(condition: string): number {
    const match = condition.match(/>\s*(\d+)/);
    return match ? parseInt(match[1]) : 80; // Default threshold
  }

  /**
   * Handle activated rollback triggers
   */
  private async handleRollbackTriggers(session: MonitoringSession, triggers: RollbackTrigger[]): Promise<void> {
    console.log(`🚨 Rollback triggers activated for ${session.template.name}:`);
    triggers.forEach(t => console.log(`  - ${t.condition} → ${t.action}`));

    for (const trigger of triggers) {
      switch (trigger.action) {
        case 'automatic_rollback':
          await this.executeAutomaticRollback(session, trigger);
          break;

        case 'alert_and_investigation':
          await this.sendAlert(session, trigger);
          break;

        case 'escalate':
          await this.escalateIssue(session, trigger);
          break;
      }
    }
  }

  /**
   * Execute automatic rollback
   */
  private async executeAutomaticRollback(session: MonitoringSession, trigger: RollbackTrigger): Promise<void> {
    console.log(`🔄 Executing automatic rollback for ${session.template.name}`);

    // Execute rollback commands from template
    for (const step of session.template.implementation.automated_steps.slice().reverse()) {
      if (step.validation.rollback_command) {
        try {
          console.log(`    🔄 Rolling back: ${step.step_id}`);
          await execAsync(step.validation.rollback_command);
          console.log(`    ✅ Rollback completed for: ${step.step_id}`);
        } catch (error) {
          console.error(`    ❌ Rollback failed for ${step.step_id}:`, error instanceof Error ? error.message : String(error));
        }
      }
    }

    console.log(`✅ Automatic rollback completed for ${session.template.name}`);

    // Stop monitoring after successful rollback
    session.isActive = false;
  }

  /**
   * Send alert for investigation
   */
  private async sendAlert(session: MonitoringSession, trigger: RollbackTrigger): Promise<void> {
    console.log(`🚨 ALERT: ${session.template.name} - ${trigger.condition}`);
    console.log(`   Investigation required for execution ${session.executionId}`);

    // In a real implementation, this would send notifications
    // For now, just log the alert
  }

  /**
   * Escalate issue
   */
  private async escalateIssue(session: MonitoringSession, trigger: RollbackTrigger): Promise<void> {
    console.log(`🆘 ESCALATION: ${session.template.name} - ${trigger.condition}`);
    console.log(`   Immediate attention required for execution ${session.executionId}`);

    // In a real implementation, this would page on-call engineers
    // For now, just log the escalation
  }

  /**
   * Record metrics for historical analysis
   */
  private recordMetrics(executionId: string, metrics: Record<string, number>): void {
    const snapshot: MetricSnapshot = {
      timestamp: new Date(),
      metrics
    };

    if (!this.metricsHistory.has(executionId)) {
      this.metricsHistory.set(executionId, []);
    }

    const history = this.metricsHistory.get(executionId)!;
    history.push(snapshot);

    // Keep only last 100 snapshots
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get current metrics for an execution
   */
  private getCurrentMetrics(executionId: string): Record<string, number> {
    const history = this.metricsHistory.get(executionId);
    if (!history || history.length === 0) {
      return {};
    }

    return history[history.length - 1].metrics;
  }

  /**
   * Get metrics history for analysis
   */
  getMetricsHistory(executionId: string): MetricSnapshot[] {
    return this.metricsHistory.get(executionId) || [];
  }

  /**
   * Get active monitoring sessions
   */
  getActiveMonitors(): MonitoringSession[] {
    return Array.from(this.activeMonitors.values());
  }
}

interface MonitoringSession {
  template: OptimizationTemplate;
  executionId: string;
  startTime: Date;
  metrics: MonitoringMetric[];
  triggers: RollbackTrigger[];
  isActive: boolean;
}

interface MetricSnapshot {
  timestamp: Date;
  metrics: Record<string, number>;
}