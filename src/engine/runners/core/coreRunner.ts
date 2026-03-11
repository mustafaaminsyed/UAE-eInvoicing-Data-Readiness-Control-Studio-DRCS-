import { CoreRunner } from '@/engine/contracts';
import { runAllChecks } from '@/lib/checks/checksRegistry';

export const defaultCoreRunner: CoreRunner = {
  run({ dataContext }) {
    return {
      checkResults: runAllChecks(dataContext),
    };
  },
};
