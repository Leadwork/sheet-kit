function options_(input) {
  input = input || {};
  if (['dedupe', 'merge', 'case'].indexOf(input.tool) < 0) throw new Error('Choose a supported tool.');
  var o = {tool: input.tool, header: input.header === true};
  if (o.tool === 'dedupe') {
    o.action = input.action || 'deleteRows';
    if (['deleteRows', 'highlight'].indexOf(o.action) < 0) throw new Error('Choose a duplicate action.');
  }
  if (o.tool === 'merge') {
    o.destination = input.destination || 'replace';
    if (['replace', 'newColumns'].indexOf(o.destination) < 0) throw new Error('Choose an output destination.');
    if (['rows', 'columns', 'all'].indexOf(input.direction) < 0) throw new Error('Choose a merge direction.');
    o.direction = input.direction;
    o.separator = typeof input.separator === 'string' ? input.separator : ', ';
    if (o.separator.length > 100) throw new Error('Separator must be 100 characters or fewer.');
    o.skipEmpty = input.skipEmpty !== false;
  }
  if (o.tool === 'case') {
    if (['lower', 'title', 'sentence'].indexOf(input.mode) < 0) throw new Error('Choose a text case.');
    o.mode = input.mode;
  }
  return o;
}
function changeCase_(text, mode) {
  var lower = text.toLowerCase();
  if (mode === 'lower') return lower;
  if (mode === 'title') return lower.replace(/\p{L}[\p{L}\p{M}\p{N}'’]*/gu, function(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  return lower.replace(/(^|[.!?।]\s+)([^\p{L}]*)(\p{L})/gu, function(_, prefix, gap, letter) {
    return prefix + gap + letter.toUpperCase();
  });
}
function rowKey_(row) {
  return JSON.stringify(row.map(function(value) {
    if (value instanceof Date) return ['date', value.getTime()];
    return [typeof value, typeof value === 'string' ? value.toLowerCase() : value];
  }));
}
function plan_(values, formulas, display, o) {
  var writes = [], sample = [], count = 0, summary, duplicates = [];
  if (o.tool === 'dedupe') {
    var seen = Object.create(null);
    values.forEach(function(row, index) {
      var key = rowKey_(row);
      if (seen[key]) { count++; duplicates.push(index); }
      else seen[key] = true;
    });
    summary = o.action === 'highlight'
      ? 'Highlight ' + count + ' duplicate row(s) in yellow, within selected columns. Keep the first occurrence unchanged.'
      : 'Delete ' + count + ' entire sheet row(s), including cells outside the selection. Keep the first occurrence.';
    sample = duplicates.slice(0, 3).map(function(index) { return 'Data row ' + (index + 1) + ': ' + display[index].join(' | '); });
  } else if (o.tool === 'case') {
    values.forEach(function(row, r) {
      row.forEach(function(value, c) {
        if (typeof value !== 'string' || formulas[r][c]) return;
        var result = changeCase_(value, o.mode);
        if (result !== value) {
          writes.push({row: r, col: c, text: result});
          if (sample.length < 3) sample.push(value.slice(0, 120) + ' → ' + result.slice(0, 120));
        }
      });
    });
    count = writes.length;
    summary = 'Change ' + count + ' text cell(s). Formulas, numbers and dates stay unchanged.';
  } else {
    if ((o.direction === 'rows' && values[0].length < 2) ||
        (o.direction === 'columns' && values.length < 2) ||
        (o.direction === 'all' && values.length * values[0].length < 2)) {
      throw new Error('Select at least two cells along the merge direction.');
    }
    var groups = [];
    if (o.direction === 'rows') {
      display.forEach(function(row, r) { groups.push({row: r, col: 0, parts: row}); });
    } else if (o.direction === 'columns') {
      display[0].forEach(function(_, c) { groups.push({row: 0, col: c, parts: display.map(function(row) { return row[c]; })}); });
    } else {
      groups.push({row: 0, col: 0, parts: [].concat.apply([], display)});
    }
    if (groups.length > 500) throw new Error('Select a smaller range: at most 500 merged outputs per run.');
    groups.forEach(function(group) {
      var parts = o.skipEmpty ? group.parts.filter(function(v) { return v !== ''; }) : group.parts;
      var result = parts.join(o.separator);
      if (result.length > 50000) throw new Error('Merged text exceeds the 50,000-character cell limit. Select fewer cells.');
      writes.push({row: group.row, col: group.col, text: result});
      if (sample.length < 3) sample.push(result.slice(0, 240));
    });
    count = writes.length;
    summary = 'Create ' + count + ' merged value(s). ' + (o.destination === 'newColumns'
      ? 'Insert ' + (o.direction === 'columns' ? values[0].length : 1) + ' new column(s) immediately right of the selection. Keep source contents.'
      : 'Replace selected contents with displayed text; clear the remaining source cells.');
  }
  return {writes: writes, count: count, summary: summary, sample: sample, duplicates: duplicates};
}
