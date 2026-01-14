import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Urbanist:wght@400;600;700&display=swap');

  :root {
    --bg: #0b1020;
    --bg-2: #0f1730;
    --panel: rgba(16, 26, 45, 0.86);
    --panel-strong: #111c33;
    --border: rgba(125, 188, 225, 0.18);
    --text: #e9f3ff;
    --muted: #9ab0c8;
    --aqua: #08f1ff;
    --aqua-soft: rgba(8, 241, 255, 0.16);
    --aqua-strong: #2df7ff;
    --pink: #ff73df;
    --violet: #5b6bff;
    --success: #16e0a0;
    --warn: #ffcf6a;
    --shadow: 0 22px 60px rgba(6, 15, 30, 0.55);
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    min-height: 100vh;
    font-family: 'Manrope', system-ui, sans-serif;
    color: var(--text);
    background:
      radial-gradient(1200px 600px at 10% -10%, rgba(8, 241, 255, 0.18), transparent 60%),
      radial-gradient(900px 500px at 110% 10%, rgba(91, 107, 255, 0.22), transparent 55%),
      radial-gradient(800px 500px at 50% 110%, rgba(255, 115, 223, 0.16), transparent 65%),
      linear-gradient(180deg, #090e1b 0%, #0a1123 45%, #0b1328 100%);
  }

  a {
    color: inherit;
    text-decoration: none;
  }
`;
