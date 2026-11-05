import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode }
interface State { failed: boolean }

export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Nebula editor error", error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="editor-fatal" role="alert">
          <AlertTriangle size={26} />
          <h1>Editor non disponibile</h1>
          <p>Il buffer del documento è rimasto separato dal componente. Riapri la scheda o ricarica Nebula per riprovare.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
