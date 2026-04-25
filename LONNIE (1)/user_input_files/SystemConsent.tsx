import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../useAuth";

const SystemConsent = () => {
  const [accepted, setAccepted] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleAccept = () => {
    if (accepted) {
      localStorage.setItem("lonnie_consent", "true");
      navigate("/");
    }
  };

  const handleDecline = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-xl w-full px-4">
        <h1 className="text-2xl font-display text-primary mb-6 text-center">System Consent</h1>

        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Terms of Service</h2>
          <div className="text-sm text-muted-foreground max-h-64 overflow-y-auto mb-4">
            <p className="mb-4">
              By using Lonnie AI System, you agree to the following terms:
            </p>
            <ul className="list-disc pl-4 space-y-2">
              <li>You are responsible for your use of the AI system</li>
              <li>Do not use the system for illegal purposes</li>
              <li>Respect intellectual property rights</li>
              <li>The system may collect usage data for improvement</li>
              <li>You maintain control over your personal data</li>
            </ul>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">I accept the terms and conditions</span>
          </label>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleAccept}
            disabled={!accepted}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
          >
            Accept & Continue
          </button>
          <button
            onClick={handleDecline}
            className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemConsent;
