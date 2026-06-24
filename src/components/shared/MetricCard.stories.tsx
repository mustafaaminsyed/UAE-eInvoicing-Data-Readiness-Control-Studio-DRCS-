import { AlertTriangle } from 'lucide-react';
import { MetricCard } from './MetricCard';

const meta = {
  title: 'Shared/MetricCard',
  component: MetricCard,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

export const ScopeAbsentComparison = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="w-[320px]">
        <MetricCard
          title="Credit-Note Readiness"
          value="42%"
          subtitle="Triggered credit-note requirements in current scope"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant="warning"
          helpText="Represents credit-note scenario completeness when 381 documents are present."
        />
      </div>
      <div className="w-[320px]">
        <MetricCard
          title="Credit-Note Readiness"
          value="42%"
          subtitle="Triggered credit-note requirements in current scope"
          icon={<AlertTriangle className="w-5 h-5" />}
          variant="warning"
          scopeAbsent
          scopeAbsentTooltip="No credit-note documents are present in the current portfolio, so this metric cannot be meaningfully calculated."
          helpText="Represents credit-note scenario completeness when 381 documents are present."
        />
      </div>
    </div>
  ),
};
