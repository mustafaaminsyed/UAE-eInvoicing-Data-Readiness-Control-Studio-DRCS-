import { CoreRunner } from '@/engine/contracts';
import { runAllChecksWithTelemetry } from '@/lib/checks/checksRegistry';

export const defaultCoreRunner: CoreRunner = {
  run({ dataContext, direction }) {
    return runAllChecksWithTelemetry(dataContext, direction);
  },
};
