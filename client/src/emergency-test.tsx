// Emergency test - minimal React component that should definitely work
import { createRoot } from 'react-dom/client';

function EmergencyTest() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '4rem', marginBottom: '2rem', color: '#ff0066' }}>
          KILT Portal
        </h1>
        <p style={{ fontSize: '1.5rem', color: '#888' }}>
          Emergency Test - React is Working!
        </p>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid #333',
          borderTop: '5px solid #ff0066',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '2rem auto'
        }}></div>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Emergency mount function
export function mountEmergencyTest() {
  let rootElement = document.getElementById('root');
  
  if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.appendChild(rootElement);
  }
  
  rootElement.style.cssText = 'width: 100%; height: 100vh; position: fixed; top: 0; left: 0;';
  
  const root = createRoot(rootElement);
  root.render(<EmergencyTest />);
  
  console.log('🚨 Emergency test mounted');
}

// Auto-mount after 3 seconds if nothing appears
setTimeout(() => {
  const rootElement = document.getElementById('root');
  if (!rootElement || rootElement.children.length === 0) {
    console.log('🚨 No content detected, mounting emergency test...');
    mountEmergencyTest();
  }
}, 3000);