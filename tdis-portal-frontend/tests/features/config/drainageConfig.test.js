import { describe, expect, it } from 'vitest';
import {
  DRAINAGE_CLASSES,
  DRAINAGE_ICONS,
  OTHER_CLASS,
  classColorExpression,
  classIconExpression,
  getDrainageClass,
  groupFilter,
  groupIdFor,
} from '@/config/drainageConfig';
import { drainageIconSvg, drainageIconUrl } from '@/config/drainageIcons';

describe('drainageConfig', () => {
  it('returns known classes with their pin', () => {
    expect(getDrainageClass('tire')).toMatchObject({
      label: 'Tires',
      color: '#444441',
      icon: 'drainage-tires',
    });
  });

  it('gives new model classes a readable label and the "other debris" pin', () => {
    expect(getDrainageClass('trash_pile')).toMatchObject({
      id: 'trash_pile',
      label: 'Trash Pile',
      icon: OTHER_CLASS.icon,
    });
  });

  it('colours and picks pins by category with fallbacks', () => {
    expect(classColorExpression.at(-1)).toBe(OTHER_CLASS.color);
    expect(classIconExpression.at(-1)).toBe(OTHER_CLASS.icon);
    expect(classIconExpression).toContain('drainage-vegetation');
  });

  it('groups unknown categories under "other" and filters by enabled groups', () => {
    expect(groupIdFor('tire')).toBe('tire');
    expect(groupIdFor('trash_pile')).toBe(OTHER_CLASS.id);
    expect(groupFilter(['tire'])).toEqual(['in', ['get', 'category'], ['literal', ['tire']]]);
    expect(groupFilter(['tire', OTHER_CLASS.id])[0]).toBe('any');
  });

  it('has one map image per class plus "other"', () => {
    expect(DRAINAGE_ICONS).toHaveLength(DRAINAGE_CLASSES.length + 1);
    expect(new Set(DRAINAGE_ICONS.map((i) => i.id)).size).toBe(DRAINAGE_ICONS.length);
    DRAINAGE_ICONS.forEach((i) => expect(i.url).toMatch(/^data:image\/svg\+xml/));
  });
});

describe('drainageIcons', () => {
  it('draws the pin in the class colour', () => {
    const svg = drainageIconSvg('erosion', '#A0522D');
    expect(svg).toContain('viewBox="0 0 64 80"');
    expect(svg).toContain('fill="#A0522D"');
    expect(svg).toContain('#38BDF8'); // the water lines of the erosion glyph
  });

  it('parses as SVG', () => {
    const doc = new DOMParser().parseFromString(
      drainageIconSvg('treelog', '#712B13'),
      'image/svg+xml'
    );
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.nodeName).toBe('svg');
  });

  it('falls back to the debris glyph for an unknown name', () => {
    expect(drainageIconUrl('nope', '#000')).toBe(drainageIconUrl('other-debris', '#000'));
  });
});
