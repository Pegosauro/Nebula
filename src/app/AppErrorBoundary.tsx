import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Nebula UI error", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal-error">
        <TriangleAlert size={32} />
        <h1>Nebula non ha potuto mostrare l'interfaccia</h1>
        <p>I file del Vault non sono stati modificati. Ricarica l'app per riprovare.</p>
        <button className="button button-primary" type="button" onClick={() => window.location.reload()}>Ricarica Nebula</button>
      </main>
    );
  }
}
