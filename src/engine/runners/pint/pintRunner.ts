import { PintRunner } from '@/engine/contracts';
import { fetchEnabledPintAEChecks, seedUC1CheckPack } from '@/lib/api/pintAEApi';
import { runAllPintAEChecksWithTelemetry } from '@/lib/checks/pintAECheckRunner';

export const defaultPintRunner: PintRunner = {
  async seedCheckPack(forceUpsert = false) {
    return seedUC1CheckPack(forceUpsert);
  },

  async run({ dataContext }) {
    const checks = await fetchEnabledPintAEChecks();
    const { exceptions, telemetry } = runAllPintAEChecksWithTelemetry(checks, dataContext);
    return { checks, exceptions, telemetry };
  },
};
