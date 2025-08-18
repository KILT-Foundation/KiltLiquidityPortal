// Force display - bypasses all React and complex systems
console.log('🔥 FORCE DISPLAY INITIALIZING');

// Wait for DOM to be ready
const forceDisplay = () => {
  console.log('🔥 Force display starting...');
  
  // Clear everything first
  document.body.innerHTML = '';
  document.body.style.cssText = `
    margin: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
    font-family: Arial, sans-serif;
    overflow: hidden;
  `;
  
  // Create content directly
  const content = document.createElement('div');
  content.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 999999;
  `;
  
  content.innerHTML = `
    <div style="text-align: center;">
      <h1 style="
        font-size: 5rem;
        margin-bottom: 2rem;
        color: #ff0066;
        text-shadow: 0 0 30px #ff0066;
        font-weight: bold;
      ">
        KILT PORTAL
      </h1>
      <p style="
        font-size: 2rem;
        color: #888;
        margin-bottom: 3rem;
      ">
        DeFi Liquidity Platform
      </p>
      <div style="
        width: 80px;
        height: 80px;
        border: 8px solid #333;
        border-top: 8px solid #ff0066;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 3rem;
      "></div>
      <button onclick="window.location.reload()" style="
        padding: 1rem 2rem;
        background: #ff0066;
        color: white;
        border: none;
        border-radius: 1rem;
        cursor: pointer;
        font-size: 1.2rem;
        font-weight: bold;
        box-shadow: 0 4px 20px rgba(255, 0, 102, 0.3);
      ">
        Reload Application
      </button>
    </div>
  `;
  
  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  // Append to body
  document.body.appendChild(content);
  
  console.log('🔥 Force display rendered successfully');
};

// Execute immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', forceDisplay);
} else {
  forceDisplay();
}

// Also execute after a short delay as backup
setTimeout(forceDisplay, 500);
setTimeout(forceDisplay, 1000);
setTimeout(forceDisplay, 2000);