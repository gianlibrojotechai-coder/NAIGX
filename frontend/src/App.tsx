import { useEffect, useState } from "react";
import "./App.css";

type HealthResponse = {
  status: string;
  app: string;
  version: string;
};

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch("http://localhost:3000/health");

        if (!response.ok) {
          throw new Error("Failed to connect to backend.");
        }

        const data = await response.json();
        setHealth(data);
      } catch (err) {
        setError("Unable to connect to the backend.");
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, []);

  if (loading) {
    return <h1>Connecting to backend...</h1>;
  }

  if (error) {
    return <h1>{error}</h1>;
  }

  return (
    <div
      style={{
        fontFamily: "Arial",
        padding: "40px",
        textAlign: "center",
      }}
    >
      <h1>NAIGX</h1>

      <h2 style={{ color: "green" }}>🟢 Backend Connected</h2>

      <p>
        <strong>Status:</strong> {health?.status}
      </p>

      <p>
        <strong>Application:</strong> {health?.app}
      </p>

      <p>
        <strong>Version:</strong> {health?.version}
      </p>
    </div>
  );
}

export default App;