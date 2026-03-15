import React from 'react';
import SystemMonitor from '../../components/SystemMonitor';

function SystemStatus() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">システム状態</h1>
      <SystemMonitor />
    </div>
  );
}

export default SystemStatus;
