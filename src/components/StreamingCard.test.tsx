import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StreamingCard } from './StreamingCard';

describe('StreamingCard', () => {
  it('스트리밍 중인 코드를 표시한다', () => {
    render(<StreamingCard code="const A = () => null;" prompt="버튼" />);
    expect(
      screen.getByText('const A = () => null;')
    ).toBeInTheDocument();
  });

  it('코드가 비어있으면 생성 중 안내를 표시한다', () => {
    render(<StreamingCard code="" prompt="버튼" />);
    expect(screen.getByText(/생성하고 있습니다/)).toBeInTheDocument();
  });

  it('생성 중인 프롬프트를 표시한다', () => {
    render(<StreamingCard code="" prompt="빨간 버튼" />);
    expect(screen.getByText('빨간 버튼')).toBeInTheDocument();
  });
});
