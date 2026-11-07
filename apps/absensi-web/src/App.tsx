import { useState } from 'react';

import { Badge, Button, EmptyState, Toast } from '@wfh-attendance/ui';

export default function App() {
  const [noticeVisible, setNoticeVisible] = useState(false);

  return (
    <main className="ui-page">
      <header className="ui-page-header">
        <div>
          <p className="ui-eyebrow">Absensi WFH</p>
          <h1>Employee attendance</h1>
          <p>Shared, accessible UI components are ready for the employee experience.</p>
        </div>
        <Badge tone="success">Foundation ready</Badge>
      </header>
      <section className="ui-card">
        <h2>Attendance</h2>
        <p>Your attendance activity will appear here.</p>
        <div className="ui-demo-actions">
          <Button onClick={() => setNoticeVisible(true)}>Preview notification</Button>
          <Badge>Ready for check-in flow</Badge>
        </div>
        <EmptyState
          title="No attendance yet"
          description="Check-in history will appear here once you start your workday."
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
