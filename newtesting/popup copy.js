document.addEventListener("DOMContentLoaded", async function () {
  console.log("DOMContentLoaded event fired");

  await chrome.tabs.query(
    { active: true, currentWindow: true },
    async function (tabs) {
      console.log("Tabs queried:", tabs);

      let currentTab = tabs[0];
      let actionButton = document.getElementById("actionButton");
      let downloadCsvButton = document.getElementById("downloadCsvButton");
      let resetButton = document.getElementById("resetButton");
      let resultsTable = document.getElementById("resultsTable");
      let scrapedCountElement = document.getElementById("scrapedCount");
      let loadingText = document.getElementById("loadingText");

      if (
        currentTab &&
        currentTab.url.includes("https://www.google.com/maps")
      ) {
        console.log("Current tab is Google Maps");
        document.getElementById("message").textContent =
          "Let's scrape Google Maps!";
        actionButton.disabled = false;
        actionButton.classList.add("enabled");
      } else {
        console.log("Current tab is not Google Maps");
        document.getElementById(
          "message"
        ).innerHTML = `<a href="https://www.google.com/maps/search/" target="_blank">Go to Google Maps Search.</a>`;
        actionButton.style.display = "none";
        downloadCsvButton.style.display = "none";
      }

      actionButton.addEventListener("click", async function () {
        console.log("Action button clicked");
        loadingText.style.display = "block";
        await chrome.storage.sync.set({ scrapedResults: [], scrapedCount: 0 });

        chrome.runtime.sendMessage({ action: "startScraping" }, (response) => {
          console.log("Start scraping response:", response);
        });
      });

      downloadCsvButton.addEventListener("click", async function () {
        console.log("Download CSV button clicked");
        chrome.runtime.sendMessage({ action: "getResults" }, (response) => {
          console.log("Get results response:", response);
          if (response.results && response.results.length > 0) {
            let csv = arrayToCsv(response.results);
            downloadCsv(csv, "google-maps-data.csv");
          }
        });
      });

      resetButton.addEventListener("click", async function () {
        console.log("Reset button clicked");
        await chrome.storage.sync.set(
          { scrapedResults: [], scrapedCount: 0 },
          () => {
            console.log("Storage reset");
            while (resultsTable.firstChild) {
              resultsTable.removeChild(resultsTable.firstChild);
            }
            downloadCsvButton.disabled = true;
            scrapedCountElement.textContent = 0;
          }
        );
      });

      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("Message received:", message);
        if (message.action === "updateScrapedCount") {
          scrapedCountElement.textContent = message.scrapedCount;
        } else if (message.action === "scrapingComplete") {
          loadingText.style.display = "none";
          updateResultsTable(message.results);
          downloadCsvButton.disabled = false;
        }
      });

      // Retrieve stored results and count on popup open
      chrome.storage.sync.get(["scrapedResults", "scrapedCount"], (data) => {
        console.log("Stored data retrieved:", data);
        if (data.scrapedResults && data.scrapedResults.length > 0) {
          updateResultsTable(data.scrapedResults);
          downloadCsvButton.disabled = false;
        }
        scrapedCountElement.textContent = data.scrapedCount || 0;
      });
    }
  );
});

function updateResultsTable(results) {
  console.log("Updating results table with data:", results);

  while (resultsTable.firstChild) {
    resultsTable.removeChild(resultsTable.firstChild);
  }

  const headers = [
    "Title",
    "Rating",
    "Reviews",
    "Phone",
    "Industry",
    "Address",
    "Website",
    "Google Maps Link",
  ];
  const headerRow = document.createElement("tr");
  headers.forEach((headerText) => {
    const header = document.createElement("th");
    header.textContent = headerText;
    headerRow.appendChild(header);
  });
  resultsTable.appendChild(headerRow);

  results.forEach(function (item) {
    var row = document.createElement("tr");
    [
      "title",
      "rating",
      "reviewCount",
      "phone",
      "industry",
      "address",
      "companyUrl",
      "href",
    ].forEach(function (key) {
      var cell = document.createElement("td");

      if (key === "reviewCount" && item[key]) {
        item[key] = item[key].replace(/\(|\)/g, "");
      }

      cell.textContent = item[key] || "";
      row.appendChild(cell);
    });
    resultsTable.appendChild(row);
  });
}

function arrayToCsv(array) {
  const headers = [
    "Title",
    "Rating",
    "Reviews",
    "Phone",
    "Industry",
    "Address",
    "Website",
    "Google Maps Link",
  ];
  const csvRows = [headers.join(",")];

  for (const item of array) {
    const row = [
      item.title,
      item.rating,
      item.reviewCount,
      item.phone,
      item.industry,
      item.address,
      item.companyUrl,
      item.href,
    ].map((value) => `"${value}"`);
    csvRows.push(row.join(","));
  }

  return csvRows.join("\n");
}

function downloadCsv(csv, filename) {
  console.log("Downloading CSV file:", filename);

  var csvFile;
  var downloadLink;

  csvFile = new Blob([csv], { type: "text/csv" });
  downloadLink = document.createElement("a");
  downloadLink.download = filename;
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink); // Clean up the DOM
}