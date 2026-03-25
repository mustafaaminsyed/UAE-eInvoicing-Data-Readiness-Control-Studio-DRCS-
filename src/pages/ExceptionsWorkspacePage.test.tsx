import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ExceptionsWorkspacePage from '@/pages/ExceptionsWorkspacePage';

const { generateValidationExplanation } = vi.hoisted(() => ({
  generateValidationExplanation: vi.fn().mockResolvedValue({
    explanation: 'Heuristic explanation ready.',
    recommendedFix: 'Review source and mapping.',
  }),
}));

vi.mock('@/lib/api/validationExplainApi', () => ({
  generateValidationExplanation,
}));

vi.mock('@/components/explanations/ExplanationPackPanel', () => ({
  ExplanationPackPanel: ({ explanation, isLoading }: { explanation: { explanation?: string } | null; isLoading?: boolean }) => (
    <div>{isLoading ? 'Generating explanation pack...' : explanation?.explanation || 'No explanation'}</div>
  ),
}));

describe('ExceptionsWorkspacePage', () => {
  it('renders summary cards, filters by severity, updates the detail panel, and opens heuristics explanation', async () => {
    render(
      <MemoryRouter initialEntries={['/exceptions?invoice=INV-10411&field=buyer_trn']}>
        <Routes>
          <Route path="/exceptions" element={<ExceptionsWorkspacePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Total Exceptions')).toBeInTheDocument();
    expect(screen.getByText('Critical Exceptions')).toBeInTheDocument();
    expect(screen.getByText('Exception queue')).toBeInTheDocument();
    expect(screen.getByText('Exception ID')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Digital Twin context')).toBeInTheDocument();
    expect(screen.getByText('Invoice: INV-10411')).toBeInTheDocument();
    expect(screen.getByText('Field: buyer_trn')).toBeInTheDocument();

    expect(screen.getByText('Selected exception')).toBeInTheDocument();
    expect(screen.getAllByText('EXC-10411').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Buyer TRN format').length).toBeGreaterThan(0);
    expect(screen.getByText('Description of issue')).toBeInTheDocument();
    expect(screen.getByText('Recommended fix / action')).toBeInTheDocument();
    expect(screen.getByText('buyer_trn')).toBeInTheDocument();
    expect(screen.getByText('AI heuristics explanation')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByRole('option', { name: 'Critical' }));

    expect(screen.getAllByText('EXC-10428').length).toBeGreaterThan(0);
    expect(screen.queryByText('EXC-10411')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /explain issue/i }));

    expect(await screen.findByText('Heuristic explanation ready.')).toBeInTheDocument();
    expect(generateValidationExplanation).toHaveBeenCalled();
  });
});
