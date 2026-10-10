export class QueryRunner {
  constructor() { this.cancel = null; }
  run(sql, snapshot, level = 1) {
    this.cancel?.();
    return new Promise(resolve => {
      const worker = new Worker(new URL('./query.worker.js', import.meta.url), { type: 'module' });
      const finish = result => {
        clearTimeout(timer); worker.terminate(); this.cancel = null; resolve(result);
      };
      const timer = setTimeout(() => finish({ success: false, error: 'Query exceeded 5 seconds. Narrow the query and try again.' }), 5000);
      this.cancel = () => finish({ success: false, error: 'Query cancelled.' });
      worker.onmessage = event => finish(event.data);
      worker.onerror = () => finish({ success: false, error: 'Investigation worker failed. Try again or reload the station.' });
      worker.postMessage({ sql, snapshot, level }, [snapshot.buffer]);
    });
  }
  close() { this.cancel?.(); }
}
