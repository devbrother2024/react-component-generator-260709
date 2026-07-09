import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { LivePreview } from './LivePreview';

const CODE = 'const Demo = () => <div>hi</div>;\nrender(<Demo />);';

describe('LivePreview 뷰포트 토글', () => {
  it('기본값은 데스크탑이 활성이다', () => {
    render(<LivePreview code={CODE} />);
    expect(screen.getByRole('button', { name: '데스크탑' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: '모바일' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('모바일을 누르면 활성 전환되고 프레임 폭이 375px로 제한된다', async () => {
    const user = userEvent.setup();
    const { container } = render(<LivePreview code={CODE} />);

    await user.click(screen.getByRole('button', { name: '모바일' }));

    expect(screen.getByRole('button', { name: '모바일' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const frame = container.querySelector('.preview-frame') as HTMLElement;
    expect(frame.style.maxWidth).toBe('375px');
  });
});
