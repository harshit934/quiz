export function formatSqlResult(result, playground) {
  if (playground) {
    return result.length
      ? { type: 'table', columns: result[0].columns, rows: result[0].values }
      : { type: 'success', message: 'Query executed successfully.' }
  }
  return result.length
    ? result[0].values.map(row => Object.fromEntries(result[0].columns.map((key, index) => [key, row[index]])))
    : []
}

export function executeSql(db, code, playground) {
  const resultSets = []
  for (const statement of db.iterateStatements(code)) {
    try {
      const columns = statement.getColumnNames()
      const values = []
      while (statement.step()) values.push(statement.get())
      if (columns.length) resultSets.push({ columns, values })
    } finally {
      statement.free()
    }
  }
  if (resultSets.length > 1) throw new Error('Return one result set.')
  return formatSqlResult(resultSets, playground)
}
