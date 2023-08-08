import React, { useState, useEffect } from "react";

function BlockHeight() {
  const [height, setHeight] = useState(null);

  const fetchHeight = async () => {
    try {
      const response = await fetch("https://arweave.net/");
      const data = await response.json();
      setHeight(data.height);
    } catch (error) {
      console.error("Error fetching height:", error);
    }
  };

  useEffect(() => {
    fetchHeight();
  }, []); // Empty dependency array ensures this effect runs once on mount

  return (
    <div className="App">
      <p>Height: {height !== null ? height : "Loading..."}</p>
      <button onClick={fetchHeight}>Refresh</button>
    </div>
  );
}

export default BlockHeight;
