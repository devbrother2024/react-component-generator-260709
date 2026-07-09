import { describe, it, expect, beforeEach } from 'vitest';
import { loadComponents, saveComponents } from './componentStorage';
import type { GeneratedComponent } from '../types';

function makeComponent(overrides: Partial<GeneratedComponent> = {}): GeneratedComponent {
  return {
    id: 'id-1',
    prompt: 'a button',
    code: 'render(<button>Hi</button>)',
    createdAt: new Date('2026-07-09T12:34:00.000Z'),
    ...overrides,
  };
}

describe('componentStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveComponents 후 loadComponents가 같은 항목을 반환한다', () => {
    const components = [makeComponent()];
    saveComponents(components);

    const loaded = loadComponents();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('id-1');
    expect(loaded[0].prompt).toBe('a button');
    expect(loaded[0].code).toBe('render(<button>Hi</button>)');
  });

  it('복원된 항목의 createdAt이 Date 인스턴스이고 toLocaleTimeString이 동작한다', () => {
    saveComponents([makeComponent()]);

    const loaded = loadComponents();

    expect(loaded[0].createdAt).toBeInstanceOf(Date);
    expect(() => loaded[0].createdAt.toLocaleTimeString('ko-KR')).not.toThrow();
  });

  it('저장소가 비어 있으면 빈 배열을 반환한다', () => {
    expect(loadComponents()).toEqual([]);
  });

  it('손상된 JSON이 들어 있으면 throw하지 않고 빈 배열을 반환한다', () => {
    localStorage.setItem('rcg:components', '{ not valid json');

    expect(() => loadComponents()).not.toThrow();
    expect(loadComponents()).toEqual([]);
  });

  it('20개를 초과해 저장하면 최근 20개만 유지된다', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      makeComponent({ id: `id-${i}` })
    );
    saveComponents(many);

    const loaded = loadComponents();

    expect(loaded).toHaveLength(20);
    expect(loaded[0].id).toBe('id-0');
    expect(loaded[19].id).toBe('id-19');
  });
});
