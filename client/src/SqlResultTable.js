import { createElement as h } from 'react'

function formatCell(value) {
  if (value === null || value === undefined) return 'NULL'
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : JSON.stringify(value)
}

export default function SqlResultTable({ columns, rows }) {
  return h('div', { className: 'playground-sql-table-scroll' },
    h('table', { className: 'playground-sql-table' },
      h('thead', null,
        h('tr', null, columns.map((column, index) => h('th', { key: `${column}-${index}`, scope: 'col' }, column)))),
      h('tbody', null, rows.length
        ? rows.map((row, rowIndex) => h('tr', { key: rowIndex },
          row.map((value, columnIndex) => h('td', { key: columnIndex }, formatCell(value)))))
        : h('tr', null, h('td', { className: 'playground-sql-empty', colSpan: Math.max(columns.length, 1) }, 'No rows returned.')))))
}
