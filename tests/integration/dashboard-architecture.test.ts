/**
 * Integration Test Suite: Dashboard Architecture & Platform Evaluation
 *
 * Story 4.16 (#168): Dashboard Architecture Spike — SaaS vs In-House vs Hybrid
 *
 * Validates:
 * 1. Platform evaluation completeness and persona scoring
 * 2. Cost projection models and surge pricing resistance
 * 3. Persona separation (Jacob edge ops vs Chris drop room)
 * 4. Hybrid Tri-Layer architecture specifications
 * 5. Full coverage of Story 4.15 metrics catalog
 * 6. ADR markdown documentation integrity
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PLATFORM_EVALUATIONS,
  PERSONA_REQUIREMENTS,
  HYBRID_LAYER_SPECS,
  calculateMonthlyCost,
  getArchitectureSpikeSummary,
  type PlatformId,
} from '../../apps/web/src/lib/dashboard-architecture';
import {
  ENGINEERING_METRICS,
  CREATOR_METRICS,
} from '../../apps/web/src/lib/metrics-catalog';

describe('Story 4.16: Dashboard Architecture & Platform Evaluation Spike', () => {
  describe('Candidate Platform Evaluations', () => {
    const expectedPlatforms: PlatformId[] = [
      'datadog',
      'grafana_cloud',
      'better_stack',
      'cloudflare_native',
      'custom_in_house',
      'hybrid_recommended',
    ];

    it('should define all 6 candidate platforms with complete metadata', () => {
      for (const id of expectedPlatforms) {
        const platform = PLATFORM_EVALUATIONS[id];
        assert.ok(platform, `Platform ${id} must be defined`);
        assert.ok(platform.name, `Platform ${id} must have a name`);
        assert.ok(platform.category, `Platform ${id} must have a category`);
        assert.ok(platform.setupTimeHours > 0, `Platform ${id} must have setupTimeHours > 0`);
        assert.ok(platform.pros.length >= 2, `Platform ${id} must have >= 2 pros`);
        assert.ok(platform.cons.length >= 1, `Platform ${id} must have >= 1 cons`);
        assert.ok(platform.supportedDataSources.length >= 2, `Platform ${id} must have >= 2 data sources`);
      }
    });

    it('should accurately differentiate persona fitness scores', () => {
      // Jacob needs deep technical telemetry
      assert.ok(PLATFORM_EVALUATIONS.datadog.personaFitnessJacob >= 8);
      assert.ok(PLATFORM_EVALUATIONS.grafana_cloud.personaFitnessJacob >= 8);
      assert.ok(PLATFORM_EVALUATIONS.cloudflare_native.personaFitnessJacob >= 8);
      assert.equal(PLATFORM_EVALUATIONS.hybrid_recommended.personaFitnessJacob, 10);

      // Chris needs a simplified, creator-friendly drop dashboard
      assert.ok(PLATFORM_EVALUATIONS.datadog.personaFitnessChris <= 3);
      assert.ok(PLATFORM_EVALUATIONS.grafana_cloud.personaFitnessChris <= 4);
      assert.equal(PLATFORM_EVALUATIONS.custom_in_house.personaFitnessChris, 10);
      assert.equal(PLATFORM_EVALUATIONS.hybrid_recommended.personaFitnessChris, 10);
    });

    it('should reject Datadog and select Hybrid as recommended architecture', () => {
      assert.equal(PLATFORM_EVALUATIONS.datadog.recommendationStatus, 'rejected');
      assert.equal(PLATFORM_EVALUATIONS.hybrid_recommended.recommendationStatus, 'recommended');
    });
  });

  describe('Cost Models & Surge Pricing Simulation', () => {
    it('should calculate baseline and high-volume surge costs correctly', () => {
      const summary = getArchitectureSpikeSummary();

      // Datadog costs surge with event volume and seat licensing
      const datadogSpike = summary.costComparison.highVolumeDropSpikeCostUsd.datadog;
      assert.ok(datadogSpike > 50, `Expected Datadog spike > $50, got $${datadogSpike}`);

      // Hybrid and In-House incur $0 additional SaaS recurring costs
      const hybridBaseline = summary.costComparison.lowVolumeMonthlyCostUsd.hybrid_recommended;
      const hybridSpike = summary.costComparison.highVolumeDropSpikeCostUsd.hybrid_recommended;
      assert.equal(hybridBaseline, 0);
      assert.ok(hybridSpike <= 1.0, `Expected Hybrid spike <= $1.00, got $${hybridSpike}`);
    });

    it('should calculate zero egress fees for Cloudflare Native and Custom In-House', () => {
      assert.equal(PLATFORM_EVALUATIONS.cloudflare_native.costModel.egressCostPerGbUsd, 0);
      assert.equal(PLATFORM_EVALUATIONS.custom_in_house.costModel.egressCostPerGbUsd, 0);
      assert.equal(PLATFORM_EVALUATIONS.hybrid_recommended.costModel.egressCostPerGbUsd, 0);
      assert.ok(PLATFORM_EVALUATIONS.datadog.costModel.egressCostPerGbUsd > 0);
    });
  });

  describe('Persona Requirements & Access Control', () => {
    it('should enforce distinct operational boundaries between Jacob and Chris', () => {
      const jacob = PERSONA_REQUIREMENTS.engineering;
      const chris = PERSONA_REQUIREMENTS.creator;

      assert.equal(jacob.sensitiveDataExposure, 'full_technical');
      assert.equal(chris.sensitiveDataExposure, 'creator_business_only');

      assert.ok(jacob.authMethod.includes('Cloudflare Access'));
      assert.ok(chris.authMethod.includes('Payload CMS'));

      assert.ok(jacob.keyGoals.includes('Real-time edge RPS, 5xx error spikes, and worker CPU time'));
      assert.ok(chris.keyGoals.includes('Total GMV and average order value (AOV)'));
    });
  });

  describe('Hybrid Tri-Layer Architecture Specifications', () => {
    it('should define exactly 3 coordinated layers', () => {
      assert.equal(HYBRID_LAYER_SPECS.length, 3);

      const layers = HYBRID_LAYER_SPECS.map((l) => l.layer);
      assert.ok(layers.includes('creator_drop_room'));
      assert.ok(layers.includes('jacob_edge_ops'));
      assert.ok(layers.includes('synthetic_heartbeat'));
    });

    it('should target sub-100ms response time for Creator Drop Room', () => {
      const dropRoom = HYBRID_LAYER_SPECS.find((l) => l.layer === 'creator_drop_room');
      assert.ok(dropRoom);
      assert.ok(dropRoom.latencyTargetMs <= 100);
      assert.ok(dropRoom.hostLocation.includes('admin/drop-room'));
      assert.equal(dropRoom.targetAudience, 'Chris');
    });

    it('should target Jacob ops portal with Cloudflare Access protection', () => {
      const edgeOps = HYBRID_LAYER_SPECS.find((l) => l.layer === 'jacob_edge_ops');
      assert.ok(edgeOps);
      assert.ok(edgeOps.authentication.includes('Cloudflare Access Zero Trust'));
      assert.equal(edgeOps.targetAudience, 'Jacob');
    });

    it('should configure Better Stack external synthetic heartbeat as Layer 3', () => {
      const heartbeat = HYBRID_LAYER_SPECS.find((l) => l.layer === 'synthetic_heartbeat');
      assert.ok(heartbeat);
      assert.equal(heartbeat.targetAudience, 'Autonomous Ops');
      assert.ok(heartbeat.dataSources.includes('HTTP GET /api/health (Bypass Cloudflare Access)'));
      assert.ok(heartbeat.keyComponents.includes('Discord #dev-alerts Webhook Forwarder'));
    });
  });

  describe('Coverage of Story 4.15 Metrics Catalog', () => {
    it('should map 100% of engineering and creator metrics into the hybrid dashboard', () => {
      const summary = getArchitectureSpikeSummary();

      assert.equal(summary.metricsCoverage.engineeringMapped, 12);
      assert.equal(summary.metricsCoverage.engineeringTotal, 12);

      assert.equal(summary.metricsCoverage.creatorMapped, 11);
      assert.equal(summary.metricsCoverage.creatorTotal, 11);
    });

    it('should verify all mapped metric IDs correspond to real catalog entries', () => {
      const allCatalogMetricIds = new Set<string>([
        ...ENGINEERING_METRICS.map((m) => m.id),
        ...CREATOR_METRICS.map((m) => m.id),
      ]);

      for (const layer of HYBRID_LAYER_SPECS) {
        for (const metricId of layer.metricIds) {
          assert.ok(
            allCatalogMetricIds.has(metricId),
            `Mapped metric ID ${metricId} not found in catalog`
          );
        }
      }
    });
  });

  describe('Architectural Decision Record (ADR) Document', () => {
    it('should verify docs/analysis/DASHBOARD_ARCHITECTURE_EVALUATION.md exists and is complete', () => {
      const adrPath = path.resolve(__dirname, '../../docs/analysis/DASHBOARD_ARCHITECTURE_EVALUATION.md');
      assert.ok(fs.existsSync(adrPath), `ADR file must exist at ${adrPath}`);

      const content = fs.readFileSync(adrPath, 'utf8');
      assert.ok(content.includes('Architectural Decision Record'));
      assert.ok(content.includes('Hybrid Tri-Layer Architecture'));
      assert.ok(content.includes('Platform Comparison Matrix'));
      assert.ok(content.includes('Deep-Dive Trade-Off Analysis'));
      assert.ok(content.includes('Implementation Roadmap & Backlog Recommendations'));
      assert.ok(content.length > 5000);
    });
  });
});
