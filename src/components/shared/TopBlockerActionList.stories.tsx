import { TopBlockerActionList } from './TopBlockerActionList';

const meta = {
  title: 'Shared/TopBlockerActionList',
  component: TopBlockerActionList,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

const sampleBlockers = [
  {
    rank: 1,
    label: 'Seller TRN Pattern Valid',
    severity: 'critical' as const,
    count: 5845,
    ruleId: 'UAE-UC1-CHK-013',
  },
  {
    rank: 2,
    label: 'Invoice Number Present',
    severity: 'critical' as const,
    count: 5845,
    ruleId: 'UAE-UC1-CHK-001',
  },
  {
    rank: 3,
    label: 'Tax Breakdown Present',
    severity: 'high' as const,
    count: 5845,
    ruleId: 'UAE-UC1-CHK-027',
  },
];

export const Default = {
  render: () => (
    <div className="w-[760px] max-w-full">
      <TopBlockerActionList
        blockers={sampleBlockers}
        totalCriticalOutcomes={35070}
        onBlockerClick={(ruleId: string) => {
          console.log(`Selected blocker ${ruleId}`);
        }}
      />
    </div>
  ),
};
