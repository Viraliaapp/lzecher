import { toHebrewNumeral } from '../../src/lib/hebrew-numerals';
const tests: [number,string][] = [[1,'א׳'],[2,'ב׳'],[9,'ט׳'],[10,'י׳'],[11,'י״א'],[14,'י״ד'],[15,'ט״ו'],[16,'ט״ז'],[20,'כ׳'],[30,'ל׳'],[50,'נ׳'],[100,'ק׳'],[115,'קט״ו'],[150,'ק״נ'],[246,'רמ״ו'],[400,'ת׳']];
for (const [n,exp] of tests) {
  const got = toHebrewNumeral(n);
  console.log(n,'→',got,got===exp?'✓':'✗ expected '+exp);
}
