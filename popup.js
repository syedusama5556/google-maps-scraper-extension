var halfresults = []; // Use an array to store results

document.addEventListener("DOMContentLoaded", async function () {
  await chrome.tabs.query(
    { active: true, currentWindow: true },
    async function (tabs) {
      var currentTab = tabs[0];
      var actionButton = document.getElementById("actionButton");
      var downloadCsvButton = document.getElementById("downloadCsvButton");
      var downloadExcelButton = document.getElementById("downloadExcelButton");
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
        downloadExcelButton.style.display = "none";
      }

      actionButton.addEventListener("click", async function () {
        loadingText.style.display = "block";
        halfresults = []; 
        await chrome.storage.local.set({ scrapedResults: [], scrapedCount: 0 });

        chrome.runtime.sendMessage({ action: "startScraping" }, (response) => {
          console.log(response);
        });
      });
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "scrapingProgress") {
          scrapedCountElement.textContent = message.scrapedCount;
          updateResultsTable([message.latestResult], true);
        } else if (message.action === "scrapingComplete") {
          loadingText.style.display = "none";
          scrapedCountElement.textContent = message.scrapedCount;
          updateResultsTable(message.results);
          downloadCsvButton.disabled = false;
          downloadExcelButton.disabled = false;
          chrome.storage.local.set({
            scrapedResults: message.results,
            scrapedCount: message.scrapedCount,
          });
        }
      });

      // Retrieve stored results and count on popup open
      chrome.storage.local.get(["scrapedResults", "scrapedCount"], (data) => {
        let count = data.scrapedCount;
        if (count === null || count === 0) {
          count = (data.scrapedResults && data.scrapedResults.length) || 0;
        }
        scrapedCountElement.textContent = count;
        if (data.scrapedResults && data.scrapedResults.length > 0) {
          updateResultsTable(data.scrapedResults);
          downloadCsvButton.disabled = false;
          downloadExcelButton.disabled = false;
        } else {
          downloadExcelButton.disabled = true;
          downloadCsvButton.disabled = true;
        }
      });

      downloadExcelButton.addEventListener("click", async function () {
        chrome.storage.local.get("scrapedResults", (data) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error retrieving data from chrome.storage.sync:",
              chrome.runtime.lastError
            );
            sendResponse({ results: [] });
          } else {
            var resultsare = data.scrapedResults;

            if (resultsare && resultsare.length > 0) {
              // Define headers
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

              // Map results to sheet values
              const sheetValues = resultsare.map((result) => [
                result.title,
                result.rating,
                result.reviewCount,
                result.phone,
                result.industry,
                result.address,
                result.companyUrl,
                result.href,
              ]);

              // Prepend headers to sheet values
              sheetValues.unshift(headers);

              // Create the workbook and worksheet
              const workbook = XLSX.utils.book_new();
              const worksheet = XLSX.utils.aoa_to_sheet(sheetValues);
              XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

              // Generate Excel file and trigger download
              const excelBuffer = XLSX.write(workbook, {
                bookType: "xlsx",
                type: "array",
              });
              saveExcelFile(excelBuffer, "scraped_data.xlsx");
            }
          }
        });
      });

      downloadCsvButton.addEventListener("click", async function () {
        chrome.storage.local.get("scrapedResults", (data) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error retrieving data from chrome.storage.sync:",
              chrome.runtime.lastError
            );
            sendResponse({ results: [] });
          } else {
            var resultsare = data.scrapedResults;

            if (resultsare && resultsare.length > 0) {
              var csv = arrayToCsv(resultsare);
              downloadCsv(csv, "google-maps-data.csv");
            }
          }
        });
      });

      resetButton.addEventListener("click", async function () {
        await chrome.storage.local.set(
          { scrapedResults: [], scrapedCount: 0 },
          () => {
            while (resultsTable.firstChild) {
              resultsTable.removeChild(resultsTable.firstChild);
            }
            downloadCsvButton.disabled = true;
            downloadExcelButton.disabled = true;
            scrapedCountElement.textContent = 0;
          }
        );
      });
    }
  );
});

function updateResultsTable(results, append = false) {
  console.log("results size", results.length);

  var resultsTable = document.getElementById("resultsTable");

  if (!append) {
    // Clear the table before updating
    while (resultsTable.firstChild) {
      resultsTable.removeChild(resultsTable.firstChild);
    }

    // Create and append headers
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

    // Initialize halfresults with new results
    halfresults = [...results]; // Make sure halfresults is an array
  } else {
    // Ensure halfresults is an array and append new results
    if (!Array.isArray(halfresults)) {
      halfresults = [];
    }
    halfresults.push(...results);
  }

  // Append results to the table
  halfresults.forEach(function (item) {
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
  var csvFile = new Blob([csv], { type: "text/csv" });
  var downloadLink = document.createElement("a");
  downloadLink.download = filename;
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink);
  downloadLink.click();
}

function saveExcelFile(buffer, fileName) {
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(url);
}
