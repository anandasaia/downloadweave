import React, { useState, useEffect } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import "prismjs/themes/prism-okaidia.css"; // Dark theme
import "./App.css";
import Code from "./Code";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import FormGroup from "@mui/material/FormGroup";
import { FormControlLabel } from "@mui/material";
import Checkbox from "@mui/material/Checkbox";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import RefreshIcon from "@mui/icons-material/Refresh";
function App() {
  const [startBlockHeight, setStartBlockHeight] = useState("");
  const [endBlockHeight, setEndBlockHeight] = useState("");
  const [useProxy, setUseProxy] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  ///testing
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

  const generateScript = () => {
    const proxyCode = useProxy
      ? "proxy_list = [\n  # Add proxies here if needed\n]"
      : "proxy_list = []";

    const code = `
import os
import json
import requests
import concurrent.futures
import time
import logging
import threading
import sys

start_block_height = ${startBlockHeight}
end_block_height = ${endBlockHeight}

${proxyCode}

def configure_logger(file_path):
    """Configures the logger to log messages to both file and console."""
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    # Create file handler
    file_handler = logging.FileHandler(file_path)
    file_handler.setLevel(logging.INFO)

    # Create console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    # Create formatter and attach it to handlers
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    # Add handlers to the logger
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

def save_block_data(proxy_url, arweave_url, block_heights, save_directory, stop_event):
    """Downloads and saves block data for the given heights."""
    try:
        proxies = {'http': proxy_url} if proxy_url else None
        
        for block_height in block_heights:
            if stop_event.is_set():
                break  # Stop processing if stop_event is set

            try:
                response = requests.get(arweave_url.format(height=block_height),
                                        headers={'Accept': 'application/json', 'X-Block-Format': '2'},
                                        proxies=proxies)
                response.raise_for_status()
                block_data = response.json()

                # Save block data as a JSON file
                file_path = os.path.join(save_directory, f"block_{block_height}.json")
                with open(file_path, "w") as f:
                    json.dump(block_data, f)

                logging.info(f"Saved block {block_height} to {file_path}")

            except requests.exceptions.RequestException as e:
                logging.error(f'Error with proxy {proxy_url} at block {block_height}: {e}')
                return block_height

    except requests.exceptions.RequestException as e:
        logging.error(f'Error with proxy {proxy_url}: {e}')
        return block_heights[0]  # Return the starting block height

def main():
    arweave_urls = [
        'https://arweave.net/block/height/{height}',
        'https://arweave.dev/block/height/{height}'
    ]
    
    num_gateways = len(arweave_urls)

    # Set the range of block heights
    start_block_height = 1000
    end_block_height = 500

    if start_block_height <= end_block_height:
        print("Error: start_block_height should be greater than end_block_height")
        return

    # Calculate the height range for each gateway
    height_range = (start_block_height - end_block_height + 1) // num_gateways
    remaining_heights = (start_block_height - end_block_height + 1) % num_gateways

    # Create a directory to store the downloaded block data
    save_directory = f"{start_block_height}_{end_block_height}_arweave_data"
    if not os.path.exists(save_directory):
        os.makedirs(save_directory)

    # Create a directory for logs
    log_directory = "logs"
    if not os.path.exists(log_directory):
        os.makedirs(log_directory)

    log_file_path = os.path.join(log_directory, f"{start_block_height}_{end_block_height}_arweave.log")
    configure_logger(log_file_path)

    stop_event = threading.Event()

    if not proxy_list:
        print("No proxies available. Running without proxies.")
        proxy_list.append(None)

    for proxy_url in proxy_list:
        print(f"Using proxy: {proxy_url if proxy_url else 'None'}")
        interrupted_block = start_block_height

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=num_gateways) as executor:
                futures = []
                for i, arweave_url in enumerate(arweave_urls):
                    start_height = start_block_height - i * height_range
                    end_height = start_height - height_range + 1
                    if i == num_gateways - 1:
                        end_height -= remaining_heights

                    block_heights = list(range(start_height, end_height - 1, -1))
                    num_blocks = len(block_heights)
                    num_batches = (num_blocks + 9) // 10  # Number of batches, rounded up

                    for batch in range(num_batches):
                        start_idx = batch * 10
                        end_idx = min((batch + 1) * 10, num_blocks)
                        batch_block_heights = block_heights[start_idx:end_idx]

                        futures.append(
                            executor.submit(save_block_data, proxy_url, arweave_url, batch_block_heights, save_directory, stop_event)
                        )

                        if len(futures) % 10 == 0:
                            print(f"Pausing for 5 seconds on gateway {i+1} with proxy {proxy_url if proxy_url else 'None'}...")
                            time.sleep(5)  # Pause for 5 seconds after every 10 requests

                    for future in concurrent.futures.as_completed(futures):
                        if future.result() is not None:
                            interrupted_block = future.result()

                    if interrupted_block > end_height:
                        break

                    if stop_event.is_set():
                        break  # Stop loop if stop_event is set

                if stop_event.is_set():
                    print("Script interrupted by user.")
                    logging.info("Script interrupted by user.")
                    return

            if interrupted_block > end_block_height:
                print(f"Interrupted at block {interrupted_block}, switching to the next proxy...")
            else:
                print("Proxy completed successfully.")

        except KeyboardInterrupt:
            print("Stopping the script...")
            stop_event.set()
            sys.exit(0)  # Exit the script gracefully

if __name__ == "__main__":
    main()

`;

    setGeneratedCode(code);
  };

  return (
    <div className="App">
      <div className="input-container">
        <h2>WeaveDownloader</h2>
        <Stack sx={{ width: "40%" }} spacing={1}>
          <Alert severity="info">
            <p>
              Height: {height !== null ? height : "Loading..."}
              <a href="#" onClick={fetchHeight}>
                <RefreshIcon></RefreshIcon>
              </a>
            </p>
          </Alert>
          <Alert severity="info">
            Give current block height as start value and 0 as end value to
            download the full Arweave!
          </Alert>
 <Alert severity="info">
           Recommends adding proxy networks and more number of gateways for a smooth experience and to avoid DDoSing one gateway.
          </Alert>
        </Stack>
        <Box
          component="form"
          sx={{
            "& > :not(style)": { m: 1, width: "25ch" },
          }}
          noValidate
          autoComplete="off"
        >
          <TextField
            id="outlined-basic"
            label="Start Block Height"
            variant="outlined"
            type="number"
            value={startBlockHeight}
            onChange={(e) => setStartBlockHeight(e.target.value)}
          />
          <TextField
            id="outlined-basic"
            label="End Block Height"
            variant="outlined"
            type="number"
            value={endBlockHeight}
            onChange={(e) => setEndBlockHeight(e.target.value)}
          />
          {/*      <label>
          Start Block Height:
          <input
            type="number"
            value={startBlockHeight}
            onChange={(e) => setStartBlockHeight(e.target.value)}
          />
        </label>
        <label>
          End Block Height:
          <input
            type="number"
            value={endBlockHeight}
            onChange={(e) => setEndBlockHeight(e.target.value)}
          />
        </label>*/}
          <FormGroup>
            <FormControlLabel
              control={<Checkbox />}
              checked={useProxy}
              onChange={() => setUseProxy(!useProxy)}
              label="Use Proxy Links"
            />
          </FormGroup>
          {/*   <label>
            Use Proxy Links:
            <input
              type="checkbox"
              checked={useProxy}
              onChange={() => setUseProxy(!useProxy)}
            />
      </label> */}
          <Button variant="contained" onClick={generateScript}>
            Generate Script
          </Button>{" "}
        </Box>
      </div>
      {generatedCode && (
        <div className="code-container">
          <CopyToClipboard text={generatedCode}>
            <Button variant="contained" size="small" className="copy-button">
              Copy to Clipboard
            </Button>
          </CopyToClipboard>
          <pre>
            <Code code={generatedCode} language="javascript" />
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;
