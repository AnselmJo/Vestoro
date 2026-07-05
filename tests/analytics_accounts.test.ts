import { donutDataFromAccounts, donutDataFromPeople } from '../src/lib/analytics';

test('donutDataFromAccounts aggregates by account name', () => {
  const accounts = [ { id: 'a1', name: 'Checking' }, { id: 'a2', name: 'Savings' } ];
  const txs = [
    { accountId: 'a1', amountCents: 1000 },
    { accountId: 'a1', amountCents: -500 },
    { accountId: 'a2', amountCents: 2000 },
  ];
  const data = donutDataFromAccounts(txs as any, accounts);
  expect(data.find(d => d.name === 'Checking')!.value).toBeCloseTo((1000+500)/100, 2);
  expect(data.find(d => d.name === 'Savings')!.value).toBeCloseTo(2000/100, 2);
});

test('donutDataFromPeople aggregates by person via accounts', () => {
  const persons = [ { id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' } ];
  const accounts = [ { id: 'a1', personId: 'p1' }, { id: 'a2', personId: 'p2' } ];
  const txs = [ { accountId: 'a1', amountCents: 1500 }, { accountId: 'a2', amountCents: -700 } ];
  const data = donutDataFromPeople(txs as any, persons as any, accounts as any);
  expect(data.find(d => d.name === 'Alice')!.value).toBeCloseTo(1500/100, 2);
  expect(data.find(d => d.name === 'Bob')!.value).toBeCloseTo(700/100, 2);
});
