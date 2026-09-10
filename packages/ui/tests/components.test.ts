import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, Badge, Card, Header } from '../src/index';

describe('UI Design System Components (@chrishop/ui)', () => {
  it('should render Button with primary variant styles and children', () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { variant: 'primary', size: 'md' }, 'Buy Now')
    );
    assert.ok(html.includes('<button'), 'Should render a button element');
    assert.ok(html.includes('Buy Now'), 'Should contain child text');
    assert.ok(html.includes('bg-amber-600'), 'Should contain primary background class');
  });

  it('should render Button with custom variant and size', () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { variant: 'outline', size: 'sm', disabled: true }, 'Disabled')
    );
    assert.ok(html.includes('border-slate-600'), 'Should contain outline border class');
    assert.ok(html.includes('text-sm'), 'Should contain sm size class');
    assert.ok(
      html.includes('disabled=""') || html.includes('disabled'),
      'Should have disabled attribute'
    );
  });

  it('should render Badge with default and custom variants', () => {
    const defaultBadge = renderToStaticMarkup(React.createElement(Badge, null, 'Limited Edition'));
    assert.ok(defaultBadge.includes('Limited Edition'));

    const successBadge = renderToStaticMarkup(
      React.createElement(Badge, { variant: 'success' }, 'In Stock')
    );
    assert.ok(successBadge.includes('In Stock'));
    assert.ok(
      successBadge.includes('bg-emerald') ||
        successBadge.includes('green') ||
        successBadge.includes('emerald')
    );
  });

  it('should render Card container with children and custom className', () => {
    const cardHtml = renderToStaticMarkup(
      React.createElement(
        Card,
        { className: 'custom-card-class' },
        React.createElement('span', null, 'Card Body')
      )
    );
    assert.ok(cardHtml.includes('custom-card-class'));
    assert.ok(cardHtml.includes('Card Body'));
  });

  it('should render Header component with logo and navigation items', () => {
    const headerHtml = renderToStaticMarkup(React.createElement(Header, null));
    assert.ok(
      headerHtml.includes('<header') || headerHtml.includes('<nav'),
      'Should render header/nav container'
    );
  });
});
