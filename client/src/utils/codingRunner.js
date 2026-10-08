export function runCodingCases(code, testCases, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    // A disposable worker isolates synchronous code from the UI and is terminated
    // after each run. Its own result port is captured before user code executes.
    const source = `
      const send = self.postMessage.bind(self);
      const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
      self.onmessage = async ({data}) => {
        try {
          const solve = new Function(data.code + '\\n; return typeof solve === "function" ? solve : null;')();
          if (!solve) throw new Error('Define a function named solve(input).');
          const results = [];
          for (const test of data.testCases) {
            try {
              const actual = await solve(structuredClone(test.input));
              const passed = JSON.stringify(canonical(actual)) === JSON.stringify(canonical(test.expected));
              results.push({name: test.name, passed, actual: actual === undefined ? 'undefined' : actual});
            } catch (error) { results.push({name: test.name, passed: false, error: error.message}); }
          }
          send({results});
        } catch (error) { send({error: error.message}); }
      };`
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    let worker
    let timer
    const cleanup = () => { clearTimeout(timer); worker?.terminate(); URL.revokeObjectURL(url) }
    try {
      worker = new Worker(url)
      timer = setTimeout(() => { cleanup(); reject(new Error('Execution timed out after 3 seconds. Check for an infinite loop.')) }, timeoutMs)
      worker.onmessage = ({ data }) => { cleanup(); data.error ? reject(new Error(data.error)) : resolve(data.results) }
      worker.onerror = () => { cleanup(); reject(new Error('Code could not run. Check your syntax.')) }
      worker.postMessage({ code, testCases })
    } catch (error) { cleanup(); reject(error) }
  })
}
