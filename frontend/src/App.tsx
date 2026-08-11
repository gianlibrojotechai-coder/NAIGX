import "./App.css";

function App() {
  return (
    <div className="app">
      <div className="container">

        <header className="header card">
          <div>
            <h1>NAIGX</h1>
            <h2>AI Workflow Analyzer</h2>
            <p>
              Analyze automation workflows using AI to identify complexity,
              risks, and optimization opportunities.
            </p>
          </div>

          <span className="status">
            🟢 Backend Connected
          </span>
        </header>

        <section className="card">

          <h3>Workflow Description</h3>

          <p className="section-description">
            Paste your workflow, automation, or process description below.
          </p>

          <textarea
            placeholder="Example:

Google Forms
↓
Google Sheets
↓
Gmail

or describe your workflow in plain English..."
          />

          <button>
            🔍 Analyze Workflow
          </button>

        </section>

        <section className="card">

          <h3>Analysis</h3>

          <div className="empty-state">

            <div className="empty-icon">
              🤖
            </div>

            <h4>Waiting for analysis</h4>

            <p>
              Paste an automation workflow above and click
              <strong> Analyze Workflow </strong>
              to begin.
            </p>

          </div>

        </section>

      </div>
    </div>
  );
}

export default App;