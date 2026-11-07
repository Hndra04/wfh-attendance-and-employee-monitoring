import { useState } from 'react';

import { Badge, Button, EmptyState, Toast } from '@wfh-attendance/ui';

export default function App() {
  const [noticeVisible, setNoticeVisible] = useState(false);

  return (
    <main className="ui-page">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Monitoring Karyawan</p>
          <h1>Employee monitoring</h1>
          <p>Shared, accessible UI components are ready for the HRD experience.</p>
        </div>
        <Badge tone="success">Foundation ready</Badge>
      </header>
      <section className="ui-card">
        <h2>Attendance overview</h2>
        <p>Employee and attendance information will appear here.</p>
        <div className="ui-demo-actions">
          <Button onClick={() => setNoticeVisible(true)}>Preview notification</Button>
          <Badge>Read-only attendance</Badge>
        </div>
        <EmptyState
          title="No records to show"
          description="Dashboard and attendance records will appear here."
        />
      </section>
      {noticeVisible && (
        <Toast
          message="Shared notification component is working."
          tone="success"
          onDismiss={() => setNoticeVisible(false)}
        />
      )}
    </main>
  );
}
