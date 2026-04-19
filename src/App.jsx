import React, { useState } from "react";
import OceanGuardDashboard from "./components/OceanGuardDashboard.jsx";
import LandingPage from "./components/LandingPage.jsx";

export default function App() {
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <>
      {!showDashboard ? (
        <LandingPage onLaunch={() => setShowDashboard(true)} />
      ) : (
        <OceanGuardDashboard />
      )}
    </>
  );
}
