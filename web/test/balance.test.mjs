import assert from 'node:assert/strict';
import { test } from 'node:test';

import { moneyText, splitBalance } from '../src/lib/balance.js';

test('a balance after a name is taken off the name', () => {
  assert.deepEqual(splitBalance('Lovelace Family $120.00'), { name: 'Lovelace Family', due: '$120.00' });
  assert.deepEqual(splitBalance('Hopper Family - $45.50'), { name: 'Hopper Family', due: '$45.50' });
  assert.deepEqual(splitBalance('Rivera Family ($20.00)'), { name: 'Rivera Family', due: '$20.00' });
  assert.deepEqual(splitBalance('Lovelace Family Balance: $1,204.00'), { name: 'Lovelace Family', due: '$1,204.00' });
  assert.deepEqual(splitBalance('Lovelace, Ada Due 60.00'), { name: 'Lovelace, Ada', due: '$60.00' });
  assert.deepEqual(splitBalance('Rivera Family\u00a0\u00b7\u00a0$0.00'), { name: 'Rivera Family', due: '$0.00' });
});

test('a credit keeps its minus', () => {
  assert.deepEqual(splitBalance('Hopper Family -$35.00'), { name: 'Hopper Family', due: '-$35.00' });
});

test('a label without a balance is untouched', () => {
  for (const label of [
    'Lovelace Family',
    '100 Ballet 1',
    'Jazz I - Tue 5:30p',
    'Ballet 100 12.50',
    'Lovelace, Ada'
  ]) {
    assert.deepEqual(splitBalance(label), { name: label, due: '' }, label);
  }
});

test('an amount with no name in front of it stays in the label', () => {
  assert.deepEqual(splitBalance('$120.00'), { name: '$120.00', due: '' });
});

test('empty labels are empty', () => {
  assert.deepEqual(splitBalance(''), { name: '', due: '' });
  assert.deepEqual(splitBalance(null), { name: '', due: '' });
});

test('money is shown with its dollar sign', () => {
  assert.equal(moneyText('$120.00'), '$120.00');
  assert.equal(moneyText('120.50'), '$120.50');
  assert.equal(moneyText('($20.00)'), '$20.00');
  assert.equal(moneyText('-$5.00'), '-$5.00');
  assert.equal(moneyText('5.00-'), '-$5.00'.replace('-', '') + '');
  assert.equal(moneyText(''), '');
});
