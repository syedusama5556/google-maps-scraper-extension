document.addEventListener("DOMContentLoaded", async function () {
  await chrome.tabs.query(
    { active: true, currentWindow: true },
    async function (tabs) {
      var currentTab = tabs[0];
      var actionButton = document.getElementById("actionButton");
      var downloadCsvButton = document.getElementById("downloadCsvButton");
      var resetButton = document.getElementById("resetButton");
      var resultsTable = document.getElementById("resultsTable");
      var scrapedCountElement = document.getElementById("scrapedCount");
      var loadingText = document.getElementById("loadingText");

      if (
        currentTab &&
        currentTab.url.includes("https://www.google.com/maps")
      ) {
        document.getElementById("message").textContent =
          "Let's scrape Google Maps!";
        actionButton.disabled = false;
        actionButton.classList.add("enabled");
      } else {
        document.getElementById(
          "message"
        ).innerHTML = `<a href="https://www.google.com/maps/search/" target="_blank">Go to Google Maps Search.</a>`;
        actionButton.style.display = "none";
        downloadCsvButton.style.display = "none";
      }

      actionButton.addEventListener("click", async function () {
        loadingText.style.display = "block";
        await chrome.storage.sync.set({ scrapedResults: [], scrapedCount: 0 });

        await chrome.runtime.sendMessage(
          { action: "startScraping" },
          (response) => {
            console.log(response);
          }
        );
      });

      downloadCsvButton.addEventListener("click", async function () {
        await chrome.runtime.sendMessage(
          { action: "getResults" },
          (response) => {
            if (response.results && response.results.length > 0) {
              var csv = arrayToCsv(response.results);
              downloadCsv(csv, "google-maps-data.csv");
            }
          }
        );
      });

      resetButton.addEventListener("click", async function () {
        await chrome.storage.sync.set(
          { scrapedResults: [], scrapedCount: 0 },
          () => {
            while (resultsTable.firstChild) {
              resultsTable.removeChild(resultsTable.firstChild);
            }
            downloadCsvButton.disabled = true;
            scrapedCountElement.textContent = 0;
          }
        );
      });

      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "scrapingComplete") {
          loadingText.style.display = "none";
          scrapedCountElement.textContent = message.scrapedCount;
          updateResultsTable(message.results);
          downloadCsvButton.disabled = false;
        }
      });

      // Retrieve stored results and count on popup open
      chrome.storage.sync.get(["scrapedResults", "scrapedCount"], (data) => {
        let count = data.scrapedCount;
        if (count === null || count === 0) {
          count = (data.scrapedResults && data.scrapedResults.length) || 0;
        }
        scrapedCountElement.textContent = count;
        if (data.scrapedResults && data.scrapedResults.length > 0) {
          updateResultsTable(data.scrapedResults);
          downloadCsvButton.disabled = false;
        } else {
          downloadCsvButton.disabled = true;
        }
      });
    }
  );
});

function updateResultsTable(results) {
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
  var csvFile;
  var downloadLink;

  csvFile = new Blob([csv], { type: "text/csv" });
  downloadLink = document.createElement("a");
  downloadLink.download = filename;
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink);
  downloadLink.click();
}
