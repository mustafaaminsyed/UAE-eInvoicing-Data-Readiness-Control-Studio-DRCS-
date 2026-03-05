import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ExplanationPackPanel } from '@/components/explanations/ExplanationPackPanel';
import { ValidationExplanation } from '@/types/validationExplain';

describe('ExplanationPackPanel', () => {
  it('renders fallback explanation safely when explanation_pack is absent', () => {
    const explanation: ValidationExplanation = {
      explanation: 'Validation failed because field is empty.',
      recommendedFix: 'Populate the missing value and rerun checks.',
    };

    render(
      <MemoryRouter>
        <ExplanationPackPanel
          explanation={explanation}
          exception={null}
          isLoading={false}
          errorMessage={null}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Validation Explanation')).toBeInTheDocument();
    expect(screen.getByText('Validation failed because field is empty.')).toBeInTheDocument();
    expect(screen.getByText(/Populate the missing value and rerun checks/i)).toBeInTheDocument();
  });
});

