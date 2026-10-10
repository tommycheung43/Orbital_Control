const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';


export class SqlAgentService {
  /**
   * @param {string} baseUrl
   */
  constructor(baseUrl = DEFAULT_API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * @param {string} sqlCode 
   * @returns {Promise<string>} 
   */
  async explainSql(sqlCode) {
    const response = await fetch(`${this.baseUrl}/explain_sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql_code: sqlCode })
    });

    if (!response.ok) {
      throw new Error(`The AI ​​server responded with an error, status code: ${response.status}`);
    }

    const data = await response.json();
    return data.explanation;
  }
}