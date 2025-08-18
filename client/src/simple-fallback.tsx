// Ultra-simple fallback that definitely works
export function renderSimpleFallback(rootElement: HTMLElement) {
  rootElement.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
      color: white;
      font-family: Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
    ">
      <div style="text-align: center;">
        <h1 style="
          font-size: 4rem;
          margin-bottom: 2rem;
          color: #ff0066;
          text-shadow: 0 0 20px #ff0066;
        ">
          KILT Portal
        </h1>
        <p style="
          font-size: 1.5rem;
          color: #888;
          margin-bottom: 2rem;
        ">
          Application is loading...
        </p>
        <div style="
          width: 60px;
          height: 60px;
          border: 6px solid #333;
          border-top: 6px solid #ff0066;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        "></div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </div>
    </div>
  `;
  console.log('🎯 Simple fallback rendered');
}