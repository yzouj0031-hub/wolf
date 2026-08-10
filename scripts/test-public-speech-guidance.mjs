import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html', 'en/index.html']) {
  const source = fs.readFileSync(file, 'utf8');

  assert.doesNotMatch(source, /普通轮次可以简洁/, `${file}: ordinary public speech is still allowed to collapse into a short reply`);
  assert.doesNotMatch(source, /允许：简短发言、跟票/, `${file}: general style guide still rewards short follow-votes`);
  assert.doesNotMatch(source, /可以很短，可以不完整/, `${file}: structured output template still permits incomplete public speech`);
  assert.match(source, /公开发言完整度·最高优先级/, `${file}: free-output completeness rule missing`);
  assert.match(source, /公开讨论的表达底线/, `${file}: structured-output completeness rule missing`);
  assert.match(source, /const minSpeechChars = Math\.max\(30, Number\(opts\.minSpeechChars\) \|\| 80\)/, `${file}: public speech minimum missing`);
  assert.match(source, /系统重写·公开发言过短/, `${file}: short public speech is not automatically expanded`);
  assert.match(source, /重新写成120至300字的正式发言/, `${file}: expansion request lacks a useful target`);
  assert.match(source, /不得少于80字。投票前最后发言要把核心论据说透/, `${file}: second-round speech still has a weaker floor`);
  assert.match(source, /const isFreeOutput = baseFreeOutput && !opts\.wolfOnly && !opts\.skillConfirm/, `${file}: action confirmations may be polluted by public speech mode`);
}

console.log('Public speech completeness regression checks passed');
