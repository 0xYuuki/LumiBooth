
const PrintLogs = () => {
  return (
    <div>
      <h1 className="page-title">Print Logs</h1>
      <div className="card">
        <h2 className="card-header">Recent Prints</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #eee', color: 'var(--text-muted)' }}>
              <th style={{ padding: '1rem 0' }}>ID</th>
              <th style={{ padding: '1rem 0' }}>Template</th>
              <th style={{ padding: '1rem 0' }}>Time</th>
              <th style={{ padding: '1rem 0' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f9f9f9' }}>
              <td style={{ padding: '1rem 0', fontWeight: 'bold' }}>#1042</td>
              <td style={{ padding: '1rem 0' }}>4-Grid Classic</td>
              <td style={{ padding: '1rem 0' }}>2 mins ago</td>
              <td style={{ padding: '1rem 0', color: 'green', fontWeight: '600' }}>Completed</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f9f9f9' }}>
              <td style={{ padding: '1rem 0', fontWeight: 'bold' }}>#1041</td>
              <td style={{ padding: '1rem 0' }}>2-Photo Strip</td>
              <td style={{ padding: '1rem 0' }}>15 mins ago</td>
              <td style={{ padding: '1rem 0', color: 'green', fontWeight: '600' }}>Completed</td>
            </tr>
            <tr>
              <td style={{ padding: '1rem 0', fontWeight: 'bold' }}>#1040</td>
              <td style={{ padding: '1rem 0' }}>6-Grid Wide</td>
              <td style={{ padding: '1rem 0' }}>1 hour ago</td>
              <td style={{ padding: '1rem 0', color: 'red', fontWeight: '600' }}>Failed (Paper Jam)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PrintLogs;
