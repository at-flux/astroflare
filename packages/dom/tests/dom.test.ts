import { describe, it, expect, beforeEach } from 'vitest';
import {
  getElementById,
  getElementByIdOrThrow,
  getElementByQuery,
  getElementByQueryOrThrow,
} from '../src/index';

describe('dom package utilities', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('getElementById returns element when it exists and matches type', () => {
    const div = document.createElement('div');
    div.id = 'test-div';
    document.body.appendChild(div);

    const result = getElementById('test-div', HTMLDivElement);
    expect(result).toBe(div);
  });

  it('getElementById returns null when missing', () => {
    expect(getElementById('missing', HTMLDivElement)).toBeNull();
  });

  it('getElementByIdOrThrow throws on missing', () => {
    expect(() => getElementByIdOrThrow('missing', HTMLDivElement)).toThrow(
      'Element with id "missing" not found or not the expected type',
    );
  });

  it('getElementByQuery returns first match', () => {
    const span = document.createElement('span');
    span.className = 'target';
    document.body.appendChild(span);

    const result = getElementByQuery<HTMLSpanElement>('.target');
    expect(result).toBe(span);
  });

  it('getElementByQueryOrThrow throws when missing', () => {
    expect(() => getElementByQueryOrThrow('.nope')).toThrow(
      'Element not found with selector ".nope"',
    );
  });
});

