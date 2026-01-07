
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
} catch (error) {
    console.error("Critical Boot Error:", error);
    rootElement.innerHTML = `<div style="color:red; padding:20px;">
        <h1>Critical Boot Error</h1>
        <p>Check console for details.</p>
        <pre>${(error as any).message}</pre>
    </div>`;
}
