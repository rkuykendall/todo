import { render, screen, fireEvent } from '@testing-library/react';
import { FrequencySelector } from '../FrequencySelector';

describe('FrequencySelector', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders predefined frequency options', () => {
    render(<FrequencySelector />);

    expect(screen.getByLabelText('Daily')).toBeInTheDocument();
    expect(screen.getByLabelText('Weekly')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly')).toBeInTheDocument();
    expect(screen.getByLabelText('Annual')).toBeInTheDocument();
    expect(screen.getByLabelText('Custom')).toBeInTheDocument();
  });

  it('selects daily frequency by default when no value provided', () => {
    render(<FrequencySelector />);
    expect(screen.getByLabelText('Daily')).toBeChecked();
  });

  it('shows custom input when custom frequency is selected', () => {
    render(<FrequencySelector value={15} onChange={mockOnChange} />);

    // Custom input should be visible with value 15
    const customInput = screen.getByRole('spinbutton');
    expect(customInput).toBeInTheDocument();
    expect(customInput).toHaveValue(15);
  });

  it('handles custom frequency input changes', () => {
    render(<FrequencySelector onChange={mockOnChange} />);

    // Select custom option
    fireEvent.click(screen.getByLabelText('Custom'));

    // Enter custom value
    const customInput = screen.getByRole('spinbutton');
    fireEvent.change(customInput, { target: { value: '25' } });

    expect(mockOnChange).toHaveBeenCalledWith(25);
  });

  it('switches between predefined and custom frequencies', () => {
    render(<FrequencySelector onChange={mockOnChange} />);

    // Switch to weekly
    fireEvent.click(screen.getByLabelText('Weekly'));
    expect(mockOnChange).toHaveBeenCalledWith(7);

    // Switch to custom
    fireEvent.click(screen.getByLabelText('Custom'));
    const customInput = screen.getByRole('spinbutton');
    expect(customInput).toBeInTheDocument();

    // Enter custom value
    fireEvent.change(customInput, { target: { value: '10' } });
    expect(mockOnChange).toHaveBeenCalledWith(10);
  });

  it('maintains selected value when switching back from custom', () => {
    render(<FrequencySelector value={7} onChange={mockOnChange} />);

    // Switch to custom
    fireEvent.click(screen.getByLabelText('Custom'));

    // Switch back to weekly
    fireEvent.click(screen.getByLabelText('Weekly'));
    expect(mockOnChange).toHaveBeenLastCalledWith(7);
  });
});
