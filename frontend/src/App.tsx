import "./App.css";

function App() {
  return (
    <div className="app">
      <main className="container">

        <header className="hero">

          <div className="hero-content">

            <span className="logo-badge">
              AI Workflow Intelligence
            </span>

            <h1>NAIGX</h1>

            <h2>Understand Any Workflow. Powered by AI.</h2>

            <p>
              Paste an automation workflow from n8n, Make.com, Zapier,
              or describe it in plain English. NAIGX will analyze its
              complexity, detect risks, and recommend improvements.
            </p>

          </div>

          <div className="status">

            <span className="dot"></span>

            Connected

          </div>

        </header>

        <section className="card">

          <h3>Workflow Description</h3>

          <p className="card-subtitle">

            Paste your automation workflow below.

          </p>

          <textarea
            placeholder={`Example:

Google Form
      ↓
Google Sheets
      ↓
OpenAI
      ↓
Slack Notification`}
          />

          <button>

            Analyze Workflow

          </button>

        </section>

        <section className="card">

          <h3>Analysis</h3>

          <div className="empty-state">

            <div className="robot">
              🤖
            </div>

            <h4>Ready to Analyze</h4>

            <p>

              Your AI workflow report will appear here.

            </p>

            <ul>

              <li>✔ Complexity Score</li>

              <li>✔ Risk Detection</li>

              <li>✔ Best Practices</li>

              <li>✔ Optimization Suggestions</li>

            </ul>

          </div>

        </section>

      </main>
    </div>
  );
}

export default App;