import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox, Input, Select, TextArea } from './Field';

describe('<Input />', () => {
  it('associates the label with the input so getByLabelText works', () => {
    render(<Input label="Email" defaultValue="" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('forwards value changes via onChange', () => {
    const onChange = vi.fn();
    render(<Input label="Name" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Zayd' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders hint text when provided and no error', () => {
    render(<Input label="Field" hint="Helper copy" />);
    expect(screen.getByText('Helper copy')).toBeInTheDocument();
  });

  it('renders error as role="alert" and sets aria-invalid', () => {
    render(<Input label="Required" error="This field is required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
    expect(screen.getByLabelText('Required')).toHaveAttribute('aria-invalid', 'true');
  });

  it('error takes precedence over hint when both are passed', () => {
    render(<Input label="X" hint="Hint copy" error="Error copy" />);
    expect(screen.getByText('Error copy')).toBeInTheDocument();
    expect(screen.queryByText('Hint copy')).not.toBeInTheDocument();
  });
});

describe('<Select />', () => {
  it('associates the label with the select element', () => {
    render(
      <Select label="Category" defaultValue="animation">
        <option value="animation">Animation</option>
        <option value="workflow">Workflow</option>
      </Select>,
    );
    expect(screen.getByLabelText('Category')).toHaveValue('animation');
  });

  it('emits onChange when the value changes', () => {
    const onChange = vi.fn();
    render(
      <Select label="Pick" onChange={onChange}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );
    fireEvent.change(screen.getByLabelText('Pick'), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe('<TextArea />', () => {
  it('associates the label with the textarea element', () => {
    render(<TextArea label="Notes" defaultValue="hello" />);
    expect(screen.getByLabelText('Notes')).toHaveValue('hello');
  });

  it('emits onChange when typed into', () => {
    const onChange = vi.fn();
    render(<TextArea label="Body" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'typed' } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe('<Checkbox />', () => {
  it('renders a checkbox with the associated label', () => {
    render(<Checkbox label="Done" />);
    expect(screen.getByLabelText('Done')).toBeInTheDocument();
    expect(screen.getByLabelText('Done')).toHaveAttribute('type', 'checkbox');
  });

  it('toggles checked via onChange', () => {
    const onChange = vi.fn();
    render(<Checkbox label="Tick" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Tick'));
    expect(onChange).toHaveBeenCalled();
  });

  it('renders without a label when none is provided', () => {
    render(<Checkbox aria-label="standalone" />);
    expect(screen.getByLabelText('standalone')).toBeInTheDocument();
  });
});
