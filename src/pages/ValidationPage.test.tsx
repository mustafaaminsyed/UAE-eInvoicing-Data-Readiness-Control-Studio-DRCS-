import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ValidationPage from '@/pages/ValidationPage';

describe('ValidationPage', () => {
  it('renders the validation workspace and updates the detail panel for the selected rule', () => {
    render(
      <MemoryRouter initialEntries={['/validation']}>
        <Routes>
          <Route path="/validation" element={<ValidationPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Total Rules Evaluated')).toBeInTheDocument();
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
    expect(screen.getByText('Failed Rules')).toBeInTheDocument();
    expect(screen.getByText('Critical Failures')).toBeInTheDocument();
    expect(screen.getByText('Validation rules')).toBeInTheDocument();
    expect(screen.getByText('Rule explorer')).toBeInTheDocument();
    expect(screen.getByText('Rule ID')).toBeInTheDocument();
    expect(screen.getByText('Affected records')).toBeInTheDocument();

    const buyerTrnRule = screen.getByText('Buyer TRN format');
    fireEvent.click(buyerTrnRule);

    expect(screen.getByText('Selected rule')).toBeInTheDocument();
    expect(screen.getAllByText('Buyer TRN format').length).toBeGreaterThan(1);
    expect(screen.getByText('Why it matters')).toBeInTheDocument();
    expect(screen.getByText('Recommended next action')).toBeInTheDocument();
    expect(screen.getByText('buyer_trn')).toBeInTheDocument();
  });
});
