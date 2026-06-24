import { ReadinessMethodologyTooltip } from './ReadinessMethodologyTooltip';

const meta = {
  title: 'Shared/ReadinessMethodologyTooltip',
  component: ReadinessMethodologyTooltip,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

const sampleDimensions = [
  { label: 'Mandatory data', weight: 0.35, score: 78 },
  { label: 'Conditional data', weight: 0.15, score: 62 },
  { label: 'Rule conformance', weight: 0.3, score: 84 },
  { label: 'Critical blockers', weight: 0.2, score: 40 },
];

export const GoLive = {
  render: () => (
    <ReadinessMethodologyTooltip type="go-live" dimensions={sampleDimensions}>
      <button type="button" className="rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-semibold">
        39%
      </button>
    </ReadinessMethodologyTooltip>
  ),
};

export const Compliance = {
  render: () => (
    <ReadinessMethodologyTooltip type="compliance" dimensions={sampleDimensions}>
      <button type="button" className="rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-semibold">
        59%
      </button>
    </ReadinessMethodologyTooltip>
  ),
};
