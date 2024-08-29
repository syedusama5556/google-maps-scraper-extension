let isScrapingInProgress = false;
let scrapedResults = [];

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "startScraping") {
    if (!isScrapingInProgress) {
      isScrapingInProgress = true;
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            function: scrapeData,
          },
          (results) => {
            isScrapingInProgress = false;
            if (results && results[0] && results[0].result) {
              scrapedResults = results[0].result;
              // Store results in chrome.storage
              chrome.storage.sync.set({ scrapedResults: scrapedResults }, () => {
                chrome.runtime.sendMessage({
                  action: "scrapingComplete",
                  results: scrapedResults,
                  scrapedCount :  scrapedResults.length
                });
              });
            } else {
              console.log("Scraping failed or returned no results.");
            }
          }
        );
      });
    }
    sendResponse({ status: "Scraping started" });
  } else if (message.action === "getResults") {
    // Retrieve results from chrome.storage
    chrome.storage.sync.get("scrapedResults", (data) => {
      if (chrome.runtime.lastError) {
        console.error("Error retrieving data from chrome.storage.sync:", chrome.runtime.lastError);
        sendResponse({ results: [] });
      } else {
        sendResponse({ results: data.scrapedResults || [] });
      }
    });
  }
  return true; // Required to indicate async response
});



async function scrapeData() {
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  var links = Array.from(
    document.querySelectorAll('a[href^="https://www.google.com/maps/place"]')
  );
  var results = [];

  for (let link of links) {
    link.click();
    await delay(5000 + Math.random() * 3000); // Increased delay between clicks to 5-8 seconds

    var container = document.querySelector(".bJzME.Hu9e2e.tTVLSc");
    if (container) {
      var titleText = "";
      var rating = "";
      var reviewCount = "";
      var phone = "";
      var industry = "";
      var address = "";
      var companyUrl = "";

      // Title
      var titleElement = container.querySelector("h1.DUwDvf.lfPIob");
      titleText = titleElement ? titleElement.textContent.trim() : "";

      // Rating
      var roleImgContainer = container.querySelector('[role="img"]');
      if (roleImgContainer) {
        var ariaLabel = roleImgContainer.getAttribute("aria-label");
        if (ariaLabel && ariaLabel.includes("stars")) {
          var parts = ariaLabel.split(" ");
          rating = parts[0];
        } else {
          rating = "0";
        }
      }

      // Review Count
      var reviewCountElement = container.querySelector(
        '[aria-label*="reviews"]'
      );
      reviewCount = reviewCountElement
        ? reviewCountElement.textContent.trim()
        : "0";

      // Address
      var addressElement = container.querySelector(".rogA2c .Io6YTe");
      address = addressElement ? addressElement.textContent.trim() : "";
      if (address.startsWith("Address: ")) {
        address = address.replace("Address: ", "");
      }

      // URL
      var urlElement = container.querySelector('a[data-item-id="authority"]');
      if (urlElement) {
        var fullUrl = urlElement.getAttribute("href") || "";
        var url = new URL(fullUrl);
        companyUrl = url.origin; // This will get the base URL
      } else {
        companyUrl = "";
      }

      // Phone Number
      var phoneElement = container.querySelector(
        '.CsEnBe[aria-label^="Phone"]'
      );
      var phone = "";
      if (phoneElement) {
        phone = phoneElement
          .getAttribute("aria-label")
          .replace("Phone: ", "")
          .trim();
      }

      // Industry
      var industryElement = container.querySelector(".fontBodyMedium .DkEaL");
      industry = industryElement ? industryElement.textContent.trim() : "";

      results.push({
        title: titleText,
        rating: rating,
        reviewCount: reviewCount,
        phone: phone,
        industry: industry,
        address: address,
        companyUrl: companyUrl,
        href: link.href,
      });
    }
  }
  return results;
}
